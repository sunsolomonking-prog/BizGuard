import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureErrorEvent } from '../../lib/observability';
import { useAppStore } from '../../store';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundaryInner extends React.Component<React.PropsWithChildren<{ businessId?: string | null; userId?: string | null }>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureErrorEvent({ businessId: this.props.businessId, userId: this.props.userId, source: 'frontend', severity: 'critical', error, context: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800">
        <AlertTriangle className="h-10 w-10" />
        <h1 className="mt-4 text-2xl font-black">BizGuard caught an application error</h1>
        <p className="mt-2 text-sm">{this.state.message}</p>
        <button onClick={() => window.location.reload()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 font-bold text-white">
          <RefreshCw className="h-4 w-4" /> Reload
        </button>
      </div>
    );
  }
}

export const ErrorBoundary: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { currentBusiness, user } = useAppStore();
  return <ErrorBoundaryInner businessId={currentBusiness?.id} userId={user?.id}>{children}</ErrorBoundaryInner>;
};

export default ErrorBoundary;
