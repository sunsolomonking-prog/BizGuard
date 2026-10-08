import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Business, User, DashboardMetrics, Alert, ActionCard, AIAssistantMessage, VoiceUsageSummary, BusinessSubscriptionState } from '../types';

const STORE_DEBUG = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';
const logStore = (event: string, payload: Record<string, unknown>) => {
  if (STORE_DEBUG) console.info(`[BizGuard:store:${event}]`, payload);
};

interface AppState {
  // Business
  currentBusiness: Business | null;
  businesses: Business[];
  setCurrentBusiness: (business: Business | null) => void;
  setBusinesses: (businesses: Business[]) => void;
  resetBusinessState: () => void;

  // User
  user: User | null;
  setUser: (user: User | null) => void;
  clearSession: () => void;
  isAuthenticated: boolean;

  // Dashboard
  dashboardMetrics: DashboardMetrics | null;
  setDashboardMetrics: (metrics: DashboardMetrics) => void;

  // Alerts
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  markAlertAsRead: (alertId: string) => void;
  clearAlerts: () => void;

  // Action Cards
  actionCards: ActionCard[];
  addActionCard: (card: ActionCard) => void;
  completeActionCard: (cardId: string) => void;
  removeActionCard: (cardId: string) => void;

  // Subscription + Voice AI
  subscription: BusinessSubscriptionState | null;
  voiceUsage: VoiceUsageSummary | null;
  setSubscription: (subscription: BusinessSubscriptionState | null) => void;
  setVoiceUsage: (voiceUsage: VoiceUsageSummary | null) => void;

  // AI Assistant
  aiMessages: AIAssistantMessage[];
  addAiMessage: (message: AIAssistantMessage) => void;
  clearAiMessages: () => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Loading States
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Business
      currentBusiness: null,
      businesses: [],
      setCurrentBusiness: (business) => {
        logStore('setCurrentBusiness', { businessId: business?.id || null, businessName: business?.name || null });
        set({ currentBusiness: business });
      },
      setBusinesses: (businesses) => {
        logStore('setBusinesses', { count: businesses.length, businessIds: businesses.map((business) => business.id) });
        set({ businesses });
      },
      resetBusinessState: () => {
        logStore('resetBusinessState', {});
        set({ currentBusiness: null, businesses: [] });
      },

      // User
      user: null,
      setUser: (user) => {
        logStore('setUser', { userId: user?.id || null, userBusinessId: user?.businessId || null, isAuthenticated: !!user });
        set({ user, isAuthenticated: !!user });
      },
      clearSession: () => {
        logStore('clearSession', {});
        set({ user: null, isAuthenticated: false, currentBusiness: null, businesses: [], dashboardMetrics: null, alerts: [], actionCards: [], subscription: null, voiceUsage: null });
      },
      isAuthenticated: false,

      // Dashboard
      dashboardMetrics: null,
      setDashboardMetrics: (metrics) => set({ dashboardMetrics: metrics }),

      // Alerts
      alerts: [],
      addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
      markAlertAsRead: (alertId) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)),
        })),
      clearAlerts: () => set({ alerts: [] }),

      // Action Cards
      actionCards: [],
      addActionCard: (card) => set((state) => ({ actionCards: [card, ...state.actionCards] })),
      completeActionCard: (cardId) =>
        set((state) => ({
          actionCards: state.actionCards.map((c) => (c.id === cardId ? { ...c, completed: true } : c)),
        })),
      removeActionCard: (cardId) =>
        set((state) => ({ actionCards: state.actionCards.filter((c) => c.id !== cardId) })),

      // Subscription + Voice AI
      subscription: null,
      voiceUsage: null,
      setSubscription: (subscription) => set({ subscription }),
      setVoiceUsage: (voiceUsage) => set({ voiceUsage }),

      // AI Assistant
      aiMessages: [],
      addAiMessage: (message) => set((state) => ({ aiMessages: [...state.aiMessages, message] })),
      clearAiMessages: () => set({ aiMessages: [] }),

      // UI State
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Theme
      theme: 'light',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),

      // Loading States
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'bizguard-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        currentBusiness: state.currentBusiness,
        businesses: state.businesses,
      }),
    }
  )
);
