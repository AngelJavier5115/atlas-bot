import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATLAS_ID,
  EXPECTED_NODE_TEXTS,
  SMOKE_CONFIRMATION,
  TLACUILO_POLICY_ID,
  TLACUILO_SERVICE_ID,
  buildApprovedRelationBody,
  validateSmokeConfiguration,
} from '../scripts/semantic-relation-smoke.mjs';

function validEnv(overrides = {}) {
  return {
    ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE: SMOKE_CONFIRMATION,
    ARKHE_SERVICE_ID: TLACUILO_SERVICE_ID,
    ARKHE_CORE_URL: 'https://arkhe-dashboard-git-security-tlacuilo-delegation-arkhe7.vercel.app/api/semantic-relations',
    ARKHE_SERVICE_PRIVATE_KEY: 'test-only-placeholder-not-a-real-key',
    ARKHE_VERCEL_PROTECTION_BYPASS: 'test-only-placeholder',
    SUPABASE_URL: 'https://xbdbdwfzcuqqudrbapom.supabase.co',
    SUPABASE_KEY: 'test-only-placeholder',
    ...overrides,
  };
}

test('approved smoke body describes only the authorised existing nodes and does not invent a provider', () => {
  const body = buildApprovedRelationBody();
  assert.equal(body.action, 'create');
  assert.equal(body.source_node_id, 5);
  assert.equal(body.target_node_id, 6);
  assert.equal(body.relation_type, 'duplicates');
  assert.equal(body.evidence_node_id, null);
  assert.equal(body.evidence_uri, null);
  assert.equal(body.provider, null);
  assert.equal(body.model, null);
  assert.equal(body.run_ref, null);
  assert.match(body.assertion, /#5 y #6/);
  assert.match(body.evidence_text, /No se ha aportado una fuente externa/);
  assert.deepEqual(Object.keys(body).filter(key => /actor|investigador|origin|provenance/i.test(key)), []);
  assert.equal(EXPECTED_NODE_TEXTS[5], 'El uso de arquitecturas basadas en eventos optimiza la sincronización entre nodos en tiempo real.');
  assert.equal(EXPECTED_NODE_TEXTS[6], 'El uso de arquitecturas orientadas a eventos optimiza la sincronización en tiempo real.');
});

test('smoke cannot run unless the exact one-time confirmation is present', () => {
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE: undefined,
  })), /escritura está deshabilitada/);
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE: 'yes',
  })), /escritura está deshabilitada/);
});

test('smoke requires its own delegated executor identity, not Atlas or another investigator service', () => {
  assert.equal(TLACUILO_SERVICE_ID, 'tlacuilo');
  assert.equal(TLACUILO_POLICY_ID, 'tlacuilo-smoke-relation-5-6-duplicates-v1');
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_SERVICE_ID: 'atlas',
  })), /ARKHE_SERVICE_ID=tlacuilo/);
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_SERVICE_ID: 'aletheia',
  })), /ARKHE_SERVICE_ID=tlacuilo/);
});

test('smoke only accepts the exact branch Preview relation endpoint and never production', () => {
  assert.equal(validateSmokeConfiguration(validEnv()), true);
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_CORE_URL: 'https://arkhe-dashboard.vercel.app/api/semantic-relations',
  })), /exclusivamente.*Preview/);
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_CORE_URL: 'http://arkhe-dashboard-git-security-tlacuilo-delegation-arkhe7.vercel.app/api/semantic-relations',
  })), /exclusivamente.*Preview/);
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_CORE_URL: 'https://arkhe-dashboard-git-security-tlacuilo-delegation-arkhe7.vercel.app/api/arkhe-core',
  })), /exclusivamente.*Preview/);
});

test('smoke fails closed if either deployment protection or the read-only verification key is missing', () => {
  assert.throws(() => validateSmokeConfiguration(validEnv({
    ARKHE_VERCEL_PROTECTION_BYPASS: '',
  })), /ARKHE_VERCEL_PROTECTION_BYPASS/);
  assert.throws(() => validateSmokeConfiguration(validEnv({
    SUPABASE_KEY: '',
  })), /SUPABASE_KEY/);
});

test('executor identity remains distinct from delegated Atlas investigator identity', () => {
  assert.equal(ATLAS_ID, '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f');
  assert.equal(TLACUILO_SERVICE_ID, 'tlacuilo');
  assert.notEqual(TLACUILO_SERVICE_ID, 'atlas');
});
