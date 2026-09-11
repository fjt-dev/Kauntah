import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CounterDO } from '../src/counter.ts';
import app from '../src/index.ts';
import { CLIENT_IP_HEADER, extractOwner } from '../src/types.ts';

function createCounter(creationAllowed = true) {
  const values = new Map();
  const rateLimitKeys = [];
  const ctx = {
    storage: {
      async get(key) {
        return values.get(key);
      },
      async put(key, value) {
        values.set(key, value);
      },
    },
  };
  const env = {
    OWNER_RATE_LIMITER: {
      async limit({ key }) {
        rateLimitKeys.push(key);
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
