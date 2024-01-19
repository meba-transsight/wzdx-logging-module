const moment = require('moment');
const Sequelize = require('sequelize');

module.exports = (logConfig) => {
  moment.tz.setDefault(logConfig.timezone);

  // add support for "timestamp without time zone"
  // const withDateNoTz = require('sequelize-date-no-tz-postgres');
  // const DataTypes = withDateNoTz(Sequelize.DataTypes);
  
  const DataTypes = require('sequelize-date-no-tz-postgres')(Sequelize.DataTypes);
  
  // create db instance to contain all database related properties and methods
  
  const db = {
    Sequelize, // class
    GET_CURRENT_TIMESTAMP: () => {
      return db.sequelize.fn('now');
    },
    formatDate: (dateObject) => { // return value in ISO 8601 format eg: '2019-01-13T16:03:19-07:00'
      return dateObject ? moment(dateObject).format() : dateObject;
    }
  };
  
  // assign custom properties and sequelize instance
  
  if (logConfig.schema) {
    db.schema = logConfig.schema;
  }
  
  db.sequelize = new Sequelize(logConfig.database, logConfig.username, logConfig.password, logConfig);
  
  // set common schema options for model definitions
  
  db.setOptions = (options) => {
    Object.assign(options, { timestamps: false });
    return db.schema ? Object.assign(options, { schema: db.schema }) : options;
  };
  
  db.logs = require('./logs')(db, DataTypes, logConfig.tableName || 'logs');
  db.connection_protection_logs = require('./connection_protection_logs')(db, DataTypes);

  return db;
};
