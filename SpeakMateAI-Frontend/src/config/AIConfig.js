/**
 * AI Provider Configurations for SpeakMate AI
 * All LLM provider keys and credentials are kept securely on the backend server.
 */

export const AI_PROVIDERS = {
  SPEAKMATE_BACKEND: 'speakmate_backend',
  MOCK: 'mock',
};

export const DEFAULT_AI_CONFIG = {
  provider: AI_PROVIDERS.SPEAKMATE_BACKEND,
  chatEndpoint: '/api/ai/chat',
  timeoutMs: 15000,
  systemPrompt: `You are SpeakMate AI, an empathetic, engaging, and friendly AI language practice partner. Keep your answers conversational, supportive, and concise (2-4 sentences max per reply so spoken feedback stays natural).`,
};
