/**
 * Common error classes used by other projects.
 * Used by logging-module to return API responses.
 */

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

module.exports = {
  NotFoundError,
  ValidationError
};
