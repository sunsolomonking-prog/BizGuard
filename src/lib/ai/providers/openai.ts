import { supabase } from '../../supabase';
import { localAIProvider } from './local';
import type { AIProvider, BusinessAnalysisInput, BusinessAnalysisResult } from './types';

const invokeOpenAI = async (input: BusinessAnalysisInput, operation: string): Promise<BusinessAnalysisResult> => {
  const { data, error } = await supabase.functions.invoke<BusinessAnalysisResult>('bizguard-ai', {
    body: { provider: 'openai', operation, mode: input.mode, business_id: input.businessId, prompt: input.prompt, context: input.context },
  });
  if (error) throw error;
  if (!data || typeof data.summary !== 'string') throw new Error('OpenAI provider returned an invalid response.');
  return { ...data, provider: data.provider || 'openai' };
};
const withFallback = async (input: BusinessAnalysisInput, operation: string, fallback: () => Promise<BusinessAnalysisResult>) => { try { return await invokeOpenAI(input, operation); } catch { return fallback(); } };
export const openAIProvider: AIProvider = {
  ...localAIProvider,
  name: 'openai',
  analyzeBusiness: (input) => withFallback(input, 'analyzeBusiness', () => localAIProvider.analyzeBusiness(input)),
  generateRecommendations: (input) => withFallback(input, 'generateRecommendations', () => localAIProvider.generateRecommendations(input)),
  forecastCashflow: (input) => withFallback(input, 'forecastCashflow', () => localAIProvider.forecastCashflow(input)),
  evaluateExpansion: (input) => withFallback(input, 'evaluateExpansion', () => localAIProvider.evaluateExpansion(input)),
  generateMarketInsights: (input) => withFallback(input, 'generateMarketInsights', () => localAIProvider.generateMarketInsights(input)),
  predictCustomerPatronage: (input) => withFallback(input, 'predictCustomerPatronage', () => localAIProvider.predictCustomerPatronage(input)),
  generateCustomerActions: (input) => withFallback(input, 'generateCustomerActions', () => localAIProvider.generateCustomerActions(input)),
  runNeuralCore: (input) => withFallback(input, 'runNeuralCore', () => localAIProvider.runNeuralCore(input)),
  generateGrowthPlan: (input) => withFallback(input, 'generateGrowthPlan', () => localAIProvider.generateGrowthPlan(input)),
};
