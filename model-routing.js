export function buildAtlasModelCandidates({
  openRouterConfigured = false,
  openRouterModel = '',
  openAiModel = '',
} = {}) {
  if (openRouterConfigured) {
    const requested = typeof openRouterModel === 'string' ? openRouterModel.trim() : '';
    const requestedIsExplicitlyFree =
      requested === 'openrouter/free' ||
      (requested.includes('/') && requested.endsWith(':free'));
    const preferred = requestedIsExplicitlyFree ? requested : 'openrouter/free';

    // Never fall back to a paid model when OpenRouter is the configured provider.
    return [...new Set([
      preferred,
      'openrouter/free',
      'openai/gpt-oss-20b:free',
    ])];
  }

  // Keep the existing OpenAI-compatible provider path unchanged.
  const requested = typeof openAiModel === 'string' ? openAiModel.trim() : '';
  const preferred = requested || 'openai/gpt-oss-20b';
  return [...new Set([
    preferred,
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b:free',
  ])];
}
