const { LOG_LEVELS, LOG_COLORS } = require('./constants');
const FastifyMongoSanitizeError = require('./FastifyMongoSanitizeError');

/**
 * Enhanced logging function with timing and context
 * @param {Object} debugOpts - Debug options containing enabled status and log level
 * @param {string} level - Log level (error, warn, info, debug, trace)
 * @param {string} context - Context information (e.g., function name, operation)
 * @param {string} message - Log message
 * @param {*} data - Optional data to log
 */
const log = (debugOpts, level, context, message, data = null) => {
  if (!debugOpts?.enabled || LOG_LEVELS[debugOpts.level || 'silent'] < LOG_LEVELS[level]) return;

  const color = LOG_COLORS[level] || '';
  const reset = LOG_COLORS.reset;
  const timestamp = new Date().toISOString();

  let logMessage = `${color}[mongo-sanitize:${level.toUpperCase()}]${reset} ${timestamp} [${context}] ${message}`;

  if (data !== null) {
    if (typeof data === 'object') {
      console.log(logMessage);
      console.log(`${color}Data:${reset}`, JSON.stringify(data, null, 2));
    } else {
      console.log(logMessage, data);
    }
  } else {
    console.log(logMessage);
  }
};

/**
 * Performance timing utility
 * @param {Object} debugOpts - Debug options
 * @param {string} operation - Operation name
 * @returns {Function} End timing function
 */
const startTiming = (debugOpts, operation) => {
  const start = process.hrtime();
  log(debugOpts, 'trace', 'TIMING', `Started: ${operation}`);

  return () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const milliseconds = seconds * 1000 + nanoseconds / 1000000;
    log(debugOpts, 'trace', 'TIMING', `Completed: ${operation} in ${milliseconds.toFixed(2)}ms`);
  };
};

/**
 * Checks if value is a valid email address
 * @param {string} val - Value to check
 * @returns {boolean} True if value is a valid email address
 */
const isEmail = (val) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(val);

/**
 * Checks if value is a string
 * @param {*} value - Value to check
 * @returns {boolean} True if value is string
 */
const isString = (value) => typeof value === 'string';

/**
 * Checks if value is a plain object
 * @param {*} obj - Value to check
 * @returns {boolean} True if value is plain object
 */
const isPlainObject = (obj) => !!obj && Object.prototype.toString.call(obj) === '[object Object]';

/**
 * Checks if value is an array
 * @param {*} value - Value to check
 * @returns {boolean} True if value is array
 */
const isArray = (value) => Array.isArray(value);

/**
 * Checks if value is a primitive (null, number, or boolean)
 * @param {*} value - Value to check
 * @returns {boolean} True if value is primitive
 */
const isPrimitive = (value) => value === null || ['number', 'boolean'].includes(typeof value);

/**
 * Checks if value is a Date object
 * @param {*} value - Value to check
 * @returns {boolean} True if value is Date
 */
const isDate = (value) => value instanceof Date;

/**
 * Checks if value is a function
 * @param {*} value - Value to check
 * @returns {boolean} True if value is function
 */
const isFunction = (value) => typeof value === 'function';

/**
 * Cleans a URL by removing leading and trailing slashes
 * @param {string} url - URL to clean
 * @returns {string|null} Cleaned URL or null if input is invalid
 */
const cleanUrl = (url) => {
  if (typeof url !== 'string' || !url) return null;
  const [path] = url.split(/[?#]/);
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed ? '/' + trimmed : null;
};

/**
 * Validators for plugin options
 * @constant {Object}
 * @property {Function} replaceWith - Validates that replaceWith is a string
 * @property {Function} removeMatches - Validates that removeMatches is a primitive (boolean or null)
 * @property {Function} sanitizeObjects - Validates that sanitizeObjects is an array
 * @property {Function} mode - Validates that mode is either 'auto' or 'manual'
 * @property {Function} skipRoutes - Validates that skipRoutes is an array
 * @property {Function} customSanitizer - Validates that customSanitizer is either null or a function
 * @property {Function} recursive - Validates that recursive is a primitive (boolean or null)
 * @property {Function} removeEmpty - Validates that removeEmpty is a primitive (boolean or null)
 * @property {Function} patterns - Validates that patterns is an array
 * @property {Function} allowedKeys - Validates that allowedKeys is either null or an array
 * @property {Function} deniedKeys - Validates that deniedKeys is either null or an array
 * @property {Function} stringOptions - Validates that stringOptions is a plain object
 * @property {Function} arrayOptions - Validates that arrayOptions is a plain object
 * @property {Function} debug - Validates that debug is a plain object with expected properties
 * @returns {Object} Object containing validation functions for each option
 */
const validators = Object.freeze({
  replaceWith: isString,
  removeMatches: isPrimitive,
  sanitizeObjects: isArray,
  mode: (value) => ['auto', 'manual'].includes(value),
  skipRoutes: isArray,
  customSanitizer: (value) => value === null || isFunction(value),
  recursive: isPrimitive,
  removeEmpty: isPrimitive,
  patterns: isArray,
  allowedKeys: (value) => value === null || isArray(value),
  deniedKeys: (value) => value === null || isArray(value),
  stringOptions: isPlainObject,
  arrayOptions: isPlainObject,
  debug: isPlainObject,
});

/**
 * Validates plugin options
 * @param {Object} options - Options to validate
 * @throws {FastifyMongoSanitizeError} If any option is invalid
 */
const validateOptions = (options) => {
  for (const [key, validate] of Object.entries(validators)) {
    if (!validate(options[key])) {
      throw new FastifyMongoSanitizeError(`Invalid configuration: ${key}`, 'type_error');
    }
  }
};

module.exports = {
  log,
  startTiming,
  isEmail,
  isString,
  isPlainObject,
  isArray,
  isPrimitive,
  isDate,
  isFunction,
  cleanUrl,
  validateOptions,
};
