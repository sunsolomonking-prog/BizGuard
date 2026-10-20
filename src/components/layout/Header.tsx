import React from 'react';
import { Bell, Search, Menu, Sun, Moon, User, LogOut, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../utils/cn';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from '../../lib/supabase';
import { useSuperAdminAccess } from '../../lib/adminAccess';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { theme, toggleTheme, alerts, markAlertAsRead, user, setUser } = useAppStore();
  const location = useLocation();
  const { isSuperAdmin } = useSuperAdminAccess(user?.role);
  const isAdminPage = location.pathname === '/admin';
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const unreadAlerts = alerts.filter((a) => !a.isRead);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-slate-100 lg:hidden"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-64 lg:w-96">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, customers, invoices..."
              className="bg-transparent border-none outline-none text-sm flex-1 text-slate-700 placeholder-slate-400"
            />
            <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 bg-white rounded border">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Super Admin entry point: uses the existing /admin route and authorization. */}
          {isSuperAdmin && (
            <Link
              to="/admin"
              aria-label="Open Admin Portal"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-black tracking-wide shadow-md transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2',
                isAdminPage
                  ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-amber-200'
                  : 'border-amber-400 bg-slate-950 text-white shadow-amber-100 hover:bg-slate-800'
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="sm:hidden">ADMIN</span>
              <span className="hidden sm:inline">ADMIN PORTAL</span>
            </Link>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-slate-600" />
            ) : (
              <Sun className="w-5 h-5 text-slate-600" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unreadAlerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">Notifications</h3>
                    <button
                      onClick={() => alerts.forEach((a) => markAlertAsRead(a.id))}
                      className="text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      Mark all read
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {unreadAlerts.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      No new notifications
                    </div>
                  ) : (
                    unreadAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          'p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer',
                          alert.severity === 'error' && 'bg-red-50',
                          alert.severity === 'warning' && 'bg-yellow-50'
                        )}
                        onClick={() => markAlertAsRead(alert.id)}
                      >
                        <p className="font-medium text-slate-800 text-sm">{alert.title}</p>
                        <p className="text-slate-600 text-xs mt-1">{alert.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="hidden md:block text-sm font-medium text-slate-700">
                {user?.name || 'User'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-[min(12rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <p className="font-medium text-slate-800 text-sm">{user?.name}</p>
                  <p className="text-slate-500 text-xs">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">
                    <User className="w-4 h-4" />
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
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
