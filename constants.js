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
 * Log levels for debugging
 */
const LOG_LEVELS = Object.freeze({
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
});

/**
 * Colors used for logging messages in the console
 */
const LOG_COLORS = Object.freeze({
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  info: '\x1b[36m', // Cyan
  debug: '\x1b[90m', // Gray
  trace: '\x1b[35m', // Magenta
  reset: '\x1b[0m', // Reset
});

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
  allowedKeys: null, // An array of allowed keys. If you want to allow only certain keys in the object, you can specify the keys here. The keys must be strings. If a key is not in the allowedKeys array, it will be removed.
  deniedKeys: null, // An array of denied keys. If you want to deny certain keys in the object, you can specify the keys here. The keys must be strings. If a key is in the deniedKeys array, it will be removed.
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
  debug: {
    enabled: false,
    level: 'info', // 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
    logPatternMatches: false, // Log when patterns are matched
    logSanitizedValues: false, // Log before/after values
    logSkippedRoutes: false, // Log when routes are skipped
  },
});

module.exports = {
  PATTERNS,
  LOG_LEVELS,
  LOG_COLORS,
  DEFAULT_OPTIONS,
};
