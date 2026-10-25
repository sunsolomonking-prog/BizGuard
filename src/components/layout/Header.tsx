import React from 'react';
import {
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  User,
  LogOut,
  Globe2,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store';
import { cn } from '../../utils/cn';
import { signOut, supabase } from '../../lib/supabase';
import { useSuperAdminAccess } from '../../lib/adminAccess';

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
  const { isSuperAdmin } = useSuperAdminAccess(user?.role);

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
      return;
    }
  };

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

          {isSuperAdmin && (
            <Link
              to="/admin"
              aria-label="Open Admin Portal"
              title="Admin Portal"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-400 bg-slate-950 px-3 py-2 text-[10px] font-black tracking-wide text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 sm:px-4 sm:text-xs"
            >
              <ShieldCheck className="h-4 w-4 text-amber-300" aria-hidden="true" />
              <span>ADMIN PORTAL</span>
            </Link>
          )}

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
    </header>
  );
};

export default Header;
