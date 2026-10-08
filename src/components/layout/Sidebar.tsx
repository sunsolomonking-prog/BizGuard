import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, MessageSquare, FileText, CreditCard,
  Settings, ShieldCheck, MoreHorizontal, ChevronDown, ChevronLeft, ChevronRight, Bell, X
} from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../utils/cn';
import { useSuperAdminAccess } from '../../lib/adminAccess';

interface SidebarProps { collapsed?: boolean; onToggle?: () => void; }

const primary = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Debtors', href: '/debtors', icon: Users },
  { name: 'Customers', href: '/customer-intelligence', icon: Users },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'AI Assistant', href: '/ai-assistant', icon: MessageSquare },
];

const secondary = [
  { name: 'Analytics', href: '/analytics' },
  { name: 'Alerts', href: '/alerts' },
  { name: 'Predictions', href: '/predictions' },
  { name: 'Opportunities', href: '/opportunities' },
  { name: 'Business Doctor', href: '/business-doctor' },
  { name: 'Voice Operator', href: '/voice-operator' },
  { name: 'Business Guardian', href: '/business-guardian' },
  { name: 'AI CEO', href: '/ai-ceo' },
  { name: 'Cashflow Forecast', href: '/cashflow-forecast' },
  { name: 'System Health', href: '/system-health' },
  { name: 'Observability', href: '/observability' },
  { name: 'Market Intelligence', href: '/market-intelligence' },
  { name: 'AI Evolution', href: '/ai-evolution' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const { sidebarOpen, toggleSidebar, alerts, user, currentBusiness } = useAppStore();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const unreadAlerts = alerts.filter((a) => !a.isRead).length;
  const { isSuperAdmin } = useSuperAdminAccess(user?.role);
  const displayName = user?.name || user?.email?.split('@')[0] || 'Business owner';
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={toggleSidebar} />}
      <aside className={cn('fixed left-0 top-0 z-50 flex h-full flex-col border-r border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-200/40 transition-all duration-200 lg:static lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]')}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
          <div className={cn('flex min-w-0 items-center gap-3', collapsed && 'lg:justify-center lg:w-full')}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div>
            {!collapsed && <div className="min-w-0"><p className="truncate text-base font-black tracking-tight">BizGuard</p><p className="truncate text-[11px] font-medium text-slate-400">Business, made simple</p></div>}
          </div>
          <button onClick={onToggle || toggleSidebar} className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 lg:block">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
          <button onClick={toggleSidebar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"><X className="h-4 w-4" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className={cn('px-2 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-400', collapsed && 'lg:hidden')}>Work</p>
          <div className="space-y-1">
            {primary.map((item) => <NavLink key={item.href} to={item.href} onClick={() => window.innerWidth < 1024 && toggleSidebar()} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950', collapsed && 'lg:justify-center lg:px-2')}><item.icon className="h-4.5 w-4.5 shrink-0" />{!collapsed && <span className="flex-1">{item.name}</span>}{!collapsed && item.name === 'Alerts' && unreadAlerts > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">{unreadAlerts}</span>}</NavLink>)}
          </div>

          {isSuperAdmin && (
            <NavLink
              to="/admin"
              onClick={() => window.innerWidth < 1024 && toggleSidebar()}
              className={({ isActive }) => cn(
                'mt-3 flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-sm font-black tracking-wide shadow-md transition-all',
                isActive
                  ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-amber-200'
                  : 'border-amber-400 bg-slate-950 text-white shadow-amber-100 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg',
                collapsed && 'lg:justify-center lg:px-2'
              )}
              aria-label="Open Admin Portal"
            >
              <ShieldCheck className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1">ADMIN PORTAL</span>}
              {!collapsed && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-slate-950">ADMIN</span>}
            </NavLink>
          )}

          {!collapsed && <button onClick={() => setMoreOpen((value) => !value)} className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"><MoreHorizontal className="h-4.5 w-4.5" /><span className="flex-1 text-left">More tools</span><ChevronDown className={cn('h-4 w-4 transition', moreOpen && 'rotate-180')} /></button>}
          {moreOpen && !collapsed && <div className="mt-1 space-y-0.5 rounded-xl bg-slate-50 p-1">{secondary.map((item) => <NavLink key={item.href} to={item.href} className={({ isActive }) => cn('block rounded-lg px-3 py-2 text-xs font-semibold', isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-900')}>{item.name}</NavLink>)}</div>}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <NavLink to="/subscription" className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100', collapsed && 'lg:justify-center lg:px-2')}><CreditCard className="h-4.5 w-4.5" />{!collapsed && 'Subscription'}</NavLink>
          <NavLink to="/settings" className={({ isActive }) => cn('mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100', collapsed && 'lg:justify-center lg:px-2')}><Settings className="h-4.5 w-4.5" />{!collapsed && 'Settings'}</NavLink>
          {isSuperAdmin && <NavLink to="/admin" className={({ isActive }) => cn('mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black', isActive ? 'bg-amber-400 text-slate-950' : 'text-slate-800 hover:bg-amber-50', collapsed && 'lg:justify-center lg:px-2')}><ShieldCheck className="h-4.5 w-4.5" />{!collapsed && 'Admin Portal'}</NavLink>}
          {!collapsed && <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-black text-slate-700">{initials}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{displayName}</p><p className="truncate text-[11px] text-slate-400">{currentBusiness?.name || user?.email || 'BizGuard account'}</p></div></div>}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
