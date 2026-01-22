const defaultGeminiModel = 'gemini-3-flash';
const defaultGeminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

function resolveLevelyLlmConfig({ overrides = {}, allowOverrides = false } = {}) {
  const sources = [];
  if (allowOverrides) {
    sources.push(cleanOverrides(overrides));
  }
  sources.push({
    apiKey: process.env.LEVELY_GEMINI_API_KEY,
    model: process.env.LEVELY_GEMINI_MODEL,
    baseUrl: process.env.LEVELY_GEMINI_BASE_URL,
  });

  const config = {
    apiKey: firstNonEmpty(sources.map((src) => src.apiKey)),
    model: firstNonEmpty(sources.map((src) => src.model)) || defaultGeminiModel,
    baseUrl: firstNonEmpty(sources.map((src) => src.baseUrl)) || defaultGeminiBaseUrl,
  };
  return config;
}

function cleanOverrides(overrides = {}) {
  return {
    apiKey: cleanString(overrides.apiKey),
    model: cleanString(overrides.model),
    baseUrl: cleanString(overrides.baseUrl),
  };
}

function cleanString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

module.exports = {
  resolveLevelyLlmConfig,
  defaultGeminiModel,
  defaultGeminiBaseUrl,
};
