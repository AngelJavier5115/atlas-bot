import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import {
  CORE_SERVICE_ID,
  buildServiceAuthHeaders,
  buildSigningPayload,
  coreRequest
} from '../arkhe-core-client.js';

function restoreEnv(name, previous) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

test('coreRequest signs the exact JSON body with the bot-specific Ed25519 identity', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const previousUrl = process.env.ARKHE_CORE_URL;
  const previousPrivateKey = process.env.ARKHE_SERVICE_PRIVATE_KEY;
  const previousSharedToken = process.env.ARKHE_CORE_TOKEN;
  const previousFetch = globalThis.fetch;
  const body = { action: 'obtener_convocatoria', convocatoria_id: '11111111-1111-4111-8111-111111111111' };
  let captured;

  process.env.ARKHE_CORE_URL = 'https://core.example.invalid/api/arkhe-core';
  process.env.ARKHE_SERVICE_PRIVATE_KEY = privateKeyPem;
  process.env.ARKHE_CORE_TOKEN = 'legacy-token-must-not-be-used-for-post';
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true, result: 'accepted-by-test-double' }) };
  };

  try {
    const result = await coreRequest(body);
    assert.equal(result.result, 'accepted-by-test-double');
    assert.equal(captured.url, process.env.ARKHE_CORE_URL);
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.body, JSON.stringify(body));
    assert.equal(captured.init.headers['x-arkhe-service-id'], CORE_SERVICE_ID);
    assert.equal(captured.init.headers['x-arkhe-core-token'], undefined);

    const timestamp = captured.init.headers['x-arkhe-timestamp'];
    const nonce = captured.init.headers['x-arkhe-nonce'];
    const signature = captured.init.headers['x-arkhe-signature'];
    const signingPayload = buildSigningPayload({
      timestamp,
      nonce,
      serializedBody: captured.init.body
    });
    assert.equal(
      verify(null, Buffer.from(signingPayload, 'utf8'), publicKey, Buffer.from(signature, 'base64url')),
      true
    );

    const changedBody = JSON.stringify({ ...body, convocatoria_id: '22222222-2222-4222-8222-222222222222' });
    const changedPayload = buildSigningPayload({ timestamp, nonce, serializedBody: changedBody });
    assert.equal(
      verify(null, Buffer.from(changedPayload, 'utf8'), publicKey, Buffer.from(signature, 'base64url')),
      false
    );
  } finally {
    restoreEnv('ARKHE_CORE_URL', previousUrl);
    restoreEnv('ARKHE_SERVICE_PRIVATE_KEY', previousPrivateKey);
    restoreEnv('ARKHE_CORE_TOKEN', previousSharedToken);
    globalThis.fetch = previousFetch;
  }
});

test('signed POST fails closed when no private service key is configured', () => {
  const previous = process.env.ARKHE_SERVICE_PRIVATE_KEY;
  delete process.env.ARKHE_SERVICE_PRIVATE_KEY;
  try {
    assert.throws(
      () => buildServiceAuthHeaders('{}'),
      /ARKHE_SERVICE_PRIVATE_KEY no está configurado/
    );
  } finally {
    restoreEnv('ARKHE_SERVICE_PRIVATE_KEY', previous);
  }
});

test('signed POST refuses a non-Ed25519 key', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  assert.throws(
    () => buildServiceAuthHeaders('{}', { privateKeyPem }),
    /debe ser una llave Ed25519/
  );
});
