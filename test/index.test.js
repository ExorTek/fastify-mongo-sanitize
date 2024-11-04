const Fastify5 = require('fastify');
const Fastify4 = require('fastify4');
const { test } = require('node:test');
const assert = require('node:assert');
const mongoSanitizePlugin = require('../index');

const fastifyVersions = [
  {
    name: 'Fastify v4',
    instance: Fastify4,
  },
  {
    name: 'Fastify v5',
    instance: Fastify5,
  },
];

for (const version of fastifyVersions) {
  const { name, instance: Fastify } = version;
  test(`should handle nested objects and arrays ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      enableLogs: true,
    });

    fastify.post('/nested', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/nested',
      payload: {
        user: {
          username: '$admin',
          $password: '$secre.t',
          preferences: { $set: ['admin'] },
          history: [{ $push: 'log' }, { $inc: 5 }],
          details: {
            nested: { $where: 'javascript' },
          },
        },
      },
    });
    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      user: {
        username: 'admin',
        password: 'secret',
        preferences: { set: ['admin'] },
        history: [{ push: 'log' }, { inc: 5 }],
        details: {
          nested: { where: 'javascript' },
        },
      },
    });

    await fastify.close();
  });

  test(`should handle different request properties (query, params) ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin);

    fastify.get('/search/:id', async (request, reply) => {
      return {
        params: request.params,
        query: request.query,
      };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/search/$123?filter[$regex]=admin',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      params: { id: '123' },
      query: { filterregex: 'admin' },
    });

    await fastify.close();
  });

  test(`should respect stringOptions configuration ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      stringOptions: {
        trim: true,
        lowercase: true,
        maxLength: 5,
      },
    });

    fastify.post('/string-options', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/string-options',
      payload: {
        text: '  $HELLO WORLD  ',
        nested: { value: '  $TEST  ' },
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      text: 'hello',
      nested: { value: 'test' },
    });

    await fastify.close();
  });

  test(`should handle array options correctly ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      arrayOptions: {
        filterNull: true,
        distinct: true,
      },
    });

    fastify.post('/array-options', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/array-options',
      payload: {
        items: ['$test', '$test', null, '$value', null],
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      items: ['test', 'value'],
    });

    await fastify.close();
  });

  test(`should respect allowedKeys ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      allowedKeys: ['username', 'email'],
      patterns: [/[\$]/g],
    });

    fastify.post('/allowed-keys', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/allowed-keys',
      payload: {
        username: '$admin',
        email: 'test@example.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      username: 'admin',
      email: 'test@example.com',
    });

    await fastify.close();
  });

  test(`should respect deniedKeys ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      deniedKeys: ['password', 'email'],
    });

    fastify.post('/denied-keys', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/denied-keys',
      payload: {
        username: '$admin',
        email: 'test@example.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      username: 'admin',
      role: 'super',
    });
  });

  test(`should handle manual mode correctly ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      mode: 'manual',
    });

    fastify.post('/manual', async (request, reply) => {
      request.sanitize();
      return request.body;
    });

    fastify.post('/no-sanitize', async (request, reply) => {
      return request.body;
    });

    const responseSanitized = await fastify.inject({
      method: 'POST',
      url: '/manual',
      payload: { query: { $ne: null } },
    });

    const responseUnsanitized = await fastify.inject({
      method: 'POST',
      url: '/no-sanitize',
      payload: { query: { $ne: null } },
    });

    assert.strictEqual(responseSanitized.statusCode, 200);
    assert.strictEqual(responseUnsanitized.statusCode, 200);

    const resultSanitized = responseSanitized.json();
    const resultUnsanitized = responseUnsanitized.json();

    assert.deepStrictEqual(resultSanitized, { query: { ne: null } });
    assert.deepStrictEqual(resultUnsanitized, { query: { $ne: null } });

    await fastify.close();
  });
}
