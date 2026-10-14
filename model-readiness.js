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
  const requestedOpenRouterModel = typeof openRouterModel === 'string' ? openRouterModel.trim() : '';
  const isExplicitlyFreeOpenRouterModel =
    requestedOpenRouterModel === 'openrouter/free' ||
    (requestedOpenRouterModel.includes('/') && requestedOpenRouterModel.endsWith(':free'));
  const model = provider === 'openrouter'
    ? (isExplicitlyFreeOpenRouterModel ? requestedOpenRouterModel : 'openrouter/free')
    : provider === 'openai-compatible'
      ? (typeof openAiModel === 'string' && openAiModel.trim() ? openAiModel.trim() : 'openai/gpt-oss-20b')
      : null;

  return {
    configured,
    provider,
    model,
    ...(provider === 'openrouter' ? { routing_policy: 'free-models-only' } : {}),
    check: 'environment-variable-presence-only',
  };
}
