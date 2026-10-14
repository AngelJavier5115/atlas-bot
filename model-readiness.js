export function inspectModelConfiguration({
  openRouterApiKey = '',
  openAiApiKey = '',
  openRouterModel = '',
  openAiModel = '',
} = {}) {
  const hasOpenRouterKey = typeof openRouterApiKey === 'string' && openRouterApiKey.trim().length > 0;
  const hasOpenAiKey = typeof openAiApiKey === 'string' && openAiApiKey.trim().length > 0;

  const provider = hasOpenRouterKey
    ? 'openrouter'
    : hasOpenAiKey
      ? 'openai-compatible'
      : 'none';

  const configured = provider !== 'none';
  const model = openRouterModel || openAiModel || 'openai/gpt-oss-20b';

  return {
    configured,
    provider,
    model: configured ? model : null,
    check: 'environment-variable-presence-only',
  };
}
