import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../store';
import { cn } from '../../utils/cn';
import { FloatingGuardian } from './FloatingGuardian';
import { QuickCaptureBar } from './QuickCaptureBar';
import { trackFeatureUsage, trackPerformanceMetric } from '../../lib/observability';

export const Layout: React.FC = () => {
  const { sidebarOpen, setSidebarOpen, theme, currentBusiness, user } = useAppStore();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  React.useEffect(() => {
    const start = performance.now();
    trackFeatureUsage({ businessId: currentBusiness?.id, userId: user?.id, feature: location.pathname, eventName: 'page_view' });
    const timer = window.setTimeout(() => {
      trackPerformanceMetric({ businessId: currentBusiness?.id, page: location.pathname, metricName: 'page_interactive_estimate', metricValue: performance.now() - start });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentBusiness?.id, location.pathname, user?.id]);

  return (
    <div className={cn('min-h-[100dvh] w-full min-w-0 overflow-x-clip bg-slate-50', theme === 'dark' && 'dark bg-slate-900')}>
      <div className="flex min-w-0 w-full">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        
        <div className="flex min-w-0 flex-1 flex-col min-h-[100dvh] lg:ml-0">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto p-3 pb-32 sm:p-4 lg:p-6 lg:pb-28">
            <Outlet />
          </main>
          <div className="safe-bottom fixed bottom-0 left-0 right-0 z-30 px-2 pb-2 sm:px-3 lg:left-[248px]">
            <QuickCaptureBar />
          </div>
          <FloatingGuardian />
        </div>
      </div>
    </div>
  );
};

export default Layout;
