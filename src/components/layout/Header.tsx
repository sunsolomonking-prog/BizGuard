import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  User,
  LogOut,
  Globe2,
  Sparkles,
  Volume2,
  X,
  Zap,
  Target,
  ShieldCheck,
  ArrowUpRight,
  Clock3,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../utils/cn';
import { signOut, supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { getExecutiveDailyBriefing } from '../../lib/neuralCore';

interface HeaderProps {
  onMenuClick?: () => void;
}


const HEADER_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN', timezone: 'Africa/Lagos', locale: 'en' },
  { code: 'NO', name: 'Norway', currency: 'NOK', timezone: 'Europe/Oslo', locale: 'en' },
  { code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York', locale: 'en' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London', locale: 'en' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', timezone: 'Europe/Dublin', locale: 'en' },
  { code: 'DE', name: 'Germany', currency: 'EUR', timezone: 'Europe/Berlin', locale: 'en' },
  { code: 'FR', name: 'France', currency: 'EUR', timezone: 'Europe/Paris', locale: 'fr' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', timezone: 'Europe/Lisbon', locale: 'pt' },
  { code: 'ES', name: 'Spain', currency: 'EUR', timezone: 'Europe/Madrid', locale: 'es' },
  { code: 'CA', name: 'Canada', currency: 'CAD', timezone: 'America/Toronto', locale: 'en' },
  { code: 'AU', name: 'Australia', currency: 'AUD', timezone: 'Australia/Sydney', locale: 'en' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', timezone: 'Pacific/Auckland', locale: 'en' },
  { code: 'IN', name: 'India', currency: 'INR', timezone: 'Asia/Kolkata', locale: 'en' },
  { code: 'KE', name: 'Kenya', currency: 'KES', timezone: 'Africa/Nairobi', locale: 'en' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', timezone: 'Africa/Accra', locale: 'en' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', timezone: 'Africa/Johannesburg', locale: 'en' },
  { code: 'JP', name: 'Japan', currency: 'JPY', timezone: 'Asia/Tokyo', locale: 'en' },
  { code: 'CN', name: 'China', currency: 'CNY', timezone: 'Asia/Shanghai', locale: 'en' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', timezone: 'Europe/Zurich', locale: 'en' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', timezone: 'Asia/Dubai', locale: 'ar' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', timezone: 'America/Sao_Paulo', locale: 'pt' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', timezone: 'America/Mexico_City', locale: 'es' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', timezone: 'Asia/Singapore', locale: 'en' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', timezone: 'Asia/Hong_Kong', locale: 'en' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', timezone: 'Europe/Stockholm', locale: 'en' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', timezone: 'Europe/Copenhagen', locale: 'en' },
  { code: 'PL', name: 'Poland', currency: 'PLN', timezone: 'Europe/Warsaw', locale: 'en' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', timezone: 'Asia/Riyadh', locale: 'ar' },
  { code: 'TR', name: 'Türkiye', currency: 'TRY', timezone: 'Europe/Istanbul', locale: 'en' },
] as const;

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const {
    theme,
    toggleTheme,
    alerts,
    markAlertAsRead,
    user,
    setUser,
    currentBusiness,
  } = useAppStore();

  const [countryCode, setCountryCode] = React.useState('');
  const [savingCountry, setSavingCountry] = React.useState(false);
  const [countryError, setCountryError] = React.useState('');
  const businessId = currentBusiness?.id;
  React.useEffect(() => {
    let cancelled = false;
    const loadCountryPreference = async () => {
      if (!businessId || !user?.id) { setCountryCode(''); return; }
      const { data, error } = await supabase
        .from('global_market_preferences')
        .select('country_code')
        .eq('business_id', businessId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && !error && data?.country_code) setCountryCode(data.country_code);
    };
    void loadCountryPreference();
    return () => { cancelled = true; };
  }, [businessId, user?.id]);

  const handleCountryChange = async (code: string) => {
    setCountryCode(code);
    setCountryError('');
    if (!businessId || !user?.id || !code) {
      setCountryError('Select an active business and sign in to save this preference.');
      return;
    }
    const country = HEADER_COUNTRIES.find((item) => item.code === code);
    if (!country) return;
    setSavingCountry(true);
    const { error } = await supabase.from('global_market_preferences').upsert({
      business_id: businessId,
      user_id: user.id,
      country_code: country.code,
      reporting_currency: country.currency,
      locale: country.locale,
      timezone: country.timezone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,user_id' });
    setSavingCountry(false);
    if (error) {
      setCountryError('Could not save country. Open Global Market Readiness and try again.');
      toast.error('Could not save country and regional preferences.');
      return;
    }

    // Publish the saved market preference for other signed-in workspace modules.
    // Monetary values remain stored in their original currency; this preference controls display/reporting only.
    window.localStorage.setItem('bizguard-market-preference', JSON.stringify({
      countryCode: country.code,
      reportingCurrency: country.currency,
      locale: country.locale,
      timezone: country.timezone,
      updatedAt: new Date().toISOString(),
    }));
    document.documentElement.lang = country.locale;
    window.dispatchEvent(new CustomEvent('bizguard:market-preference-changed', {
      detail: {
        countryCode: country.code,
        reportingCurrency: country.currency,
        locale: country.locale,
        timezone: country.timezone,
      },
    }));
    toast.success(`Market preference saved: ${country.name} · ${country.currency}`);
  };

  const [dailyStrategyEnabled, setDailyStrategyEnabled] = React.useState(false);
  const [dailyStrategyLoading, setDailyStrategyLoading] = React.useState(false);
  const [dailyStrategy, setDailyStrategy] = React.useState<{ title: string; summary: string; actionPlan?: string[] } | null>(null);
  const [showDailyStrategy, setShowDailyStrategy] = React.useState(false);

  React.useEffect(() => {
    if (!user?.id) return;
    const key = `bizguard-daily-strategy-enabled:${user.id}`;
    setDailyStrategyEnabled(window.localStorage.getItem(key) === '1');
  }, [user?.id]);

  const runDailyStrategy = async (notify = false) => {
    if (!businessId || dailyStrategyLoading) return;
    setDailyStrategyLoading(true);
    try {
      const result = await getExecutiveDailyBriefing(businessId);
      const briefing = { title: result.title || 'Your BizGuard Daily Strategy', summary: result.summary || 'Review today’s business signals and choose your next action.', actionPlan: result.actionPlan || [] };
      setDailyStrategy(briefing);
      setShowDailyStrategy(true);
      if (notify) {
        toast.success(`✨ Your daily strategy is ready: ${briefing.title}`, { duration: 7000 });
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('BizGuard • Your daily strategy is ready', {
            body: briefing.summary.slice(0, 180),
            tag: `bizguard-daily-strategy-${new Date().toISOString().slice(0, 10)}`,
            icon: '/favicon.ico',
          });
        }
      }
    } catch {
      toast.error('Your daily strategy could not load. Please try again.');
    } finally {
      setDailyStrategyLoading(false);
    }
  };

  const enableDailyStrategy = async () => {
    if (!user?.id) return;
    let permission: NotificationPermission = 'default';
    if ('Notification' in window) {
      try { permission = await Notification.requestPermission(); } catch { permission = 'default'; }
    }
    const enabled = permission === 'granted' || !('Notification' in window);
    window.localStorage.setItem(`bizguard-daily-strategy-enabled:${user.id}`, enabled ? '1' : '0');
    setDailyStrategyEnabled(enabled);
    if (enabled) {
      toast.success('Daily Strategy enabled. BizGuard will prepare a strategic nudge when you open the workspace in the morning.');
    } else {
      toast('Browser notifications were not enabled. You can still open Daily Strategy any time.');
    }
  };

  React.useEffect(() => {
    if (!dailyStrategyEnabled || !user?.id || !businessId || dailyStrategyLoading) return;
    const now = new Date();
    const hour = now.getHours();
    if (hour < 6 || hour >= 12) return;
    const day = now.toLocaleDateString('en-CA');
    const key = `bizguard-daily-strategy-last-run:${user.id}:${businessId}`;
    if (window.localStorage.getItem(key) === day) return;
    window.localStorage.setItem(key, day);
    void runDailyStrategy(true);
    // One morning briefing per user/business/day; no repeated notification loop.
  }, [dailyStrategyEnabled, user?.id, businessId]);

  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const unreadAlerts = alerts.filter((alert) => !alert.isRead);

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const handleMarkAllRead = () => {
    alerts.forEach((alert) => {
      if (!alert.isRead) {
        markAlertAsRead(alert.id);
      }
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>

          {/* Existing search field */}
          <div className="hidden w-64 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 md:flex lg:w-96">
            <Search
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            />

            <input
              type="text"
              placeholder="Search products, customers, invoices..."
              aria-label="Search products, customers, and invoices"
              className="min-w-0 flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />

            <kbd className="hidden items-center gap-1 rounded border bg-white px-2 py-0.5 text-xs text-slate-400 lg:inline-flex">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Opt-in daily strategic routine; never sends repeated unsolicited alerts. */}
          <div className="relative hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setShowDailyStrategy(true); if (!dailyStrategy) void runDailyStrategy(false); }}
              disabled={dailyStrategyLoading || !businessId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-100 disabled:opacity-60"
              aria-label="Open BizGuard Daily Strategy"
              title="AI-powered morning business briefing"
            >
              <Sparkles className={`h-4 w-4 ${dailyStrategyLoading ? 'animate-pulse' : ''}`} aria-hidden="true" />
              <span className="hidden lg:inline">{dailyStrategyLoading ? 'Preparing…' : 'Daily Strategy'}</span>
            </button>
            {!dailyStrategyEnabled && (
              <button
                type="button"
                onClick={() => void enableDailyStrategy()}
                aria-label="Enable daily strategy notifications"
                title="Enable morning strategy notifications"
                className="rounded-lg p-2 text-violet-700 transition hover:bg-violet-50"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Global country selector — shared across BizGuard's signed-in workspace */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <Globe2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <label className="sr-only" htmlFor="bizguard-global-country">Country / market</label>
            <select
              id="bizguard-global-country"
              aria-label="Choose country or market"
              value={countryCode}
              disabled={savingCountry || !businessId || !user?.id}
              onChange={(event) => void handleCountryChange(event.target.value)}
              className="max-w-[118px] cursor-pointer border-0 bg-transparent p-0 pr-1 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-[150px]"
              title={countryError || (savingCountry ? 'Saving country preference…' : 'Country and reporting currency preference')}
            >
              <option value="">Country / market</option>
              {HEADER_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.currency})</option>)}
            </select>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'light'
                ? 'Switch to dark theme'
                : 'Switch to light theme'
            }
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
          >
            {theme === 'light' ? (
              <Moon
                className="h-5 w-5 text-slate-600"
                aria-hidden="true"
              />
            ) : (
              <Sun
                className="h-5 w-5 text-slate-600"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowNotifications((visible) => !visible)
              }
              aria-label={`Notifications${
                unreadAlerts.length > 0
                  ? `, ${unreadAlerts.length} unread`
                  : ''
              }`}
              aria-expanded={showNotifications}
              className="relative rounded-lg p-2 transition-colors hover:bg-slate-100"
            >
              <Bell
                className="h-5 w-5 text-slate-600"
                aria-hidden="true"
              />

              {unreadAlerts.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"
                />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-800">
                      Notifications
                    </h3>

                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      Mark all read
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {unreadAlerts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No new notifications
                    </div>
                  ) : (
                    unreadAlerts.map((alert) => (
                      <button
                        type="button"
                        key={alert.id}
                        onClick={() => markAlertAsRead(alert.id)}
                        className={cn(
                          'block w-full border-b border-slate-50 p-4 text-left hover:bg-slate-50',
                          alert.severity === 'error' && 'bg-red-50',
                          alert.severity === 'warning' && 'bg-yellow-50'
                        )}
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {alert.title}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {alert.message}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowUserMenu((visible) => !visible)
              }
              aria-label="Open user menu"
              aria-expanded={showUserMenu}
              className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500">
                <span className="text-xs font-semibold text-white">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>

              <span className="hidden text-sm font-medium text-slate-700 md:block">
                {user?.name || 'User'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-[min(12rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-800">
                    {user?.name || 'User'}
                  </p>

                  <p className="break-all text-xs text-slate-500">
                    {user?.email || ''}
                  </p>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <User
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDailyStrategy && (
          <motion.div
            key="bizguard-neural-briefing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#050617]/80 p-3 backdrop-blur-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bizguard-daily-strategy-title"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDailyStrategy(false); }}
          >
            <motion.section
              initial={{ opacity: 0, y: 70, scale: 0.88, rotateX: 9 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 30, scale: 0.94, rotateX: -4 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22, mass: 0.9 }}
              style={{ perspective: 1400, transformStyle: 'preserve-3d' }}
              className="relative my-auto w-full max-w-4xl overflow-hidden rounded-[30px] border border-violet-300/25 bg-[#080b20] text-white shadow-[0_35px_120px_rgba(0,0,0,0.65)]"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-fuchsia-600/25 blur-[90px]" />
                <div className="absolute -left-24 top-36 h-72 w-72 rounded-full bg-cyan-500/20 blur-[90px]" />
                <div className="absolute bottom-[-140px] right-[25%] h-72 w-72 rounded-full bg-indigo-500/25 blur-[90px]" />
                <div className="absolute inset-0 opacity-[0.11]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.22) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'linear-gradient(to bottom, black, transparent 90%)' }} />
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 38, repeat: Infinity, ease: 'linear' }} className="absolute -right-20 top-10 h-64 w-64 rounded-full border border-cyan-200/15" />
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 52, repeat: Infinity, ease: 'linear' }} className="absolute -right-9 top-20 h-44 w-44 rounded-full border border-fuchsia-200/20 border-dashed" />
              </div>

              <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
                <div className="flex items-center gap-3">
                  <motion.div animate={{ boxShadow: ['0 0 12px rgba(139,92,246,.25)', '0 0 32px rgba(34,211,238,.55)', '0 0 12px rgba(139,92,246,.25)'] }} transition={{ duration: 3.2, repeat: Infinity }} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.28em] text-cyan-200/90">BizGuard Neural Core</p>
                    <p className="mt-1 text-xs text-white/55">Executive intelligence · Daily mission control</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowDailyStrategy(false)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:rotate-90 hover:bg-white/15 hover:text-white" aria-label="Close daily strategy">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.15fr_.85fr]">
                <div className="flex flex-col justify-center">
                  <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .12 }} className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-100">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" /></span>
                    {dailyStrategyLoading ? 'Neural systems synchronizing' : 'Your daily command brief'}
                  </motion.div>
                  <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }} id="bizguard-daily-strategy-title" className="max-w-xl text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">
                    {dailyStrategy?.title || 'Own the day.'}
                    <span className="mt-2 block bg-gradient-to-r from-cyan-200 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">{dailyStrategyLoading ? 'Intelligence in motion.' : 'Move with clarity.'}</span>
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .24 }} className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                    {dailyStrategy?.summary || (dailyStrategyLoading ? 'Connecting business signals, cash flow, inventory and opportunities to shape your next best moves…' : 'A sharper view of your business. A clearer next move. A focused plan built around your live business signals.')}
                  </motion.p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: .97 }} type="button" onClick={() => void runDailyStrategy(false)} disabled={dailyStrategyLoading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-[0_8px_30px_rgba(99,102,241,.35)] transition disabled:opacity-60">
                      <Zap className={`h-4 w-4 ${dailyStrategyLoading ? 'animate-pulse' : ''}`} />
                      {dailyStrategyLoading ? 'Reading business signals…' : 'Recalculate my strategy'}
                      {!dailyStrategyLoading && <ArrowUpRight className="h-4 w-4" />}
                    </motion.button>
                    <button type="button" onClick={() => void enableDailyStrategy()} disabled={dailyStrategyEnabled} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white/85 transition hover:border-cyan-200/40 hover:bg-white/10 disabled:opacity-60">
                      <Volume2 className="h-4 w-4 text-cyan-200" />
                      {dailyStrategyEnabled ? 'Morning pulse enabled' : 'Enable morning pulse'}
                    </button>
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-white/40">Private to your workspace · Notifications are opt-in · Built to support your decisions, not replace your judgment.</p>
                </div>

                <motion.div initial={{ opacity: 0, x: 28, rotateY: -8 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ delay: .2, type: 'spring', stiffness: 140, damping: 20 }} style={{ transformStyle: 'preserve-3d' }} className="relative">
                  <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-br from-violet-500/30 via-cyan-400/15 to-fuchsia-500/30 blur-xl" />
                  <div className="relative rounded-[24px] border border-white/15 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-2xl sm:p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">Priority matrix</p>
                        <p className="mt-1 text-sm font-bold text-white">Your next best moves</p>
                      </div>
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-200/10"><Target className="h-5 w-5 text-cyan-200" /></div>
                    </div>
                    {dailyStrategy?.actionPlan?.length ? (
                      <ol className="mt-5 space-y-3">
                        {dailyStrategy.actionPlan.slice(0, 5).map((item, index) => (
                          <motion.li key={item} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .28 + index * .09 }} className="group flex gap-3 rounded-2xl border border-white/[0.09] bg-slate-950/45 p-3 transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-white/[0.08]">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/35 to-cyan-400/25 text-xs font-black text-cyan-100 ring-1 ring-white/10">{String(index + 1).padStart(2, '0')}</span>
                            <span className="pt-1 text-xs leading-5 text-slate-200 sm:text-sm">{item}</span>
                          </motion.li>
                        ))}
                      </ol>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                        <motion.div animate={{ opacity: [.45, 1, .45] }} transition={{ duration: 2.2, repeat: Infinity }} className="mb-4 flex items-center gap-2 text-xs font-bold text-cyan-100"><Clock3 className="h-4 w-4" /> {dailyStrategyLoading ? 'Scanning live signals' : 'Ready to generate your brief'}</motion.div>
                        <div className="space-y-2"><div className="h-2 w-full rounded-full bg-white/10" /><div className="h-2 w-4/5 rounded-full bg-white/10" /><div className="h-2 w-2/3 rounded-full bg-white/10" /></div>
                        <p className="mt-4 text-xs leading-5 text-white/50">{dailyStrategyLoading ? 'Sales, inventory, receivables and risk signals are being organized into actionable priorities.' : 'Generate a fresh strategy to populate this live priority matrix.'}</p>
                      </div>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] p-3">
                        <ShieldCheck className="h-4 w-4 text-emerald-200" />
                        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-100/80">Signal aware</p>
                        <p className="mt-1 text-[11px] text-white/50">Business-first guidance</p>
                      </div>
                      <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.07] p-3">
                        <Activity className="h-4 w-4 text-violet-200" />
                        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-violet-100/80">Daily momentum</p>
                        <p className="mt-1 text-[11px] text-white/50">One clear next step</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
              <div className="relative flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-3 sm:px-8">
                <p className="text-[10px] text-white/40">BIZGUARD · NEURAL CORE / DAILY BRIEFING</p>
                <button type="button" onClick={() => setShowDailyStrategy(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-white/60 transition hover:bg-white/10 hover:text-white">Return to workspace</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

    </header>
  );
};

export default Header;
