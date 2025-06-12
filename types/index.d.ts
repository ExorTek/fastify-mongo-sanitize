import type { FastifyPluginCallback } from 'fastify';

export interface FastifyMongoSanitizeOptions {
  replaceWith?: string;
  removeMatches?: boolean;
  removeKeyMatches?: boolean;
  removeValueMatches?: boolean;
  sanitizeObjects?: string[];
  mode?: 'auto' | 'manual';
  skipRoutes?: string[];
  customSanitizer?: (original: any, options: FastifyMongoSanitizeOptions) => any;
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
  debug?: {
    enabled?: boolean;
    level?: 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    logPatternMatches?: boolean;
    logSanitizedValues?: boolean;
    logSkippedRoutes?: boolean;
  };
}

declare class FastifyMongoSanitizeError extends Error {
  constructor(message: string, type?: string);
  name: string;
  type: string;
}

import 'fastify';
declare module 'fastify' {
  interface FastifyRequest {
    sanitize?(options?: FastifyMongoSanitizeOptions): void;
  }
}

declare const fastifyMongoSanitize: FastifyPluginCallback<FastifyMongoSanitizeOptions>;

export default fastifyMongoSanitize;
export { FastifyMongoSanitizeError, fastifyMongoSanitize };
