/**
 * Shared logging module.
 */
const fs = require('fs')
const path = require('path');
const root = require('app-root-path');
require('dotenv').config({ path: path.join(root.path, '.env') });
const appConstants = fs.existsSync(path.join(root.path, '/config/appConstants.js')) ? require('./config/appConstants') : [];

const _ = require('lodash');
const moment = require('moment-timezone');
const mung = require('express-mung'); // to log api request/response

const { sendEmail, sendHealthCheckEmail, NotFoundError, ValidationError } = require('./components');
const env = process.env.NODE_ENV || 'development';

const Sentry = require("@sentry/node");
const SENTRY_ENABLED = appConstants?.SENTRY?.DNS ? true : false;

if(SENTRY_ENABLED){
  Sentry.init({
    dsn: appConstants.SENTRY.DNS, // process.env.SENTRY_DNS,
    // tracesSampleRate. This should be a float/double between 0.0 and 1.0 (inclusive) and represents the percentage chance that any given transaction will be sent to Sentry. So, barring outside influence , 0.0 is a 0% chance (none will be sent) and 1.0 is a 100% chance (all will be sent).
    // recommended adjusting this value in production, or using tracesSampler for finer control
    tracesSampleRate:  appConstants.SENTRY.SENTRY_TRACES_SAMPLE_RATE ?? 1.0 //process.env.SENTRY_TRACES_SAMPLE_RATE,
  });
}

//#region CONSTANTS AND ENUMERATIONS

const MODULE_NAME = 'logging-module';
const DATE_FORMAT = 'YYYY-MM-DD';
const TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
const MONITOR_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm';

const LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

const LEVEL_PRIORITY = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  NOT_FOUND_ERROR: 404,
  SYSTEM_ERROR: 500
};

// This interface is returned on constructor error
// so that the caller is not affected. On constructor success,
// the mock interface methods are replaced with the actual methods.

const LOGGER_INTERFACE = {
  LEVEL,
  middleware: {
    attach: (req, res, next) => {
      next();
    },
    apiRequestHandler: (req, res, next) => {
      next();
    }
  },
  debug: _.noop,
  info: _.noop,
  warn: _.noop,
  error: _.noop,
  sequelizeQuery: _.noop,
  sendApiValidationError: _.noop,
  sendApiAuthenticationError: _.noop,
  setCustomErrorResponseHandler: _.noop,
  parseError: _.noop,
  timezone: _.noop,
  monitor: _.noop,
  purge: _.noop,
  query: _.noop
};

//#endregion

//#region INTERNAL METHODS, NOT SPECIFIC TO A LOGGER INSTANCE

const handleInternalError = (context, err) => {
  let contextStrng = `${MODULE_NAME} ${context}`;
  if (context.indexOf(MODULE_NAME) !== -1) {
    contextStrng = context;
  }
  // console.log(contextStrng)
  // console.error(err);
  if(SENTRY_ENABLED){
    Sentry.configureScope(scope => scope.setTransactionName(contextStrng));
    Sentry.captureException(err);
  }
 
};

