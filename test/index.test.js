const { test } = require('node:test');
const assert = require('node:assert');
const Fastify = require('fastify');
const mongoSanitizePlugin = require('../index');

test('should sanitize request data with default options', async () => {
  const fastify = Fastify();
  fastify.register(mongoSanitizePlugin);

  fastify.post('/test', async (request, reply) => {
    return request.body;
  });

  const response = await fastify.inject({
    method: 'POST',
    url: '/test',
    payload: {
      username: { $ne: 'admin' },
      profile: { $regex: '.*' },
    },
  });

  assert.strictEqual(response.statusCode, 200);
  const result = response.json();
  assert.deepStrictEqual(result, {
    username: {
      ne: 'admin',
    },
    profile: {
      regex: '',
    },
  });

  await fastify.close();
});

test('should skip sanitization on specified routes', async () => {
  const fastify = Fastify();
  fastify.register(mongoSanitizePlugin, {
    skipRoutes: ['/skip'],
  });

  fastify.post('/skip', async (request, reply) => {
    return request.body;
  });

  fastify.post('/test', async (request, reply) => {
    return request.body;
  });

  const responseSkip = await fastify.inject({
    method: 'POST',
    url: '/skip',
    payload: {
      username: { $ne: 'admin' },
    },
  });

  assert.strictEqual(responseSkip.statusCode, 200);
  const resultSkip = responseSkip.json();
  assert.deepStrictEqual(resultSkip, {
    username: { ne: 'admin' },
  });

  const responseTest = await fastify.inject({
    method: 'POST',
    url: '/test',
    payload: {
      username: { $ne: 'admin' },
    },
  });

  assert.strictEqual(responseTest.statusCode, 200);
  const resultTest = responseTest.json();
  assert.deepStrictEqual(resultTest, {
    username: {
      ne: 'admin',
    },
  });

  await fastify.close();
});

test('should allow custom sanitizer function', async () => {
  const fastify = Fastify();
  fastify.register(mongoSanitizePlugin, {
    customSanitizer: (data) => {
      const newObj = {};
      for (const key in data) {
        if (typeof data[key] === 'object') {
          newObj[key] = data[key];
        } else {
          newObj[key] = data[key].replace('$', '');
        }
      }
      return newObj;
    },
  });

  fastify.post('/custom', async (request, reply) => {
    return request.body;
  });

  const response = await fastify.inject({
    method: 'POST',
    url: '/custom',
    payload: { username: '$admin' },
  });

  assert.strictEqual(response.statusCode, 200);
  const result = response.json();
  assert.deepStrictEqual(result, { username: 'admin' });

  await fastify.close();
});
