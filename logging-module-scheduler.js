require('dotenv').config();

const cron = require('node-cron');
const moment = require('moment-timezone');
const logger = require('./logging-module')('logging-module-scheduler');

let tasks = {};

const destroyTasks = () => {
  logger.debug({
    context: 'destroyTasks',
    message: 'terminating pending tasks'
  });

  for (let task in tasks) {
    if (tasks.hasOwnProperty(task) && task.destroy) {
      task.destroy();
    }
  }
};

const getCronTime = (hours, minutes, day) => {
  if (day) {
    return `${minutes} ${hours} ${day} * *`;
  } else if (minutes === undefined) {
    return moment().hours(hours).format('* H * * *');
  } else {
    return moment().hours(hours).minutes(minutes).format('m H * * *');
  }
};

const monitor = async () => {
  let methodName = 'Health Check';

  try {
    logger.debug({
      context: methodName,
      message: 'started'
    });
 
    await logger.monitor();

    logger.debug({
      context: methodName,
      message: 'completed'
    });
  } catch (err) {
    logger.error({
      context: methodName,
      message: err.message
    });

    throw err;
  }
};

const purge = async () => {
  let methodName = 'Log Cleanup';

  try {
    logger.debug({
      context: methodName,
      message: 'started'
    });
 
    await logger.purge();

    logger.debug({
      context: methodName,
      message: 'completed'
    });
  } catch (err) {
    logger.error({
      context: methodName,
      message: err.message
    });

    throw err;
  }
};

const startProcess = async () => {
  let methodName = 'startProcess';
  let monitorInterval = process.env.LOGGING_MODULE_MONITOR_THRESHOLD_MINUTES || 15;

  moment.tz.setDefault(logger.timezone);

  try {
    process.on('message', (msg) => {
      logger.debug({
        context: methodName,
        message: `Received '${msg}' message`
      });
  
      if (msg === 'shutdown') {
        destroyTasks();
        process.exit(0);
      }
    });

    // run every 15 minutes (or configured interval)
    tasks.monitor = cron.schedule(`00 */${monitorInterval} * * * *`, monitor);

    tasks.purge = cron.schedule(getCronTime(17, 21), purge);

  } catch (err) {
    logger.error({
      context: methodName,
      message: err.message
    });

    destroyTasks();
  }
};

startProcess();