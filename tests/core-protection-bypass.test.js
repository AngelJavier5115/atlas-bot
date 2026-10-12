import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoreProtectionHeaders } from '../arkhe-core-client.js';

const previewUrl = 'https://arkhe-dashboard-git-security-a4-idempotent-completion-arkhe7.vercel.app/api/arkhe-core';

test('Vercel bypass header is sent only to the exact protected Preview Core endpoint', () => {
  assert.deepEqual(
    buildCoreProtectionHeaders({
      url: previewUrl,
      bypassSecret: 'test-secret-not-real',
      previewMode: 'true'
    }),
    { 'x-vercel-protection-bypass': 'test-secret-not-real' }
  );
});

test('Vercel bypass header is omitted outside Discord-disabled Preview mode', () => {
  assert.deepEqual(
    buildCoreProtectionHeaders({
      url: previewUrl,
      bypassSecret: 'test-secret-not-real',
      previewMode: 'false'
    }),
    {}
  );
});

test('Vercel bypass header is omitted for production or unrelated URLs', () => {
  for (const url of [
    'https://arkhe-dashboard.vercel.app/api/arkhe-core',
    'https://example.com/api/arkhe-core',
    'http://arkhe-dashboard-git-security-a4-idempotent-completion-arkhe7.vercel.app/api/arkhe-core',
    previewUrl + '?unexpected=1'
  ]) {
    assert.deepEqual(
      buildCoreProtectionHeaders({
        url,
        bypassSecret: 'test-secret-not-real',
        previewMode: 'true'
      }),
      {},
      'bypass must not be attached for ' + url
    );
  }
});

test('Vercel bypass header is omitted when no secret is configured', () => {
  assert.deepEqual(
    buildCoreProtectionHeaders({
      url: previewUrl,
      bypassSecret: '',
      previewMode: 'true'
    }),
    {}
  );
});
