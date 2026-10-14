import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlasModelCandidates } from '../model-routing.js';

test('OpenRouter free plan uses only the free router and explicitly free model IDs by default', () => {
  const candidates = buildAtlasModelCandidates({ openRouterConfigured: true });
  assert.deepEqual(candidates, [
    'openrouter/free',
    'openai/gpt-oss-20b:free',
  ]);
  assert.ok(candidates.every(model => model === 'openrouter/free' || model.endsWith(':free')));
});

test('A paid OPENROUTER_MODEL value cannot enter the OpenRouter fallback list', () => {
  const candidates = buildAtlasModelCandidates({
    openRouterConfigured: true,
    openRouterModel: 'openai/gpt-oss-20b',
    openAiModel: 'gpt-6-astra',
  });
  assert.deepEqual(candidates, [
    'openrouter/free',
    'openai/gpt-oss-20b:free',
  ]);
  assert.ok(!candidates.includes('openai/gpt-oss-20b'));
  assert.ok(!candidates.includes('gpt-6-astra'));
});

test('An explicitly free OpenRouter model is allowed but only free fallbacks remain', () => {
  const candidates = buildAtlasModelCandidates({
    openRouterConfigured: true,
    openRouterModel: 'openai/gpt-oss-20b:free',
  });
  assert.deepEqual(candidates, [
    'openai/gpt-oss-20b:free',
    'openrouter/free',
  ]);
  assert.ok(candidates.every(model => model === 'openrouter/free' || model.endsWith(':free')));
});

test('Non-OpenRouter routing preserves the existing OpenAI-compatible model sequence', () => {
  assert.deepEqual(buildAtlasModelCandidates({
    openRouterConfigured: false,
    openAiModel: 'test-openai-model',
  }), [
    'test-openai-model',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b:free',
  ]);
});
