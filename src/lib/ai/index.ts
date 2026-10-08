import { supabase } from '../supabase';

export interface BizGuardAIResponse {
  summary: string;
  recommendations: string[];
  prompt?: string;
}

export const requestBizGuardAI = async (businessId: string, prompt: string): Promise<BizGuardAIResponse> => {
  const { data, error } = await supabase.functions.invoke<BizGuardAIResponse>('bizguard-ai', {
    body: { business_id: businessId, prompt },
  });

  if (error) throw error;
  if (!data) throw new Error('AI service returned no data');
  return data;
};

export const generateLocalBusinessInsight = (context: {
  lowStockCount?: number;
  revenue?: number;
  debtors?: number;
}) => {
  const recommendations: string[] = [];
  if ((context.lowStockCount || 0) > 0) recommendations.push('Restock low inventory items before demand spikes.');
  if ((context.debtors || 0) > 0) recommendations.push('Follow up on outstanding customer balances this week.');
  if ((context.revenue || 0) <= 0) recommendations.push('Record sales consistently to unlock demand forecasting.');
  if (recommendations.length === 0) recommendations.push('Business signals look healthy. Continue monitoring sales velocity and margins.');

  return {
    summary: 'BizGuard AI reviewed your current business signals and generated operational recommendations.',
    recommendations,
  };
};

export { getAIProvider } from './providers';
export type { AIProvider, AIProviderName, BusinessAnalysisInput, BusinessAnalysisResult } from './providers';
