'use strict';

const fp = require('fastify-plugin');
const {
  isString,
  isArray,
  isPlainObject,
  isPrimitive,
  isDate,
  isEmail,
  cleanUrl,
  startTiming,
  log,
  validateOptions,
} = require('./helpers');
const FastifyMongoSanitizeError = require('./FastifyMongoSanitizeError');
const { DEFAULT_OPTIONS } = require('./constants');

/**
 * Sanitizes a string value according to provided options
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} isValue - Whether string is a value or key
 * @returns {string} Sanitized string
 */
const sanitizeString = (str, options, isValue = false) => {
  if (!isString(str) || isEmail(str)) {
    log(options.debug, 'trace', 'STRING', `Skipping sanitization (not string or is email): ${typeof str}`);
    return str;
  }

  const { replaceWith, patterns, stringOptions, debug } = options;
  const originalStr = str;
  let matchedPatterns = [];

  let result = patterns.reduce((acc, pattern, index) => {
    const matches = acc.match(pattern);
    if (matches) {
      matchedPatterns.push({ patternIndex: index, matches: matches.length });
      log(debug, 'debug', 'STRING', `Pattern ${index} matched ${matches.length} times in string`);
    }
    return acc.replace(pattern, replaceWith);
  }, str);

  if (stringOptions.trim) result = result.trim();
  if (stringOptions.lowercase) result = result.toLowerCase();
  if (stringOptions.maxLength && isValue) result = result.slice(0, stringOptions.maxLength);

  if (debug.logSanitizedValues && originalStr !== result) {
    log(debug, 'debug', 'STRING', 'String sanitized', {
      original: originalStr,
      sanitized: result,
      matchedPatterns,
    });
  }

  if (debug.logPatternMatches && matchedPatterns.length > 0) {
    log(debug, 'info', 'PATTERN', `Patterns matched in string`, matchedPatterns);
  }

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
  if (!isArray(arr)) {
    const error = new FastifyMongoSanitizeError('Input must be an array', 'type_error');
    log(options.debug, 'error', 'ARRAY', `Sanitization failed: ${error.message}`);
    throw error;
  }

  const { arrayOptions, debug } = options;
  const originalLength = arr.length;

  log(debug, 'trace', 'ARRAY', `Sanitizing array with ${originalLength} items`);

  let result = arr.map((item, index) => {
    log(debug, 'trace', 'ARRAY', `Sanitizing item ${index}`);
    return !options.recursive && (isPlainObject(item) || isArray(item)) ? item : sanitizeValue(item, options);
  });

  if (arrayOptions.filterNull) {
    const beforeFilter = result.length;
    result = result.filter(Boolean);
    const filtered = beforeFilter - result.length;
    if (filtered > 0) {
      log(debug, 'debug', 'ARRAY', `Filtered ${filtered} null/falsy values`);
    }
  }

  if (arrayOptions.distinct) {
    const beforeDistinct = result.length;
    result = [...new Set(result)];
    const duplicates = beforeDistinct - result.length;
    if (duplicates > 0) {
      log(debug, 'debug', 'ARRAY', `Removed ${duplicates} duplicate values`);
    }
  }

  log(debug, 'trace', 'ARRAY', `Array sanitization completed: ${originalLength} -> ${result.length} items`);

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
  if (!isPlainObject(obj)) {
    const error = new FastifyMongoSanitizeError('Input must be an object', 'type_error');
    log(options.debug, 'error', 'OBJECT', `Sanitization failed: ${error.message}`);
    throw error;
  }

  const { removeEmpty, allowedKeys, deniedKeys, removeMatches, patterns, debug } = options;
  const originalKeys = Object.keys(obj);

  log(debug, 'trace', 'OBJECT', `Sanitizing object with ${originalKeys.length} keys`);

  const result = Object.entries(obj).reduce((acc, [key, value]) => {
    if (allowedKeys && allowedKeys.length && !allowedKeys.includes(key)) {
      log(debug, 'debug', 'OBJECT', `Key '${key}' not in allowedKeys, removing`);
      return acc;
    }

    if (deniedKeys && deniedKeys.length && deniedKeys.includes(key)) {
      log(debug, 'debug', 'OBJECT', `Key '${key}' in deniedKeys, removing`);
      return acc;
    }

    const sanitizedKey = sanitizeString(key, options, false);

    if (isString(value) && isEmail(value)) {
      log(debug, 'trace', 'OBJECT', `Preserving email value for key '${key}'`);
      acc[sanitizedKey] = value;
      return acc;
    }

    if (
      removeMatches &&
      patterns.some((pattern) => {
        const matches = pattern.test(key);
        if (matches) {
          log(debug, 'debug', 'OBJECT', `Key '${key}' matches removal pattern`);
        }
        return matches;
      })
    ) {
      return acc;
    }

    if (removeEmpty && !sanitizedKey) {
      log(debug, 'debug', 'OBJECT', `Empty key removed after sanitization`);
      return acc;
    }

    if (
      removeMatches &&
      isString(value) &&
      patterns.some((pattern) => {
        const matches = pattern.test(value);
        if (matches) {
          log(debug, 'debug', 'OBJECT', `Value for key '${key}' matches removal pattern`);
        }
        return matches;
      })
    ) {
      return acc;
    }

    const sanitizedValue =
      !options.recursive && (isPlainObject(value) || isArray(value)) ? value : sanitizeValue(value, options, true);

    if (removeEmpty && !sanitizedValue) {
      log(debug, 'debug', 'OBJECT', `Empty value removed for key '${key}'`);
      return acc;
    }

    acc[sanitizedKey] = sanitizedValue;
    return acc;
  }, {});

  const finalKeys = Object.keys(result);
  log(debug, 'trace', 'OBJECT', `Object sanitization completed: ${originalKeys.length} -> ${finalKeys.length} keys`);

  return result;
};

