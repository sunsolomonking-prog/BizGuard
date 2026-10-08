import type { Json } from '../../database.types';

export type AIProviderName = 'local' | 'openai' | 'gemini' | 'claude';
export type AIMode = 'doctor' | 'ceo' | 'guardian' | 'cashflow' | 'market' | 'voice' | 'customer-predictor' | 'customer-future-intelligence' | 'customer-action-automation' | 'boardroom' | 'executive-briefing' | 'neural-core' | 'growth-engine';

export interface BusinessAnalysisInput {
  prompt: string;
  businessId: string;
  mode?: AIMode;
  context: Json;
}

export interface BusinessAnalysisResult {
  provider: AIProviderName;
  title: string;
  summary: string;
  confidence: number;
  risks: string[];
  recommendations: string[];
  actionPlan: string[];
  metrics: Record<string, string | number>;
}

export interface AIProvider {
  name: AIProviderName;
  analyzeBusiness(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  generateRecommendations(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  forecastCashflow(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  evaluateExpansion(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  generateMarketInsights(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  predictCustomerPatronage(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  generateCustomerActions(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  runNeuralCore(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  generateGrowthPlan(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
}
