import type { FastifyInstance } from 'fastify';
import fastifyMongoSanitize, { FastifyMongoSanitizeOptions, FastifyMongoSanitizeError } from './index';

declare const instance: FastifyInstance;

instance.register(fastifyMongoSanitize);

instance.register(fastifyMongoSanitize, {
  replaceWith: '',
  removeMatches: true,
  sanitizeObjects: ['body', 'params', 'query'],
  mode: 'auto',
  skipRoutes: ['/health'],
  customSanitizer: null,
  recursive: true,
  removeEmpty: false,
  patterns: [/test/g],
  allowedKeys: ['allowed'],
  deniedKeys: ['denied'],
  stringOptions: {
    trim: true,
    lowercase: true,
    maxLength: 100,
  },
  arrayOptions: {
    filterNull: true,
    distinct: true,
  },
} satisfies FastifyMongoSanitizeOptions);

new FastifyMongoSanitizeError('test error', 'test_type');

export { fastifyMongoSanitize, FastifyMongoSanitizeOptions, FastifyMongoSanitizeError };
