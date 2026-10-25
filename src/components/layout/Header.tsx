import React from 'react';
import {
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  User,
  LogOut,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../utils/cn';
import { signOut } from '../../lib/supabase';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const {
    theme,
    toggleTheme,
    alerts,
    markAlertAsRead,
    user,
    setUser,
  } = useAppStore();

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
