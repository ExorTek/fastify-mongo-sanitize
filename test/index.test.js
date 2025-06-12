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

  test(`should remove matches body ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      removeMatches: true,
      sanitizeObjects: ['body'],
    });

    fastify.post('/remove-matches', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/remove-matches',
      payload: {
        username: '$admin',
        email: 'mail@mail.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      email: 'mail@mail.com',
    });
  });

  test(`should remove matches query ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      removeMatches: true,
      sanitizeObjects: ['query'],
    });

    fastify.get('/remove-matches', async (request, reply) => {
      return request.query;
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/remove-matches',
      query: {
        username: '$admin',
        email: 'mail@mail.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {
      email: 'mail@mail.com',
    });
  });

  test(`should remove matches params ${name}`, async () => {
    const fastify = Fastify();
    fastify.register(mongoSanitizePlugin, {
      removeMatches: true,
      sanitizeObjects: ['params'],
    });

    fastify.get('/remove-matches/:id', async (request, reply) => {
      return request.params;
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/remove-matches/$123',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = response.json();
    assert.deepStrictEqual(result, {});
  });

  test(`should skip routes with different slash and query variants ${name}`, async () => {
    const fastify = Fastify();

    fastify.register(mongoSanitizePlugin, {
      skipRoutes: ['/path', '/'],
    });

    fastify.post('/path', async (request, reply) => request.body);
    fastify.post('/path/', async (request, reply) => request.body); // Trailing slash için de ekle!
    fastify.post('/', async (request, reply) => request.body);

    let res = await fastify.inject({
      method: 'POST',
      url: '/path',
      payload: { $foo: 'bar' },
    });
    assert.deepStrictEqual(res.json(), { $foo: 'bar' });

    res = await fastify.inject({
      method: 'POST',
      url: '/path?test=123',
      payload: { $foo: 'bar' },
    });
    assert.deepStrictEqual(res.json(), { $foo: 'bar' });

    res = await fastify.inject({
      method: 'POST',
      url: '/path/',
      payload: { $foo: 'bar' },
    });
    assert.deepStrictEqual(res.json(), { $foo: 'bar' });

    res = await fastify.inject({
      method: 'POST',
      url: '/',
      payload: { $foo: 'bar' },
    });
    assert.deepStrictEqual(res.json(), { $foo: 'bar' });

    res = await fastify.inject({
      method: 'POST',
      url: '/?q=1',
      payload: { $foo: 'bar' },
    });
    assert.deepStrictEqual(res.json(), { $foo: 'bar' });

    await fastify.close();
  });

  test(`should NOT skip routes that are not in skipRoutes (should sanitize) ${name}`, async () => {
    const fastify = Fastify();

    fastify.register(mongoSanitizePlugin, {
      skipRoutes: ['/skipped'],
    });

    fastify.post('/sanitized', async (request, reply) => request.body);

    const res = await fastify.inject({
      method: 'POST',
      url: '/sanitized?foo=1',
      payload: { $evil: '123', good: '$ok' },
    });
    assert.deepStrictEqual(res.json(), { evil: '123', good: 'ok' });

    await fastify.close();
  });

  test('should not sanitize nested objects/arrays if recursive is false', async () => {
    const fastify = require('fastify')();
    fastify.register(mongoSanitizePlugin, {
      recursive: false,
    });

    fastify.post('/recursive-false', async (request, reply) => {
      return request.body;
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/recursive-false',
      payload: {
        username: '$admin',
        nested: { $danger: 'hack' },
        arr: [{ $hidden: 'bad' }],
      },
    });
    assert.deepStrictEqual(response.json(), {
      username: 'admin',
      nested: { $danger: 'hack' },
      arr: [{ $hidden: 'bad' }],
    });
  });
}
