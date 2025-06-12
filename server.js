const fastify = require('fastify');
const mongoSanitizePlugin = require('./index');

const fastifyInstance = fastify();
fastifyInstance.register(mongoSanitizePlugin, {
  debug: {
    enabled: true,
    level: 'trace',
  },
});

fastifyInstance.post('/debug', async (request, reply) => {
  console.log('coming');
  return request.body;
});

fastifyInstance.listen({ port: 3000 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Fastify server running on http://localhost:3000');
});
