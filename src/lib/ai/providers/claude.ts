import { localAIProvider } from './local';
import type { AIProvider } from './types';
export const claudeProvider: AIProvider = { ...localAIProvider, name: 'claude' };
