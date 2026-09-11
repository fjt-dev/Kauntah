import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CounterDO } from '../src/counter.ts';
import app from '../src/index.ts';
import { CLIENT_IP_HEADER, extractOwner } from '../src/types.ts';

function createCounter(creationAllowed = true, limitGate = Promise.resolve()) {
  const values = new Map();
  const rateLimitKeys = [];
  let transactionQueue = Promise.resolve();
  const storage = {
    async get(key) {
      return values.get(key);
    },
    async put(key, value) {
      values.set(key, value);
    },
    transaction(closure) {
      const operation = transactionQueue.then(() => closure(storage));
      transactionQueue = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
  const ctx = {
    storage,
  };
  const env = {
    OWNER_RATE_LIMITER: {
      async limit({ key }) {
        rateLimitKeys.push(key);
        await limitGate;
        return { success: creationAllowed };
      },
    },
  };

  return { counter: new CounterDO(ctx, env), rateLimitKeys, values };
}

test('CounterDO returns 404 without mutating state for unknown paths', async () => {
  const { counter, rateLimitKeys, values } = createCounter();

  for (const path of ['/', '/increment/', '/current/', '/anything']) {
    const response = await counter.fetch(new Request(`https://do${path}`));
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Not Found');
  }

  assert.deepEqual(rateLimitKeys, []);
  assert.equal(values.has('count'), false);
});

test('new owner creation is limited by client IP, but existing owners do not consume the limit', async () => {
  const { counter, rateLimitKeys, values } = createCounter();
  const headers = { [CLIENT_IP_HEADER]: '203.0.113.8' };

  const first = await counter.fetch(new Request('https://do/increment', { headers }));
  assert.equal(first.status, 200);
  assert.equal(await first.text(), '1');
  assert.equal(first.headers.get('X-Count-Incremented'), 'true');

  const second = await counter.fetch(new Request('https://do/increment', { headers }));
  assert.equal(second.status, 200);
  assert.equal(await second.text(), '2');
  assert.deepEqual(rateLimitKeys, ['203.0.113.8']);
  assert.equal(values.get('count'), 2);
});

test('concurrent first requests each increment after sharing owner creation', async () => {
  let releaseLimit;
  const limitGate = new Promise((resolve) => {
    releaseLimit = resolve;
  });
  const { counter, rateLimitKeys, values } = createCounter(true, limitGate);
  const headers = { [CLIENT_IP_HEADER]: '192.0.2.7' };

  const responsePromises = Array.from({ length: 3 }, () =>
    counter.fetch(new Request('https://do/increment', { headers }))
  );
  await Promise.resolve();
  releaseLimit();

  const responses = await Promise.all(responsePromises);
  const counts = await Promise.all(responses.map((response) => response.text()));
  assert.deepEqual(counts, ['1', '2', '3']);
  assert.ok(responses.every((response) => response.status === 200));
  assert.ok(responses.every((response) => response.headers.get('X-Count-Incremented') === 'true'));
  assert.deepEqual(rateLimitKeys, ['192.0.2.7']);
  assert.equal(values.get('count'), 3);
});

test('a rejected owner creation does not initialize or increment the counter', async () => {
  const { counter, rateLimitKeys, values } = createCounter(false);
  const response = await counter.fetch(new Request('https://do/increment', {
    headers: { [CLIENT_IP_HEADER]: '198.51.100.4' },
  }));

  assert.equal(response.status, 429);
  assert.equal(await response.text(), '0');
  assert.equal(response.headers.get('X-Count-Incremented'), 'false');
  assert.deepEqual(rateLimitKeys, ['198.51.100.4']);
  assert.equal(values.has('count'), false);
});

test('current reads an uninitialized counter without creating an owner', async () => {
  const { counter, rateLimitKeys, values } = createCounter();
  const response = await counter.fetch(new Request('https://do/current'));

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '0');
  assert.equal(response.headers.get('X-Count-Incremented'), 'false');
  assert.deepEqual(rateLimitKeys, []);
  assert.equal(values.has('count'), false);
});

test('missing or invalid Referer does not resolve to a shared owner', () => {
  assert.equal(extractOwner(null), null);
  assert.equal(extractOwner('not a URL'), null);
  assert.equal(extractOwner('https://example.com/'), 'example.com');
});

test('a request without Referer renders zero without touching rate limits or Durable Objects', async () => {
  const unexpectedCall = () => {
    throw new Error('A request without Referer must not use owner-scoped bindings');
  };
  const pendingWrites = [];
  const env = {
    COUNTER: { idFromName: unexpectedCall, get: unexpectedCall },
    RATE_LIMITER: { limit: unexpectedCall },
    OWNER_RATE_LIMITER: { limit: unexpectedCall },
    IMAGE_CACHE: {
      async get() {
        return null;
      },
      async put() {},
    },
  };
  const executionCtx = {
    waitUntil(promise) {
      pendingWrites.push(promise);
    },
    passThroughOnException: unexpectedCall,
  };

  const response = await app.request('/counter', undefined, env, executionCtx);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Count-Incremented'), 'false');
  assert.match(await response.text(), /<use href="#d0"/);
  await Promise.all(pendingWrites);
});
