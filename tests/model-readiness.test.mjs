import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectModelConfiguration } from '../model-readiness.js';

test('Model readiness identifies OpenRouter without exposing the configured key', () => {
  const result = inspectModelConfiguration({
    openRouterApiKey: 'synthetic-secret-value',
    openRouterModel: 'openai/gpt-oss-20b',
    openAiModel: 'gpt-6-astra',
  });
  assert.deepEqual(result, {
    configured: true,
    provider: 'openrouter',
    model: 'openrouter/free',
    routing_policy: 'free-models-only',
    check: 'environment-variable-presence-only',
  });
  assert.equal(JSON.stringify(result).includes('synthetic-secret-value'), false);
});

test('Model readiness supports the OpenAI-compatible fallback without exposing its key', () => {
  const result = inspectModelConfiguration({
    openAiApiKey: 'synthetic-openai-secret',
    openAiModel: 'test-model',
  });
  assert.equal(result.configured, true);
  assert.equal(result.provider, 'openai-compatible');
  assert.equal(result.model, 'test-model');
  assert.equal(JSON.stringify(result).includes('synthetic-openai-secret'), false);
});

test('Model readiness fails closed when neither provider key is present', () => {
  assert.deepEqual(inspectModelConfiguration({}), {
    configured: false,
    provider: 'none',
    model: null,
    check: 'environment-variable-presence-only',
  });
});

test('HTTP model readiness diagnostic is preview-only, rate limited, read-only and makes no model call', () => {
  const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const start = index.indexOf("if (req.url === '/arkhe/diagnostics/model-readiness')");
  const end = index.indexOf("res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });", start);
  assert.ok(start >= 0 && end > start, 'model readiness route bounds must exist');
  const route = index.slice(start, end);
  assert.match(route, /ARKHE_A4_PREVIEW_NO_DISCORD !== 'true'/);
  assert.match(route, /lastModelReadinessAt < 30000/);
  assert.match(route, /Cache-Control': 'no-store'/);
  assert.match(route, /inspectModelConfiguration/);
  assert.match(route, /no se llamó al proveedor ni se validó la clave/);
  assert.doesNotMatch(route, /chat\.completions\.create/);
  assert.doesNotMatch(route, /OPENROUTER_API_KEY:\s*process\.env/);
});
