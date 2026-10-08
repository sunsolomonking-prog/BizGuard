import { claudeProvider } from './claude';
import { geminiProvider } from './gemini';
import { localAIProvider } from './local';
import { openAIProvider } from './openai';
import type { AIProvider, AIProviderName } from './types';
const providers: Record<AIProviderName, AIProvider> = { local: localAIProvider, openai: openAIProvider, gemini: geminiProvider, claude: claudeProvider };
export const getAIProvider = (name: AIProviderName = 'local') => providers[name] || localAIProvider;
export type { AIProvider, AIProviderName, AIMode, BusinessAnalysisInput, BusinessAnalysisResult } from './types';
