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
  replaceWith: '', // The string to replace the matched patterns with. Default is an empty string. If you want to replace the matched patterns with a different string, you can set this option.
  removeMatches: false, // Remove the matched patterns. Default is false. If you want to remove the matched patterns instead of replacing them, you can set this option to true.
  sanitizeObjects: ['body', 'params', 'query'], // The request properties to sanitize. Default is ['body', 'params', 'query']. You can specify any request property that you want to sanitize. It must be an object.
  mode: 'auto', // The mode of operation. Default is 'auto'. You can set this option to 'auto', 'manual'. If you set it to 'auto', the plugin will automatically sanitize the request objects. If you set it to 'manual', you can sanitize the request objects manually using the request.sanitize() method.
  skipRoutes: [], // An array of routes to skip. Default is an empty array. If you want to skip certain routes from sanitization, you can specify the routes here. The routes must be in the format '/path'. For example, ['/health', '/metrics'].
  customSanitizer: null, // A custom sanitizer function. Default is null. If you want to use a custom sanitizer function, you can specify it here. The function must accept two arguments: the original data and the options object. It must return the sanitized data.
  recursive: true, // Enable recursive sanitization. Default is true. If you want to recursively sanitize the nested objects, you can set this option to true.
  removeEmpty: false, // Remove empty values. Default is false. If you want to remove empty values after sanitization, you can set this option to true.
  patterns: PATTERNS, // An array of patterns to match. Default is an array of patterns that match illegal characters and sequences. You can specify your own patterns if you want to match different characters or sequences. Each pattern must be a regular expression.
  allowedKeys: [], // An array of allowed keys. Default is array. If you want to allow only certain keys in the object, you can specify the keys here. The keys must be strings. If a key is not in the allowedKeys array, it will be removed.
  deniedKeys: [], // An array of denied keys. Default is array. If you want to deny certain keys in the object, you can specify the keys here. The keys must be strings. If a key is in the deniedKeys array, it will be removed.
  stringOptions: {
    // String sanitization options.
    trim: false, // Trim whitespace. Default is false. If you want to trim leading and trailing whitespace from the string, you can set this option to true.
    lowercase: false, // Convert to lowercase. Default is false. If you want to convert the string to lowercase, you can set this option to true.
    maxLength: null, // Maximum length. Default is null. If you want to limit the maximum length of the string, you can set this option to a number. If the string length exceeds the maximum length, it will be truncated.
  },
  arrayOptions: {
    // Array sanitization options.
    filterNull: false, // Filter null values. Default is false. If you want to remove null values from the array, you can set this option to true.
    distinct: false, // Remove duplicate values. Default is false. If you want to remove duplicate values from the array, you can set this option to true.
  },
});

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
  if (!isString(str) || isEmail(str)) return str;

  const { replaceWith, patterns, stringOptions } = options;

  let result = patterns.reduce((acc, pattern) => acc.replace(pattern, replaceWith), str);

  if (stringOptions.trim) result = result.trim();
  if (stringOptions.lowercase) result = result.toLowerCase();
  if (stringOptions.maxLength && isValue) result = result.slice(0, stringOptions.maxLength);

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

  const { removeEmpty, allowedKeys, deniedKeys, removeMatches, patterns } = options;

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (allowedKeys?.length && !allowedKeys.includes(key)) return acc;

    if (deniedKeys?.length && deniedKeys.includes(key)) return acc;

    const sanitizedKey = sanitizeString(key, options, false);

    if (isString(value) && isEmail(value)) {
      acc[sanitizedKey] = value;
      return acc;
    }

    if (removeMatches && patterns.some((pattern) => pattern.test(key))) return acc;

    if (removeEmpty && !sanitizedKey) return acc;

    if (removeMatches && isString(value) && patterns.some((pattern) => pattern.test(value))) return acc;

    const sanitizedValue = sanitizeValue(value, options, true);

    if (removeEmpty && !sanitizedValue) return acc;

    acc[sanitizedKey] = sanitizedValue;
    return acc;
  }, {});
};

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
 * Sanitizes a value according to its type and provided options
 * @param {*} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} [isValue=false] - Whether value is a value or key
 * @returns {*} Sanitized value
 */
const sanitizeValue = (value, options, isValue) => {
  if (!value || isPrimitive(value) || isDate(value)) return value;
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
  };

  for (const [key, validate] of Object.entries(validators)) {
    if (!validate(options[key])) {
      throw new FastifyMongoSanitizeError(`Invalid configuration: ${key}`, 'type_error');
    }
  }
};

/**
 * Handles request sanitization
 * @param {Object} request - Fastify request object
 * @param {Object} options - Sanitization options
 */
const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer } = options;

  for (const sanitizeObject of sanitizeObjects) {
    if (request[sanitizeObject]) {
      const originalRequest = Object.assign({}, request[sanitizeObject]);
      request[sanitizeObject] = customSanitizer
        ? customSanitizer(originalRequest)
        : sanitizeValue(originalRequest, options);
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

  const skipRoutes = new Set((opt.skipRoutes || []).map(cleanUrl));

  if (opt.mode === 'manual') {
    fastify.decorateRequest('sanitize', function (options) {
      handleRequest(this, { ...opt, ...options });
    });
  }

  if (opt.mode === 'auto') {
    fastify.addHook('preHandler', (request, reply, done) => {
      if (skipRoutes.size) {
        const url = cleanUrl(request.url);
        if (skipRoutes.has(url)) return done();
      }
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
