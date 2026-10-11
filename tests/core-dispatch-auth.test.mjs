import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  authenticateCoreDispatch,
  buildCoreDispatchPayload,
  CORE_DISPATCH_TARGET,
  MAX_DISPATCH_CLOCK_SKEW_MS
} from '../core-dispatch-auth.js';

function fixture({ target = CORE_DISPATCH_TARGET, timestamp = Date.now(), bodyPatch = {} } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const dispatchId = '22222222-2222-4222-8222-222222222222';
  const body = {
    dispatch_id: dispatchId,
    convocatoria_id: '11111111-1111-4111-8111-111111111111',
    ...bodyPatch
  };
  const serializedBody = JSON.stringify(body);
  const payload = buildCoreDispatchPayload({
    serviceId: target,
    timestamp,
    dispatchId,
    serializedBody
  });
  const signature = sign(null, Buffer.from(payload), privateKey).toString('base64url');
  return {
    publicKeyPem,
    serializedBody,
    timestamp,
    dispatchId,
    headers: {
      'x-arkhe-dispatch-target': target,
      'x-arkhe-dispatch-timestamp': String(timestamp),
      'x-arkhe-dispatch-id': dispatchId,
      'x-arkhe-dispatch-signature': signature
    }
  };
}

test('Atlas accepts a valid signature bound to exact body and audience', () => {
  const sample = fixture();
  const result = authenticateCoreDispatch({
    headers: sample.headers,
    serializedBody: sample.serializedBody,
    expectedServiceId: 'atlas',
    publicKeyPem: sample.publicKeyPem,
    now: sample.timestamp
  });
  assert.equal(result.serviceId, 'atlas');
  assert.equal(result.dispatchId, sample.dispatchId);
  assert.equal(result.convocatoriaId, '11111111-1111-4111-8111-111111111111');
});

test('Atlas rejects an altered body, wrong target, and stale signature', () => {
  const sample = fixture();
  assert.throws(() => authenticateCoreDispatch({
    headers: sample.headers,
    serializedBody: JSON.stringify({ ...JSON.parse(sample.serializedBody), convocatoria_id: '33333333-3333-4333-8333-333333333333' }),
    expectedServiceId: 'atlas',
    publicKeyPem: sample.publicKeyPem,
    now: sample.timestamp
  }), /Firma de despacho inválida/);

  const wrongTarget = { ...sample.headers, 'x-arkhe-dispatch-target': 'tekton' };
  assert.throws(() => authenticateCoreDispatch({
    headers: wrongTarget,
    serializedBody: sample.serializedBody,
    expectedServiceId: 'atlas',
    publicKeyPem: sample.publicKeyPem,
    now: sample.timestamp
  }), /no está dirigido/);

  assert.throws(() => authenticateCoreDispatch({
    headers: sample.headers,
    serializedBody: sample.serializedBody,
    expectedServiceId: 'atlas',
    publicKeyPem: sample.publicKeyPem,
    now: sample.timestamp + MAX_DISPATCH_CLOCK_SKEW_MS + 1
  }), /fuera de la ventana temporal/);
});

test('Atlas fails closed without a configured dispatch public key', () => {
  const sample = fixture();
  assert.throws(() => authenticateCoreDispatch({
    headers: sample.headers,
    serializedBody: sample.serializedBody,
    expectedServiceId: 'atlas',
    publicKeyPem: '',
    now: sample.timestamp
  }), /ARKHE_CORE_DISPATCH_PUBLIC_KEY no está configurado/);
});


test('Atlas HTTP receiver verifies, claims, and acknowledges before running research', async () => {
  const { readFileSync } = await import('node:fs');
  const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const routeStart = index.indexOf("if (req.method !== 'POST' || req.url !== '/arkhe/invocation')");
  const routeEnd = index.indexOf("\\nserver.listen(PORT", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, 'signed dispatch route bounds must exist');
  const route = index.slice(routeStart, routeEnd);

  assert.match(route, /authenticateCoreDispatch/);
  assert.match(route, /claim_convocation_dispatch/);
  assert.match(route, /res\.writeHead\(202/);
  assert.match(route, /setImmediate/);
  assert.doesNotMatch(route, /x-arkhe-core-token|autorizadoCore/);
  assert.ok(route.indexOf('claim_convocation_dispatch') < route.indexOf('res.writeHead(202'));
  assert.ok(route.indexOf('res.writeHead(202') < route.indexOf('setImmediate'));
});
