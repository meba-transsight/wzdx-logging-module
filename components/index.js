const { NotFoundError, ValidationError } = require('./classes');

module.exports = {
  NotFoundError,
  ValidationError,
  sendEmail: require('./sendEmail'),
  sendHealthCheckEmail: require('./sendHealthCheckEmail')
};
