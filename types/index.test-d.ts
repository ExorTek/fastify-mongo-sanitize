import { FastifyInstance } from 'fastify';
import { FastifyMongoSanitizeOptions } from './index';

declare const Fastify: () => FastifyInstance;
declare const mongoSanitizePlugin: FastifyMongoSanitizeOptions;

export { Fastify, mongoSanitizePlugin };