const parseStacktrace = (stack) => {
  return stack.split('\n').map(item => {
    return _.trim(item);
  }).filter(item => { // exclude Node.js internals
    if (!(/internal\//.test(item) || /node_modules/.test(item))) {
      return item;
    }
  }).join('\n ');
};

const safeString = (str) => {
  return str ? str.replace(/\'/g, "''") : null;
};

const stringify = (obj) => {
  return _.isString(obj) ? safeString(obj) : JSON.stringify(obj);
};

/**
 * Errors passed from other modules were not being detected as NotFoundError or ValidationError
 * which caused an incorrect http status to be returned.
 */

const isNotFoundError = (err) => {
  return err instanceof NotFoundError || err.name === 'NotFoundError';
};

const isValidationError = (err) => {
  return err instanceof ValidationError || err.name === 'ValidationError';
};

//#endregion

/**
 * Using a class to get a separate instance for each component that requires this module.
 */
class LogModule {
  constructor(overrideComponentName) {
    if(SENTRY_ENABLED){
      const sentryTransaction = Sentry.startTransaction();
    }

    this.COMPONENT_NAME = process.env.LOGGING_MODULE_COMPONENT_NAME || MODULE_NAME;

    if (overrideComponentName) { // currently only used for multi-instance testing
      this.COMPONENT_NAME = overrideComponentName;
    }

    //#region INSTANCE METHODS

    /**
     * Validate required columns.
     */
    this.isValidLogDataFormat = (data) => {
      if (data && (data.context || data.source) && (data.message || data.err || data.sql || data.request_url)) {
        return true;
      } else {
        console.error('data format is not valid, context and either sql|message|err|request_url are required');
        return false;
      }
    };

    /**
     * Write log record,
     */
    this.writeLog = (level, data) => {
      try {
        if (LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.baseLoggingLevel]) {
          if (this.initialized && this.isValidLogDataFormat(data)) {
            if(SENTRY_ENABLED){
              Sentry.setContext("Additional Data", data);
              if (data.param) {
                Sentry.setContext("Additional Data", {...data, param: JSON.stringify(data.param)});
              }
              Sentry.configureScope(scope => scope.setTransactionName(data.source || data.context));
            }
            if (data.err) {
              if(SENTRY_ENABLED) {
                Sentry.captureException(data.err);
              }
              if (data.err.message) {
                if (data.message) { // append to existing message
                  data.message += ` : ${data.err.message}`;
                } else {
                  data.message = data.err.message;
                }
              }
              if (data.err.stack) {
                data.stack = parseStacktrace(data.err.stack);
              }
            }
            if (SENTRY_ENABLED && data.message) {
              Sentry.captureMessage(data.message);
            }

            this.db.logs.create({
              level,
              component: this.COMPONENT_NAME,
              context: data.source || data.context,
              agency_id: data.agency_id || null,
              agency_program_id: data.agency_program_id || null,
              error_code: data.error_code ? parseInt(data.error_code, 10) : null,
              message: safeString(data.message),
              sso_id: data.sso_id || null,
              request_method: data.request_method || null,
              request_url: data.request_url || null,
              request_body: data.request_body ? stringify(data.request_body) : null,
              response_code: data.response_code || null,
              response_body: data.response_body ? stringify(data.response_body) : null,
              sql: data.sql ? data.sql.replace(/\'/g, "''") : null,
              data: data.data ? JSON.stringify(data) : null,
              stack: safeString(data.stack),
              elapsed_time: data.elapsed_time || null,
              timestamp: moment().format(TIMESTAMP_FORMAT)
            });
          }
        }
      } catch (err) {
        handleInternalError('writeLog', err);
      }
    };

    /**
     * Write Connection Protection log record, called from User module.
     */
    this.logConnectionProtectionRequest = (data) => {
      return this.db.connection_protection_logs.create(data);
    };

    /**
     * Log API request/response and elapsed time, called by express-mung middleware.
     */
    this.apiRequestResponseLogger = (_this, body, req, res) => {
      try {
        if (_this instanceof LogModule) { // can only be called by another LogModule method
          let elapsedTime = null;
          let isLoggingEnabled = this.apiRequestLoggingEnabled ? true : false;

          req.isPostman = req.headers['postman-token'] ? true : false;
          req.isAdmin = req.query.is_admin ? req.query.is_admin === 'true' : false;
          req.requester = req.isAdmin ? 'admin portal' : (req.isPostman ? 'postman' : 'app');

          if (res.statusCode === HTTP_STATUS.NOT_FOUND_ERROR) {
            isLoggingEnabled = false;
          } else if (_.endsWith(req.url, '/status_auth')) {
            isLoggingEnabled = false;
          } else if (req.timestamp && moment.isMoment(req.timestamp)) {
            elapsedTime = moment().diff(req.timestamp);
            if (elapsedTime > this.apiRequestThreshold) {
              isLoggingEnabled = true;
            }
          }

          if (isLoggingEnabled) {
            this.writeLog(LEVEL.INFO, {
              context: `API : ${req.requester}`,
              sso_id: req.sso_id,
              agency_id: req.params ? req.params.agency_id : null,
              agency_program_id: req.params ? req.params.agency_program_id : null,
              request_method: req.method,
              request_url: req.baseUrl || req.url, // req.url doesn't include full route
              request_body: _.isEmpty(req.body) ? null : req.body,
              response_code: res.statusCode,
              response_body: body,
              elapsed_time: elapsedTime
            });
          }
        }
      } catch (err) {
        handleInternalError('apiRequestResponseLogger', err);
      }

      return body;
    };

    /**
     * Log Sequelize query to database.
     */
    this.sequelizeQuery = (message, params) => {
      if (this.sqlQueryLoggingEnabled) {
        let options = {
          context: 'Sequelize',
          sql: `${message.replace('Executing (default): ', '')}`
        };

        // include any bound parameters

        if (params && params.bind) {
          options.sql += `, REPLACEMENTS: [${params.bind}]`;
        }

        this.writeLog(LEVEL.INFO, options);
      }
    };

    /**
     * Send http 400 error.
     */
    this.sendApiValidationError = (res, message) => {
      res.status(HTTP_STATUS.VALIDATION_ERROR).send(message);
    };

    /**
     * Send http 401 error.
     */
    this.sendApiAuthenticationError = (res, message) => {
      res.status(HTTP_STATUS.AUTHENTICATION_ERROR).send(message);
    };

    /**
     * Send http 404 error.
     */
    this.sendApiNotFoundError = (res, message) => {
      res.status(HTTP_STATUS.NOT_FOUND_ERROR).send(message);
    };

    /**
     * Send http 500 error.
     */
    this.sendApiSystemError = (res, message) => {
      res.status(HTTP_STATUS.SYSTEM_ERROR).send(message);
    };

    /**
     * Handle API controller exceptions.
     * @param {Object} req - request object
     * @param {Object} res - response object
     * @param {Error} err
     */
    this.handleApiException = async (req, res, err) => {
      const methodID = `${MODULE_NAME} handleApiException`;
      const message = this.parseError(err).message;

      try {
        if (isNotFoundError(err)) {
          this.sendApiNotFoundError(res, message);
        } else if (isValidationError(err)) {
          this.sendApiValidationError(res, message);
        } else {
          this.writeLog(LEVEL.ERROR, {
            context: methodID,
            sso_id: req.sso_id,
            request_method: req.method,
            request_url: req.url,
            request_body: _.isEmpty(req.body) ? null : req.body,
            response_code: HTTP_STATUS.SYSTEM_ERROR,
            message
          });

          if (this.customResponseHandler) {
            this.customResponseHandler(res, err, message);
          } else {
            this.sendApiSystemError(res, message);
          }
        }
      } catch (innerErr) {
        handleInternalError('handleApiException', innerErr);

        if (this.customResponseHandler) {
          this.customResponseHandler(res, err, message);
        } else {
          this.sendApiSystemError(res, message);
        }
      }
    };

    /**
     * Handle API controller SDKResult failures.
     * @param {Object} req - request object
     * @param {Object} res - response object
     * @param {SDKResult} result - response from SDK method
     */
    this.handleSDKResultError = async (req, res, result) => {
      const methodID = `${MODULE_NAME} handleSDKResultError`;
      const message = this.parseError(result.err).message;

      try {
        if (isNotFoundError(result.err)) {
          this.sendApiNotFoundError(res, message);
        } else if (isValidationError(result.err)) {
          this.sendApiValidationError(res, message);
        } else {
          this.writeLog(LEVEL.ERROR, {
            context: methodID,
            sso_id: req.sso_id,
            request_method: req.method,
            request_url: req.url,
            request_body: _.isEmpty(req.body) ? null : req.body,
            response_code: HTTP_STATUS.SYSTEM_ERROR,
            message
          });

          this.sendApiSystemError(res, message);
        }
      } catch (err) {
        handleInternalError('handleApiException', err);
        this.sendApiSystemError(res, message);
      }
    };

    /**
     * Parse error object into message and stack trace (if available).
     * Also used directly by the payment module.
     */
    this.parseError = (err) => {
      let result = {
        message: err.message || JSON.stringify(err),
        stack: err.stack ? parseStacktrace(err.stack) : null
      };

      try {
        if (isValidationError(err)) {
          result.details = result.stack || result.message;
        } else {
          result.details = `${result.message} : ${result.stack}`;
        }
      } catch (innerErr) {
        handleInternalError('parseError', innerErr);
      }

      return result;
    };

    /**
     * Check for recent ERROR log records and send email alert.
     */
    this.monitor = async () => {
      const methodID = `${MODULE_NAME} monitor task`;

      let interval = process.env.LOGGING_MODULE_MONITOR_THRESHOLD_MINUTES || 15;

      try {
        const rows = await this.db.logs.findAll({
          where: {
            level: LEVEL.ERROR,
            message: {
              [this.db.Sequelize.Op.not]: null
            },
            timestamp: {
              [this.db.Sequelize.Op.between]: [
                moment().subtract(interval, 'minutes').format(MONITOR_TIMESTAMP_FORMAT),
                moment().format(MONITOR_TIMESTAMP_FORMAT)
              ]
            }
          }
        });

        if (rows && rows.length) {
          this.writeLog(LEVEL.DEBUG, {
            context: methodID,
            message: `Found ${rows.length} recent ${LEVEL.ERROR} records to report`
          });

          await sendHealthCheckEmail(rows);
        } else {
          this.writeLog(LEVEL.DEBUG, {
            context: methodID,
            message: `Found no recent ${LEVEL.ERROR} records to report`
          });
        }
      } catch (err) {
        this.writeLog(LEVEL.ERROR, {
          context: methodID,
          message: err.message
        });
      }
    };

    /**
     * Remove outdated log records.
     */
    this.purge = async () => {
      const methodID = `${MODULE_NAME} purge task`;

      let interval = process.env.LOGGING_MODULE_PURGE_THRESHOLD_DAYS || 5;
      let connectionProtectionInterval = process.env.LOGGING_MODULE_CONNECTION_PROTECTION_RETENTION_PERIOD || 30;

      try {

        // PURGE LOGS

        const count = await this.db.logs.destroy({
          where: {
            timestamp: {
              [this.db.Sequelize.Op.lt]: moment().subtract(interval, 'days').format(DATE_FORMAT)
            }
          }
        });

        this.writeLog(LEVEL.INFO, {
          context: methodID,
          message: `Purged ${count} records from ${this.logConfig.tableName}`
        });

        try {
          // PURGE CONNECTION_PROTECTION_LOGS
          // ignore error because not all schemas have a
          // connection_protection_logs table
  
          count = await this.db.connection_protection_logs.destroy({
            where: {
              timestamp: {
                [this.db.Sequelize.Op.lt]: moment().subtract(connectionProtectionInterval, 'days').format(DATE_FORMAT)
              }
            }
          });

          this.writeLog(LEVEL.INFO, {
            context: methodID,
            message: `Purged ${count} records from connection_protection_logs`
          });
         } catch (err) {
          // ignore
         }
       } catch (err) {
         this.writeLog(LEVEL.ERROR, {
           context: methodID,
           message: err.message
         });
       }
     };
 
     /**
      * Query log records.
      */
      this.query = (options, replacements) => {
       const methodID = `${MODULE_NAME} query`;
   
       try {
         let sql = [`SELECT * FROM ${this.logConfig.tableName}`];
         let countSql = [`SELECT COUNT(*) FROM ${this.logConfig.tableName}`];
 
         if (replacements) {
           let sqlCriteria = [];
 
           if (replacements.level) {
             sqlCriteria.push(`level = :level`);
           }
           if (replacements.start_date && replacements.end_date) {
             sqlCriteria.push(`DATE(timestamp) BETWEEN :start_date AND :end_date`);
           }
           if (sqlCriteria.length) {
             sql.push('WHERE 1=1 AND');
             sql.push(sqlCriteria.join(' AND '));
       
             countSql.push('WHERE 1=1 AND');
             countSql.push(sqlCriteria.join(' AND '));
           }
         }
 
         if (options.order && options.order.length) {
           let sort = options.order[0];
           sql.push(`ORDER BY ${sort[0]} ${sort[1]}`);
         } else {
           sql.push('ORDER BY timestamp DESC');
         }
 
         if (options.offset) {
           sql.push(`OFFSET ${options.offset}`);
         }
 
         if (options.limit) {
           sql.push(`LIMIT ${options.limit}`);
         }

         return Promise.all([
           this.db.sequelize.query(sql.join(' '), {
             type: this.db.sequelize.QueryTypes.SELECT,
             replacements
           }),
           this.db.sequelize.query(countSql.join(' '), {
             type: this.db.sequelize.QueryTypes.SELECT,
             replacements
           })
         ]);
       } catch (err) {
         this.writeLog(LEVEL.ERROR, {
           context: methodID,
           message: err.message
         });
       }
     };
 
     //#endregion
 
     //#region INITIALIZATION
 
     try {
       this.initialized = false;
       this.sqlQueryLoggingEnabled = false;
       this.apiRequestLoggingEnabled = false;
       this.apiRequestThreshold = 30000; // in ms
       this.logConfig = require('./config/log-config.json')[env];
       this.baseLoggingLevel = process.env.LOGGING_MODULE_LEVEL || LEVEL.INFO;
       this.connectionString = `postgres://${this.logConfig.username}:${this.logConfig.password}@${this.logConfig.host}:${this.logConfig.port}/${this.logConfig.database}`;
 
       if (process.env.LOGGING_MODULE_API_REQUEST_THRESHOLD_SECONDS) {
         this.apiRequestThreshold = parseInt(process.env.LOGGING_MODULE_API_REQUEST_THRESHOLD_SECONDS, 10) * 1000;
       }
 
       if (process.env.LOGGING_MODULE_SQL_QUERIES) {
         this.sqlQueryLoggingEnabled = (process.env.LOGGING_MODULE_SQL_QUERIES.toLowerCase() === 'true');
       }
 
       if (process.env.LOGGING_MODULE_API_REQUESTS) {
         this.apiRequestLoggingEnabled = (process.env.LOGGING_MODULE_API_REQUESTS.toLowerCase() === 'true');
       }
 
       this.db = require('./models')(this.logConfig);
   
       this.initialized = true;
     } catch (err) {
       handleInternalError('constructor', err);
       // RETURN MOCK INTERFACE
       return Object.assign({}, LOGGER_INTERFACE);
     }
 
     //#endregion
 
     //#region RETURN PUBLIC INTERFACE
 
     return Object.assign({}, LOGGER_INTERFACE, {
       middleware: {
         attach: (req, res, next) => {
           try {
             req.timestamp = moment(); // set timestamp for request/response logging
             res.sdkErrorHandler = _.partial(this.handleSDKResultError, req, res);
             res.exceptionHandler = _.partial(this.handleApiException, req, res);
           } catch (err) {
             handleInternalError('middleware.attach', err);
           }
           next();
         },
         apiRequestHandler: mung.json((body, req, res) => {
           return this.apiRequestResponseLogger(this, body, req, res);
         }, {
           mungError: true // also invoked for error responses
         })
       },
       debug: _.partial(this.writeLog, LEVEL.DEBUG),
       info: _.partial(this.writeLog, LEVEL.INFO),
       warn: _.partial(this.writeLog, LEVEL.WARN),
       error: _.partial(this.writeLog, LEVEL.ERROR),
       sequelizeQuery: this.sequelizeQuery,
       sendApiValidationError: this.sendApiValidationError,
       sendApiAuthenticationError: this.sendApiAuthenticationError,
       setCustomErrorResponseHandler: (fn) => {
         // Returns response in place of this.sendApiSystemError. 
         // Added during User module integration to return an error response as: 
         // { error: err.message, detail: err }
         if (fn && typeof fn === 'function') {
           this.customErrorResponseHandler = fn;
         }
       },
       parseError: this.parseError,
       timezone: this.logConfig.timezone,
       monitor: this.monitor,
       purge: this.purge,
       sendEmail: async (options) => {
         try {
           await sendEmail(options);
         } catch (err) {
           if (err.name === 'MessageRejected') {
             this.writeLog(LEVEL.ERROR, {
               context: `${MODULE_NAME} sendEmail`,
               data: options,
               message: err.Error.Message
             });
           } else {
             this.writeLog(LEVEL.ERROR, {
               context: `${MODULE_NAME} sendEmail`,
               data: options,
               err
             });
           }
         }
       },
       logConnectionProtectionRequest: this.logConnectionProtectionRequest,
       query: this.query
     });
 
     // #endregion
   }
 }
 
 module.exports = (overrideComponentName) => {
   return new LogModule(overrideComponentName);
 };