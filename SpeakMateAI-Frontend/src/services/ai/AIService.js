/**
 * AIService
 * Abstract LLM Connector layer supporting SpeakMate AI backend endpoints & fallback mock AI responses.
 */

import { DEFAULT_AI_CONFIG, AI_PROVIDERS } from '../../config/AIConfig';
import api from '../api';

export class AIService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  /**
   * Send user text prompt to AI provider and return textual response
   * @param {string} prompt User message text
   * @param {Array} history Conversation history array [{role, content}]
   */
  async generateResponse(prompt, history = []) {
    if (!prompt || !prompt.trim()) return '';

    try {
      if (this.config.provider === AI_PROVIDERS.SPEAKMATE_BACKEND) {
        return await this._callBackend(prompt, history);
      } else {
        return this._generateMockResponse(prompt);
      }
    } catch (err) {
      console.warn('[AIService] Backend AI call failed, falling back to graceful local response:', err);
      return this._generateMockResponse(prompt);
    }
  }

  async _callBackend(prompt, history = []) {
    const endpoint = this.config.chatEndpoint || '/api/ai/chat';
    const response = await api.post(endpoint, {
      prompt,
      history,
      systemPrompt: this.config.systemPrompt,
    });

    const data = response?.data;
    return (
      data?.response ||
      data?.reply ||
      data?.message ||
      'I am listening! How can I help you practice your English today?'
    );
  }

  _generateMockResponse(prompt) {
    const lower = prompt.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi')) {
      return "Hello! I am your SpeakMate AI assistant. I'm excited to practice English speaking with you today! How are you feeling?";
    } else if (lower.includes('name')) {
      return "I am SpeakMate AI, your personal real-time Live2D language companion!";
    } else if (lower.includes('how are you')) {
      return "I'm doing wonderful! Ready to help you master speaking with full confidence!";
    } else if (lower.includes('grammar') || lower.includes('vocabulary')) {
      return "That's great! Practicing daily conversation is the fastest way to improve your grammar and vocabulary.";
    } else {
      return `That is very interesting! You said: "${prompt}". Tell me more about that!`;
    }
  }
}
