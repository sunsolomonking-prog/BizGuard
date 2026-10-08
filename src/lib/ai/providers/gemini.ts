import { localAIProvider } from './local';
import type { AIProvider } from './types';
export const geminiProvider: AIProvider = { ...localAIProvider, name: 'gemini' };