/**
 * Sanitizes a value according to its type and provided options
 * @param {*} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} [isValue=false] - Whether value is a value or key
 * @returns {*} Sanitized value
 */
const sanitizeValue = (value, options, isValue) => {
  if (value == null || isPrimitive(value) || isDate(value)) return value;
  if (isString(value)) return sanitizeString(value, options, isValue);
  if (isArray(value)) return sanitizeArray(value, options);
  if (isPlainObject(value)) return sanitizeObject(value, options);
  return value;
};

/**
 * Handles request sanitization
 * @param {Object} request - Fastify request object
 * @param {Object} options - Sanitization options
 */
const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer, debug } = options;
  const endTiming = startTiming(debug, 'Request Sanitization');

  log(debug, 'info', 'REQUEST', `Sanitizing request: ${request.method} ${request.url}`);

  for (const sanitizeObject of sanitizeObjects) {
    if (request[sanitizeObject]) {
      log(debug, 'debug', 'REQUEST', `Sanitizing ${sanitizeObject}`, request[sanitizeObject]);

      const originalRequest = Object.assign({}, request[sanitizeObject]);

      if (customSanitizer) {
        log(debug, 'debug', 'REQUEST', `Using custom sanitizer for ${sanitizeObject}`);
        request[sanitizeObject] = customSanitizer(originalRequest);
      } else {
        request[sanitizeObject] = sanitizeValue(originalRequest, options);
      }

      if (debug.logSanitizedValues) {
        log(debug, 'debug', 'REQUEST', `${sanitizeObject} sanitized`, {
          before: originalRequest,
          after: request[sanitizeObject],
        });
      }
    }
  }

  endTiming();
  log(debug, 'info', 'REQUEST', `Request sanitization completed`);
};

/**
 * Fastify plugin for MongoDB query sanitization
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Plugin options
 * @param {Function} done - Callback to signal completion
 */
const fastifyMongoSanitize = (fastify, options, done) => {
  const opt = { ...DEFAULT_OPTIONS, ...options };

  log(opt.debug, 'info', 'PLUGIN', 'Initializing fastify-mongo-sanitize plugin', {
    mode: opt.mode,
    sanitizeObjects: opt.sanitizeObjects,
    skipRoutes: opt.skipRoutes,
    debugLevel: opt.debug.level,
  });

  validateOptions(opt);

  const skipRoutes = new Set((opt.skipRoutes || []).map(cleanUrl));
  log(opt.debug, 'debug', 'PLUGIN', `Skip routes configured: ${skipRoutes.size} routes`);

  if (opt.mode === 'manual') {
    log(opt.debug, 'info', 'PLUGIN', 'Manual mode enabled - decorating request with sanitize method');

    fastify.decorateRequest('sanitize', function (options = {}) {
      const mergedOptions = { ...opt, ...options };
      log(mergedOptions.debug, 'info', 'MANUAL', 'Manual sanitization triggered');
      handleRequest(this, mergedOptions);
    });
  }

  if (opt.mode === 'auto') {
    log(opt.debug, 'info', 'PLUGIN', 'Auto mode enabled - adding preHandler hook');

    fastify.addHook('preHandler', (request, reply, done) => {
      if (skipRoutes.size) {
        const url = cleanUrl(request.url);
        if (skipRoutes.has(url)) {
          if (opt.debug.logSkippedRoutes) {
            log(opt.debug, 'info', 'SKIP', `Route skipped: ${request.method} ${request.url}`);
          }
          return done();
        }
      }

      handleRequest(request, opt);
      done();
    });
  }

  log(opt.debug, 'info', 'PLUGIN', 'Plugin initialization completed');
  done();
};

module.exports = fp(fastifyMongoSanitize, {
  name: 'fastify-mongo-sanitize',
  fastify: '>=4.x.x',
});
module.exports.default = fastifyMongoSanitize;
module.exports.fastifyMongoSanitize = fastifyMongoSanitize;
