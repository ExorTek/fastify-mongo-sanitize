'use strict';

const fp = require('fastify-plugin');

/**
 * Collection of regular expression patterns used for sanitization
 * @constant {RegExp[]}
 */
const PATTERNS = Object.freeze([
  /[\$]/g, // Finds all '$' (dollar) characters in the text.
  /\./g, // Finds all '.' (dot) characters in the text.
  /[\\\/{}.(*+?|[\]^)]/g, // Finds special characters (\, /, {, }, (, ., *, +, ?, |, [, ], ^, )) that need to be escaped.
  /[\u0000-\u001F\u007F-\u009F]/g, // Finds ASCII control characters (0x00-0x1F and 0x7F-0x9F range).
  /\{\s*\$|\$?\{(.|\r?\n)*\}/g, // Finds placeholders or variables in the format `${...}` or `{ $... }`.
]);

/**
 * Default configuration options for the plugin
 * @constant {Object}
 */
const DEFAULT_OPTIONS = Object.freeze({
  replaceWith: '',
  sanitizeObjects: ['body', 'params', 'query'],
  mode: 'auto',
  skipRoutes: [],
  customSanitizer: null,
  recursive: true,
  removeEmpty: false,
  patterns: PATTERNS,
  allowedKeys: null,
  deniedKeys: null,
  stringOptions: {
    trim: false,
    lowercase: false,
    maxLength: null,
  },
  arrayOptions: {
    filterNull: false,
    distinct: false,
  },
});

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

/**
 * Sanitizes a string value according to provided options
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} isValue - Whether string is a value or key
 * @returns {string} Sanitized string
 */
const sanitizeString = (str, options, isValue = false) => {
  if (!isString(str)) return str;

  const { replaceWith, patterns, stringOptions } = options;

  let result = patterns.reduce((acc, pattern) => acc.replace(pattern, replaceWith), str);

  if (stringOptions.trim) result = result.trim();
  if (stringOptions.lowercase) result = result.toLowerCase();
  if (stringOptions.maxLength && result.length > stringOptions.maxLength && isValue)
    result = result.slice(0, stringOptions.maxLength);

  return result;
};

/**
 * Sanitizes an array according to provided options
 * @param {Array} arr - Array to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Array} Sanitized array
 * @throws {FastifyMongoSanitizeError} If input is not an array
 */
const sanitizeArray = (arr, options) => {
  if (!isArray(arr)) throw new FastifyMongoSanitizeError('Input must be an array', 'type_error');

  const { arrayOptions } = options;
  let result = arr.map((item) => sanitizeValue(item, options));

  if (arrayOptions.filterNull) result = result.filter(Boolean);
  if (arrayOptions.distinct) result = [...new Set(result)];

  return result;
};

/**
 * Sanitizes an object according to provided options
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized object
 * @throws {FastifyMongoSanitizeError} If input is not an object
 */
const sanitizeObject = (obj, options) => {
  if (!isPlainObject(obj)) throw new FastifyMongoSanitizeError('Input must be an object', 'type_error');

  const { removeEmpty, allowedKeys, deniedKeys } = options;

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (allowedKeys?.length && !allowedKeys.includes(key)) return acc;
    if (deniedKeys?.length && deniedKeys.includes(key)) return acc;

    const sanitizedKey = sanitizeString(key, options, false);
    if (removeEmpty && !sanitizedKey) return acc;

    const sanitizedValue = sanitizeValue(value, options, true);
    if (removeEmpty && !sanitizedValue) return acc;

    acc[sanitizedKey] = sanitizedValue;
    return acc;
  }, {});
};

/**
 * Sanitizes a value according to its type and provided options
 * @param {*} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} isValue - Whether value is a value or key
 * @returns {*} Sanitized value
 */
const sanitizeValue = (value, options, isValue) => {
  if (!value) return value;
  if (isPrimitive(value)) return value;
  if (isDate(value)) return value;
  if (isPlainObject(value)) return sanitizeObject(value, options);
  if (isArray(value)) return sanitizeArray(value, options);
  if (isString(value)) return sanitizeString(value, options, isValue);
  return value;
};

/**
 * Validates plugin options
 * @param {Object} options - Options to validate
 * @throws {FastifyMongoSanitizeError} If any option is invalid
 */
const validateOptions = (options) => {
  const validators = {
    replaceWith: isString,
    sanitizeObjects: isArray,
    mode: (value) => ['auto', 'manual', 'route'].includes(value),
    skipRoutes: isArray,
    customSanitizer: (value) => value === null || isFunction(value),
    recursive: isPrimitive,
    removeEmpty: isPrimitive,
    patterns: isArray,
    allowedKeys: (value) => value === null || isArray(value),
    deniedKeys: (value) => value === null || isArray(value),
    stringOptions: isPlainObject,
    arrayOptions: isPlainObject,
  };

  for (const [key, validate] of Object.entries(validators)) {
    if (!validate(options[key])) {
      throw new FastifyMongoSanitizeError(`Invalid configuration: ${key}`, 'type_error');
    }
  }
};

/**
 * Checks if a value contains potentially malicious patterns
 * @param {*} value - Value to check
 * @param {RegExp[]} patterns - Patterns to check against
 * @returns {boolean} True if injection attempt detected
 */
const hasInjection = (value, patterns) => {
  if (isString(value)) return patterns.some((pattern) => pattern.test(value));
  if (isArray(value)) return value.some((item) => hasInjection(item, patterns));
  if (isPlainObject(value))
    return Object.entries(value).some(([key, val]) => hasInjection(key, patterns) || hasInjection(val, patterns));

  return false;
};

/**
 * Handles request sanitization
 * @param {Object} request - Fastify request object
 * @param {Object} options - Sanitization options
 */
const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer } = options;

  for (const sanitizeObject1 of sanitizeObjects) {
    if (request[sanitizeObject1]) {
      const originalData = request[sanitizeObject1];
      request[sanitizeObject1] = customSanitizer ? customSanitizer(originalData) : sanitizeValue(originalData, options);
    }
  }
};

/**
 * Fastify plugin for MongoDB query sanitization
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Plugin options
 * @param {Function} done - Callback to signal completion
 */
const fastifyMongoSanitize = (fastify, options, done) => {
  const opt = { ...DEFAULT_OPTIONS, ...options };

  validateOptions(opt);

  const skipRoutes = new Set(opt.skipRoutes);

  if (opt.mode === 'manual') {
    fastify.decorateRequest('sanitize', function (options) {
      handleRequest(this, { ...opt, ...options });
    });
  }

  if (opt.mode === 'auto') {
    fastify.addHook('preHandler', (request, reply, done) => {
      if (skipRoutes.has(request.url)) return done();
      handleRequest(request, opt);
      done();
    });
  }

  done();
};

module.exports = fp(fastifyMongoSanitize, {
  name: 'fastify-mongo-sanitize',
  fastify: '>=4.x.x',
});
module.exports.default = fastifyMongoSanitize;
module.exports.fastifyMongoSanitize = fastifyMongoSanitize;
