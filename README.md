# @exortek/fastify-mongo-sanitize

A comprehensive Fastify plugin designed to protect your MongoDB queries from injection attacks by sanitizing request data.
Flexible options for request bodies, parameters, and query strings.
Supports JavaScript & TypeScript.


## Compatibility

| Plugin version | Fastify version |
|----------------|:---------------:|
| `^1.x`         |     `^4.x`      |
| `^1.x`         |     `^5.x`      |

## Key Features

- Automatic sanitization of potentially dangerous MongoDB operators and special characters
- Multiple operation modes (**auto**, **manual**)
- **Recursive** or single-level sanitization control
- Customizable sanitization patterns and replacement strategies
- Configurable string and array handling options
- Skip routes functionality with normalization
- Allowed/denied key whitelisting/blacklisting
- **Custom sanitizer** function support
- Full TypeScript types & Fastify request augmentation
- Detailed debug and logging options

## Installation

```bash
npm install @exortek/fastify-mongo-sanitize
```

OR

```bash
yarn add @exortek/fastify-mongo-sanitize
```

OR

```bash
pnpm add @exortek/fastify-mongo-sanitize
```

## Usage

Register the plugin with Fastify and specify the desired options.

```javascript
const fastify = require('fastify')({ logger: true });
const fastifyMongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(fastifyMongoSanitize);

fastify.post('/api', async (req, reply) => {
  // sanitized request.body, request.query, and request.params
  return req.body;
});

fastify.listen({ port: 3000 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening at ${address}`);
});
```

## TypeScript Usage

```typescript
import fastify from 'fastify';
import mongoSanitize from '@exortek/fastify-mongo-sanitize';

const app = fastify();

app.register(mongoSanitize, {
  recursive: false,
  debug: { enabled: true, level: 'debug' },
});

app.post('/test', async (req, reply) => {
  req.sanitize?.(); // TS'de otomatik olarak görünür!
  return req.body;
});
```

# Configuration Options

The plugin accepts various configuration options to customize its behavior. Here's a detailed breakdown of all available
options:

## Core Options

| Option            | Type           | Default                                            | Description                                                                                                                                                                                                                                                                               |
|-------------------|----------------|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `replaceWith`     | string         | `''`                                               | The string to replace the matched patterns with. Default is an empty string. If you want to replace the matched patterns with a different string, you can set this option.                                                                                                                |
| 'removeMatches'   | boolean        | `false`                                            | Remove the matched patterns. Default is false. If you want to remove the matched patterns instead of replacing them, you can set this option to true.                                                                                                                                     |
| `sanitizeObjects` | array          | `['body', 'params', 'query']`                      | The request properties to sanitize. Default is `['body', 'params', 'query']`. You can specify any request property that you want to sanitize. It must be an object.                                                                                                                       |
| `mode`            | string         | `'auto'`                                           | The mode of operation. Default is 'auto'. You can set this option to 'auto', 'manual'. If you set it to 'auto', the plugin will automatically sanitize the request objects. If you set it to 'manual', you can sanitize the request objects manually using the request.sanitize() method. |
| `skipRoutes`      | array          | `[]`                                               | An array of routes to skip. All entries and incoming request paths are normalized (leading/trailing slashes removed, query and fragment ignored). For example, adding `'/health'` will skip `/health`, `/health/`, and `/health?ping=1`.                                                  |                                                        |
| `customSanitizer` | function\|null | `null`                                             | A custom sanitizer function. Default is null. If you want to use a custom sanitizer function, you can specify it here. The function must accept two arguments: the original data and the options object. It must return the sanitized data.                                               |
| `recursive`       | boolean        | `true`                                             | Enable recursive sanitization. Default is true. If you want to recursively sanitize the nested objects, you can set this option to true.                                                                                                                                                  |
| `removeEmpty`     | boolean        | `false`                                            | Remove empty values. Default is false. If you want to remove empty values after sanitization, you can set this option to true.                                                                                                                                                            |
| `patterns`        | array          | `PATTERNS`                                         | An array of patterns to match. Default is an array of patterns that match illegal characters and sequences. You can specify your own patterns if you want to match different characters or sequences. Each pattern must be a regular expression.                                          |
| `allowedKeys`     | array\|null    | `null`                                             | An array of allowed keys. Default is null. If you want to allow only certain keys in the object, you can specify the keys here. The keys must be strings. If a key is not in the allowedKeys array, it will be removed.                                                                   |
| `deniedKeys`      | array\|null    | `null`                                             | An array of denied keys. Default is null. If you want to deny certain keys in the object, you can specify the keys here. The keys must be strings. If a key is in the deniedKeys array, it will be removed.                                                                               |
| `stringOptions`   | object         | `{ trim: false,lowercase: false,maxLength: null }` | An object that controls string sanitization behavior. Default is an empty object. You can specify the following options: `trim`, `lowercase`, `maxLength`.                                                                                                                                |
| `arrayOptions`    | object         | `{ filterNull: false, distinct: false}`            | An object that controls array sanitization behavior. Default is an empty object. You can specify the following options: `filterNull`, `distinct`.                                                                                                                                         |    
| `debug`           | object         | `{ enabled: false, level: 'info' }`                | Logging/debug options.                                                                                                                                                                                                                                                                    |    

> **Note on skipRoutes matching:**  
> All skipRoutes entries and request URLs are normalized before matching. This means:
> - Trailing and leading slashes (`/path`, `/path/`, `///path//`) are treated as the same.
> - Query strings and fragments are ignored (`/foo?bar=1`, `/foo#anchor` → `/foo`).
>
> For example, if you set `skipRoutes: ['/api/users']`, then all of the following will be skipped:
> - `/api/users`
> - `/api/users/`
> - `/api/users?role=admin`
> - `/api/users#tab`
>
> **Fastify's default behavior:**  
> Fastify treats `/foo` and `/foo/` as different routes. This plugin normalizes skipRoutes for skipping purposes only.  
> Make sure you have defined both routes in Fastify if you want both to respond.

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

## Operation Modes

### Mode: `auto`
Sanitization is performed automatically on every request for the configured properties `(body, params, query)`.

### Mode: `manual`

```javascript
fastify.register(fastifyMongoSanitize, { mode: 'manual' });

fastify.post('/api', async (req, reply) => {
  req.sanitize(); // Manual trigger!
  // ...
});
```

## Recursive Option
By default, `recursive` is `true`—all nested arrays and objects are sanitized.
To only sanitize the first level (top-level keys/values), set:

## Example Full Configuration

```javascript
fastify.register(require('@exortek/fastify-mongo-sanitize'), {
  replaceWith: '_',
  mode: 'manual',
  skipRoutes: ['/health', '/metrics'],
  recursive: true,
  removeEmpty: true,
  removeMatches: true, // Remove dangerous patterns completely
  stringOptions: {
    trim: true,
    maxLength: 100,
  },
  arrayOptions: {
    filterNull: true,
    distinct: true,
  },
  debug: {
    enabled: true,
    level: 'debug',
    logPatternMatches: true,
    logSanitizedValues: true,
    logSkippedRoutes: true,
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

> removeEmpty: Removes all falsy values ('', 0, false, null, undefined).
> Adjust this behavior if you need to preserve values like 0 or false.

## License

**[MIT](https://github.com/ExorTek/fastify-mongo-sanitize/blob/master/LICENSE)**<br>

Copyright © 2025 ExorTek
