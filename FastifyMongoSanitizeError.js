/**
 * Error class for FastifyMongoSanitize
 */
class FastifyMongoSanitizeError extends Error {
  /**
   * Creates a new FastifyMongoSanitizeError
   * @param {string} message - Error message
   * @param {string} [type='generic'] - Error type
   */
  constructor(message, type = 'generic') {
    super(message);
    this.name = 'FastifyMongoSanitizeError';
    this.type = type;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = FastifyMongoSanitizeError;
