'use strict';
const fp = require('fastify-plugin');

const ILLEGAL_PATTERNS = {
  operators: /[\$]/g,
  dots: /\./g,
  specialChars: /[\\\/{}.(*+?|[\]^)]/g,
  controlChars: /[\u0000-\u001F\u007F-\u009F]/g,
  injection: /\{\s*\$|\$?\{(.|\r?\n)*\}/g,
};

const DEFAULT_OPTIONS = {
  replaceWith: '',
  sanitizeObjects: ['body', 'params', 'query'],
  enableLogs: false,
  mode: 'auto', // auto, manual, route
  skipRoutes: [], // ['/health', '/metrics']
  customSanitizer: null,
  recursive: true,
  removeEmpty: false,
  patterns: Object.values(ILLEGAL_PATTERNS), // {key: /pattern/}
  allowedKeys: null, // ['key']
  deniedKeys: null, // ['key']
  stringOptions: {
    trim: true, // trim string
    lowercase: false, // convert string to lowercase
    maxLength: null, // max length of string
  },
  arrayOptions: {
    filterNull: false, // remove null values from array
    distinct: false, // remove duplicate values from array
  },
};

class SanitizeError extends Error {
  constructor(message, type = 'generic') {
    super(message);
    this.name = 'FastifyMongoSanitizeError';
    this.type = type;
  }
}

const typeChecks = {
  isString: (value) => typeof value === 'string',
  isPlainObject: (obj) => obj !== null && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype,
  isArray: Array.isArray,
  isNumberOrBoolean: (value) => typeof value === 'number' || typeof value === 'boolean',
  isDate: (value) => value instanceof Date,
};

const sanitizeString = (str, options = {}) => {
  if (!typeChecks.isString(str)) {
    return str;
  }

  const {
    replaceWith = '',
    patterns = Object.values(ILLEGAL_PATTERNS),
    trim = true,
    lowercase = false,
    maxLength,
  } = options;

  let result = str;

  patterns.forEach((pattern) => {
    result = result.replace(pattern, replaceWith);
  });

  if (trim) result = result.trim();
  if (lowercase) result = result.toLowerCase();
  if (maxLength) result = result.slice(0, maxLength);

  return result;
};

const sanitizeValue = (value, options = {}) => {
  if (!value) return value;

  if (typeChecks.isNumberOrBoolean(value)) {
    return value;
  }

  if (typeChecks.isDate(value)) {
    return value;
  }

  if (typeChecks.isPlainObject(value)) {
    return sanitizeObject(value, options);
  }

  if (typeChecks.isArray(value)) {
    return sanitizeArray(value, options);
  }

  if (typeChecks.isString(value)) {
    return sanitizeString(value, options);
  }

  return value;
};

const sanitizeArray = (arr, options = {}) => {
  if (!typeChecks.isArray(arr)) {
    throw new SanitizeError('Input must be an array', 'type_error');
  }

  const { recursive = true, filterNull = false, distinct = false } = options;

  let result = arr.map((item) => sanitizeValue(item, { ...options, recursive }));

  if (filterNull) {
    result = result.filter((item) => item != null);
  }

  if (distinct) {
    result = [...new Set(result)];
  }

  return result;
};

const sanitizeObject = (obj, options = {}) => {
  if (!typeChecks.isPlainObject(obj)) {
    throw new SanitizeError('Input must be an object', 'type_error');
  }

  const { replaceWith = '', recursive = true, removeEmpty = false, allowedKeys = null, deniedKeys = null } = options;

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    if (allowedKeys && !allowedKeys.includes(key)) continue;
    if (deniedKeys && deniedKeys.includes(key)) continue;

    const sanitizedKey = sanitizeString(key, { replaceWith });

    if (removeEmpty && sanitizedKey === '') continue;

    const sanitizedValue = sanitizeValue(value, { ...options, recursive });

    if (removeEmpty && (sanitizedValue === '' || sanitizedValue == null)) continue;

    result[sanitizedKey] = sanitizedValue;
  }

  return result;
};

const testString = (str) => {
  if (!typeChecks.isString(str)) return false;
  return Object.values(ILLEGAL_PATTERNS).some((pattern) => pattern.test(str));
};

const testArray = (arr) => {
  if (!typeChecks.isArray(arr)) return false;
  return arr.some((item) => {
    if (typeChecks.isPlainObject(item)) return testObject(item);
    if (typeChecks.isArray(item)) return testArray(item);
    if (typeChecks.isString(item)) return testString(item);
    return false;
  });
};

const testObject = (obj) => {
  if (!typeChecks.isPlainObject(obj)) return false;

  return Object.entries(obj).some(([key, value]) => {
    const keyHasIllegalPattern = testString(key);
    if (keyHasIllegalPattern) return true;

    if (typeChecks.isPlainObject(value)) return testObject(value);
    if (typeChecks.isArray(value)) return testArray(value);
    if (typeChecks.isString(value)) return testString(value);
    return false;
  });
};

const sanitize = (input, options = {}) => {
  try {
    return sanitizeValue(input, options);
  } catch (error) {
    if (error instanceof SanitizeError) {
      throw error;
    }
    return input;
  }
};

const validateOptions = (options) => {
  const validationRules = {
    replaceWith: (value) => typeof value === 'string',
    sanitizeObjects: (value) => Array.isArray(value),
    enableLogs: (value) => typeof value === 'boolean',
    mode: (value) => typeof value === 'string',
    skipRoutes: (value) => Array.isArray(value),
    customSanitizer: (value) => typeof value === 'function' || value === null,
    recursive: (value) => typeof value === 'boolean',
    removeEmpty: (value) => typeof value === 'boolean',
    patterns: (value) => Array.isArray(value),
    allowedKeys: (value) => value === null || Array.isArray(value),
    deniedKeys: (value) => value === null || Array.isArray(value),
    stringOptions: (value) => typeof value === 'object',
    arrayOptions: (value) => typeof value === 'object',
  };

  for (const [key, validate] of Object.entries(validationRules)) {
    if (!validate(options[key])) {
      throw new SanitizeError(`${key} is invalid`, 'type_error');
    }
  }
};

const sanitizeRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer, enableLogs } = options;

  for (const key of sanitizeObjects) {
    if (request[key]) {
      try {
        const originalData = request[key];
        const sanitizedData = customSanitizer ? customSanitizer(originalData) : sanitize(originalData, options);

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
  }
};

const mongoSanitize = (fastify, options, done) => {
  if (typeof options !== 'object') throw new SanitizeError('Options must be an object', 'type_error');
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);

  validateOptions(opts);

  const skipRoutes = new Set(opts.skipRoutes);

  fastify.decorateRequest('sanitize', function () {
    sanitizeRequest(this, opts);
  });

  if (opts.mode === 'auto' || opts.mode === 'route') {
    fastify.addHook('preHandler', (request, reply, done) => {
      if (skipRoutes.has(request.routerPath)) {
        return done();
      }

      if (opts.mode === 'route' && !request.routeOptions.sanitize) {
        return done();
      }

      try {
        sanitizeRequest(request, opts);
        done();
      } catch (error) {
        done(error);
      }
    });
  }

  if (opts.mode === 'route') {
    fastify.decorateRequest('routeOptions', null);
    fastify.addHook('onRoute', (routeOptions) => {
      if (routeOptions.sanitize === undefined) {
        routeOptions.sanitize = false;
      }
    });
  }

  done();
};

module.exports = fp(mongoSanitize, {
  name: 'fastify-mongo-sanitize',
  fastify: '>=4.x.x',
});
