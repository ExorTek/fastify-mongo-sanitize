'use strict';
const fp = require('fastify-plugin');

const PATTERNS = {
  operators: /[\$]/g,
  dots: /\./g,
  specialChars: /[\\\/{}.(*+?|[\]^)]/g,
  controlChars: /[\u0000-\u001F\u007F-\u009F]/g,
  injection: /\{\s*\$|\$?\{(.|\r?\n)*\}/g,
};

const DEFAULT_OPTIONS = {
  replaceWith: '', // Replace matched patterns with this string
  sanitizeObjects: ['body', 'params', 'query'], // Request properties to sanitize
  enableLogs: false, // Enable logging fastify logs
  mode: 'auto', // 'auto' | 'manual' | 'route' - 'auto' will sanitize all requests, 'manual' will require calling request.sanitize(), 'route' will sanitize only routes with routeOptions.sanitize = true
  skipRoutes: [], // Routes to skip sanitization when mode = 'auto' or 'route' (e.g. ['/health', '/metrics'])
  customSanitizer: null, // Custom sanitizer function to use instead of the built-in one
  recursive: true, // Recursively sanitize nested objects and arrays
  removeEmpty: false, // Remove empty strings and null values
  patterns: Object.values(PATTERNS), // Patterns to match and replace in regex
  allowedKeys: null, // Only allow these keys in objects
  deniedKeys: null, // Deny these keys in objects
  stringOptions: {
    // Options for string sanitization
    trim: true, // Trim whitespace
    lowercase: false, // Convert to lowercase
    maxLength: null, // Maximum length of string
  },
  arrayOptions: {
    // Options for array sanitization
    filterNull: false, // Remove null values
    distinct: false, // Remove duplicate values
  },
};

class FastifyMongoSanitizeError extends Error {
  constructor(message, type = 'generic') {
    super(message);
    this.name = 'FastifyMongoSanitizeError';
    this.type = type;
  }
}

const isString = (value) => typeof value === 'string';
const isPlainObject = (obj) =>
  obj !== null && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype;
const isArray = Array.isArray;
const isPrimitive = (value) => typeof value === 'number' || typeof value === 'boolean';
const isDate = (value) => value instanceof Date;

const sanitizeString = (str, options = {}) => {
  if (!isString(str)) return str;

  const { replaceWith = '', patterns = Object.values(PATTERNS), trim = true, lowercase = false, maxLength } = options;

  let result = patterns.reduce((acc, pattern) => acc.replace(pattern, replaceWith), str);

  if (trim) result = result.trim();
  if (lowercase) result = result.toLowerCase();
  if (maxLength) result = result.slice(0, maxLength);

  return result;
};

const sanitizeArray = (arr, options = {}) => {
  if (!isArray(arr)) {
    throw new FastifyMongoSanitizeError('Input must be an array', 'type_error');
  }

  const { recursive = true, filterNull = false, distinct = false } = options;
  let result = arr.map((item) => sanitizeValue(item, { ...options, recursive }));

  if (filterNull) result = result.filter((item) => item != null);
  if (distinct) result = [...new Set(result)];

  return result;
};

const sanitizeObject = (obj, options = {}) => {
  if (!isPlainObject(obj)) {
    throw new FastifyMongoSanitizeError('Input must be an object', 'type_error');
  }

  const { replaceWith = '', recursive = true, removeEmpty = false, allowedKeys = null, deniedKeys = null } = options;

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (allowedKeys?.length && !allowedKeys.includes(key)) return acc;
    if (deniedKeys?.length && deniedKeys.includes(key)) return acc;

    const sanitizedKey = sanitizeString(key, { replaceWith });
    if (removeEmpty && sanitizedKey === '') return acc;

    const sanitizedValue = sanitizeValue(value, { ...options, recursive });
    if (removeEmpty && (sanitizedValue === '' || sanitizedValue == null)) return acc;

    acc[sanitizedKey] = sanitizedValue;
    return acc;
  }, {});
};

const sanitizeValue = (value, options = {}) => {
  if (!value) return value;

  if (isPrimitive(value)) return value;
  if (isDate(value)) return value;
  if (isPlainObject(value)) return sanitizeObject(value, options);
  if (isArray(value)) return sanitizeArray(value, options);
  if (isString(value)) return sanitizeString(value, options);

  return value;
};

const testString = (str) => {
  if (!isString(str)) return false;
  return Object.values(PATTERNS).some((pattern) => pattern.test(str));
};

const testArray = (arr) => {
  if (!isArray(arr)) return false;
  return arr.some((item) => {
    if (isPlainObject(item)) return testObject(item);
    if (isArray(item)) return testArray(item);
    if (isString(item)) return testString(item);
    return false;
  });
};

const testObject = (obj) => {
  if (!isPlainObject(obj)) return false;
  return Object.entries(obj).some(([key, value]) => {
    if (testString(key)) return true;
    if (isPlainObject(value)) return testObject(value);
    if (isArray(value)) return testArray(value);
    if (isString(value)) return testString(value);
    return false;
  });
};

const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer, enableLogs } = options;

  for (const key of sanitizeObjects) {
    if (!request[key]) continue;

    try {
      const originalData = request[key];
      const sanitizedData = customSanitizer ? customSanitizer(originalData) : sanitizeValue(originalData, options);

      request[key] = sanitizedData;

      if (enableLogs) {
        request.log.info({
          msg: `Sanitized ${key}`,
          original: originalData,
          sanitized: sanitizedData,
        });
      }
    } catch (error) {
      request.log.error({
        msg: `Failed to sanitize ${key}`,
        error: error.message,
      });
      throw error;
    }
  }
};

const validateOptions = (options) => {
  const validators = {
    replaceWith: (value) => typeof value === 'string',
    sanitizeObjects: isArray,
    enableLogs: (value) => typeof value === 'boolean',
    mode: (value) => ['auto', 'manual', 'route'].includes(value),
    skipRoutes: isArray,
    customSanitizer: (value) => typeof value === 'function' || value === null,
    recursive: (value) => typeof value === 'boolean',
    removeEmpty: (value) => typeof value === 'boolean',
    patterns: isArray,
    allowedKeys: (value) => value === null || isArray(value),
    deniedKeys: (value) => value === null || isArray(value),
    stringOptions: (value) => value && typeof value === 'object',
    arrayOptions: (value) => value && typeof value === 'object',
  };

  for (const [key, validator] of Object.entries(validators)) {
    if (!validator(options[key])) {
      throw new FastifyMongoSanitizeError(`Invalid configuration: ${key}`, 'type_error');
    }
  }
};

const fastifyMongoSanitize = (fastify, options, done) => {
  if (!isPlainObject(options)) {
    throw new FastifyMongoSanitizeError('Options must be an object', 'type_error');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  validateOptions(config);

  const skipRoutes = new Set(config.skipRoutes);

  fastify.decorateRequest('sanitize', function () {
    handleRequest(this, config);
  });

  if (config.mode === 'auto' || config.mode === 'route') {
    fastify.addHook('preHandler', (request, reply, done) => {
      if (skipRoutes.has(request.routerPath)) return done();
      if (config.mode === 'route' && !request.routeOptions?.sanitize) return done();

      try {
        handleRequest(request, config);
        done();
      } catch (error) {
        done(error);
      }
    });
  }

  if (config.mode === 'route') {
    fastify.decorateRequest('routeOptions', null);
    fastify.addHook('onRoute', (routeOptions) => {
      routeOptions.sanitize ??= false;
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
