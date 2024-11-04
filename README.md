# @exortek/fastify-mongo-sanitize

A comprehensive Fastify plugin designed to protect your MongoDB queries from injection attacks by sanitizing request data. This plugin provides flexible sanitization options for request bodies, parameters, and query strings.

### Compatibility

| Plugin version | Fastify version |
|----------------|:---------------:|
| `^1.x`         |     `^4.x`      |
| `^1.x`         |     `^5.x`      |


### Key Features

- Automatic sanitization of potentially dangerous MongoDB operators and special characters.
- Multiple operation modes (auto, manual)
- Customizable sanitization patterns and replacement strategies
- Support for nested objects and arrays
- Configurable string and array handling options
- Skip routes functionality
- Custom sanitizer support

## Installation

```bash
npm install @exortek/fastify-mongo-sanitize
```

OR

```bash
yarn add @exortek/fastify-mongo-sanitize
```

## Usage

Register the plugin with Fastify and specify the desired options.

```javascript
const fastify = require('fastify')({ logger: true });
const fastifyMongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(fastifyMongoSanitize);

fastify.listen(3000, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on ${address}`);
});
```

# Configuration Options

The plugin accepts various configuration options to customize its behavior. Here's a detailed breakdown of all available options:

## Core Options

| Option            | Type           | Default                       | Description                                                                                                                                                                                                                                                                               |
|-------------------|----------------|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `replaceWith`     | string         | `''`                          | The string to replace the matched patterns with. Default is an empty string. If you want to replace the matched patterns with a different string, you can set this option.                                                                                                                |
| `sanitizeObjects` | array          | `['body', 'params', 'query']` | The request properties to sanitize. Default is `['body', 'params', 'query']`. You can specify any request property that you want to sanitize. It must be an object.                                                                                                                       |
| `mode`            | string         | `'auto'`                      | The mode of operation. Default is 'auto'. You can set this option to 'auto', 'manual'. If you set it to 'auto', the plugin will automatically sanitize the request objects. If you set it to 'manual', you can sanitize the request objects manually using the request.sanitize() method. |
| `skipRoutes`      | array          | `[]`                          | An array of routes to skip. Default is an empty array. If you want to skip certain routes from sanitization, you can specify the routes here. The routes must be in the format `/path`. For example, `['/health', '/metrics']`.                                                           |
| `customSanitizer` | function\|null | `null`                        | A custom sanitizer function. Default is null. If you want to use a custom sanitizer function, you can specify it here. The function must accept two arguments: the original data and the options object. It must return the sanitized data.                                               |
| `recursive`       | boolean        | `true`                        | Enable recursive sanitization. Default is true. If you want to recursively sanitize the nested objects, you can set this option to true.                                                                                                                                                  |
| `removeEmpty`     | boolean        | `false`                       | Remove empty values. Default is false. If you want to remove empty values after sanitization, you can set this option to true.                                                                                                                                                            |
| `patterns`        | array          | `PATTERNS`                    | An array of patterns to match. Default is an array of patterns that match illegal characters and sequences. You can specify your own patterns if you want to match different characters or sequences. Each pattern must be a regular expression.                                          |
| `allowedKeys`     | array\|null    | `null`                        | An array of allowed keys. Default is null. If you want to allow only certain keys in the object, you can specify the keys here. The keys must be strings. If a key is not in the allowedKeys array, it will be removed.                                                                   |
| `deniedKeys`      | array\|null    | `null`                        | An array of denied keys. Default is null. If you want to deny certain keys in the object, you can specify the keys here. The keys must be strings. If a key is in the deniedKeys array, it will be removed.                                                                               |
| `stringOptions`   | object         | `{}`                          | An object that controls string sanitization behavior. Default is an empty object. You can specify the following options: `trim`, `lowercase`, `maxLength`.                                                                                                                                |
| `arrayOptions`    | object         | `{}`                          | An object that controls array sanitization behavior. Default is an empty object. You can specify the following options: `filterNull`, `distinct`.                                                                                                                                         |    

## String Options

The `stringOptions` object controls string sanitization behavior:

```javascript
{
  trim: false,      // Whether to trim whitespace from start/end
  lowercase: false, // Whether to convert strings to lowercase
  maxLength: null   // Maximum allowed string length (null for no limit)
}
```

## Array Options

The `arrayOptions` object controls array sanitization behavior:

```javascript
{
  filterNull: false, // Whether to remove null/undefined values
  distinct: false    // Whether to remove duplicate values
}
```

## Example Configuration

```javascript
const fastify = require('fastify')();

fastify.register(require('fastify-mongo-sanitize'), {
  replaceWith: '_',
  mode: 'manual',
  skipRoutes: ['/health', '/metrics'],
  recursive: true,
  removeEmpty: true,
  stringOptions: {
    trim: true,
    maxLength: 100
  },
  arrayOptions: {
    filterNull: true,
    distinct: true
  }
});
```

## Notes

- All options are optional and will use their default values if not specified
- Custom patterns must be valid RegExp objects
- When using `allowedKeys` or `deniedKeys`, make sure to include all necessary keys for your application
- The `customSanitizer` function should be thoroughly tested before use in production
- String length limiting (`maxLength`) only applies to string values, not keys
- Array options are applied after all other sanitization steps
