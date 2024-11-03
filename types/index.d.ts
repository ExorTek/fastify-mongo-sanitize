import type { FastifyPluginCallback } from 'fastify';

export interface FastifyMongoSanitizeOptions {
  replaceWith?: string;
  sanitizeObjects?: ('body' | 'params' | 'query')[];
  enableLogs?: boolean;
  mode?: 'auto' | 'manual' | 'route';
  skipRoutes?: string[];
  customSanitizer?: (data: any) => any;
  recursive?: boolean;
  removeEmpty?: boolean;
  patterns?: RegExp[];
  allowedKeys?: string[] | null;
  deniedKeys?: string[] | null;
  stringOptions?: {
    trim?: boolean;
    lowercase?: boolean;
    maxLength?: number | null;
  };
  arrayOptions?: {
    filterNull?: boolean;
    distinct?: boolean;
  };
}

declare class FastifyMongoSanitizeError extends Error {
  constructor(message: string, type?: string);
  name: string;
  type: string;
}

declare const fastifyMongoSanitize: FastifyPluginCallback<FastifyMongoSanitizeOptions>;
export default fastifyMongoSanitize;
export { FastifyMongoSanitizeError, fastifyMongoSanitize };
