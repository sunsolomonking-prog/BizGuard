import { claudeProvider } from './claude';
import { geminiProvider } from './gemini';
import { localAIProvider } from './local';
import { openAIProvider } from './openai';
import type { AIProvider, AIProviderName } from './types';
// BizGuard's default path is OpenAI-backed. The OpenAI adapter retains a safe
// rule-based fallback, so existing screens keep working during provider outages.
const providers: Record<AIProviderName, AIProvider> = { local: openAIProvider, openai: openAIProvider, gemini: geminiProvider, claude: claudeProvider };
export const getAIProvider = (name: AIProviderName = 'local') => providers[name] || localAIProvider;
export type { AIProvider, AIProviderName, AIMode, BusinessAnalysisInput, BusinessAnalysisResult } from './types';
