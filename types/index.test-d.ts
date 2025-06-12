import fastify from 'fastify';
import mongoSanitize, { FastifyMongoSanitizeOptions } from '../';

const app = fastify();
app.register(mongoSanitize, {
  recursive: false,
  debug: { enabled: true, level: 'debug' },
} as FastifyMongoSanitizeOptions);

app.post('/test', async (req, reply) => {
  req.sanitize?.();
  return req.body;
});
