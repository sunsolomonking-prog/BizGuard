import { supabase } from './supabase';
import type { Json } from './database.types';

export type EventSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorSource = 'frontend' | 'api' | 'supabase' | 'voice_ai' | 'ai_assistant' | 'database' | 'unknown';

const sessionId = (() => {
  const key = 'bizguard-session-id';
  const existing = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, id);
  return id;
})();

export const trackFeatureUsage = async (params: { businessId?: string | null; userId?: string | null; feature: string; eventName: string; metadata?: Json }) => {
  try {
    await supabase.from('user_analytics_events').insert({
      business_id: params.businessId || null,
      user_id: params.userId || null,
      feature: params.feature,
      event_name: params.eventName,
      session_id: sessionId,
      metadata: params.metadata || {},
    });
  } catch {
    // Non-blocking analytics.
  }
};

export const captureErrorEvent = async (params: { businessId?: string | null; userId?: string | null; source?: ErrorSource; severity?: EventSeverity; error: unknown; context?: Json }) => {
  const error = params.error instanceof Error ? params.error : new Error(String(params.error));
  try {
    await supabase.from('error_events').insert({
      business_id: params.businessId || null,
      user_id: params.userId || null,
      source: params.source || 'frontend',
      severity: params.severity || 'medium',
      message: error.message,
      stack: error.stack || null,
      context: params.context || {},
    });
  } catch {
    // Non-blocking error telemetry fallback.
    console.error('[BizGuard:error-tracking-failed]', error);
  }
};

export const trackPerformanceMetric = async (params: { businessId?: string | null; page: string; metricName: string; metricValue: number; metadata?: Json }) => {
  const rating = params.metricValue < 1000 ? 'good' : params.metricValue < 3000 ? 'needs_improvement' : 'poor';
  try {
    await supabase.from('performance_events').insert({
      business_id: params.businessId || null,
      page: params.page,
      metric_name: params.metricName,
      metric_value: params.metricValue,
      rating,
      metadata: params.metadata || {},
    });
  } catch {
    // Non-blocking performance telemetry.
  }
};

export const logBusinessEvent = async (params: { businessId: string; userId?: string | null; eventType: string; entityType?: string; entityId?: string; description?: string; metadata?: Json }) => {
  try {
    await supabase.from('business_events').insert({
      business_id: params.businessId,
      actor_id: params.userId || null,
      event_type: params.eventType,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      description: params.description || null,
      metadata: params.metadata || {},
    });
  } catch {
    // Non-blocking observability.
  }
};

export const setupGlobalErrorTracking = (getContext: () => { businessId?: string | null; userId?: string | null }) => {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    const context = getContext();
    captureErrorEvent({ ...context, source: 'frontend', severity: 'high', error: event.error || event.message, context: { filename: event.filename, lineno: event.lineno, colno: event.colno } });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const context = getContext();
    captureErrorEvent({ ...context, source: 'frontend', severity: 'high', error: event.reason || 'Unhandled promise rejection' });
  });
};
