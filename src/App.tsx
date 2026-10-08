import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/layout';
import {
  Dashboard,
  Sales,
  Inventory,
  Debtors,
  AIAssistant,
  RiskScore,
  Alerts,
  Reports,
  Predictions,
  Opportunities,
  Settings,
  Subscription,
  CustomerIntelligence,
  CustomerPredictor,
  CustomerFutureIntelligence,
  CustomerActionAutomation,
  AIBoardroom,
  ExecutiveBriefing,
  AutonomousGrowthEngine,
  OpportunityMarketplace,
  BusinessGuardian,
  SystemHealth,
  Analytics,
  Observability,
  MarketIntelligence,
  BusinessDoctor,
  AICEO,
  CashflowForecast,
  VoiceOperator,
  AdminPortal,
  AIEvolutionCenter,
} from './pages';
import { useAppStore } from './store';
import { Toaster, toast } from 'react-hot-toast';
import { bizguardDebug, getCurrentUser, resendEmailVerification, resetPassword, signIn, signInWithMagicLink, signUp, supabase } from './lib/supabase';
import { ensureBusinessContext, toAppBusiness } from './lib/business';
import type { User as AppUser } from './types';
import type { Database } from './lib/database.types';
import { canAccessRole, type EnterpriseRole } from './lib/rbac';
import { ErrorBoundary } from './components/monitoring/ErrorBoundary';
import { setupGlobalErrorTracking } from './lib/observability';
import { checkSuperAdminAccess } from './lib/adminAccess';

type Profile = Database['public']['Tables']['users']['Row'];

const PremiumLandingHero = React.lazy(() => import('./components/landing/PremiumLandingHero'));

const toAppUser = (profile: Profile): AppUser => ({
  id: profile.id,
  email: profile.email,
  name: profile.name || profile.email.split('@')[0],
  businessId: profile.business_id ?? null,
  role: profile.role === 'manager' || profile.role === 'staff' || profile.role === 'viewer' || profile.role === 'super_admin' || profile.role === 'business_owner' ? profile.role : 'business_owner',
  createdAt: profile.created_at,
});

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e7b85c] to-[#f5d88a] animate-pulse mx-auto mb-4" />
      <p className="text-slate-600">Loading BizGuard...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: EnterpriseRole[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user, currentBusiness } = useAppStore();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Admin Portal is a Super Admin surface, not a business-workspace surface.
  // Allow an authenticated Super Admin into /admin even when no business context
  // is loaded yet. All other protected routes retain the existing business-context gate.
  const isSuperAdminRoute = allowedRoles?.includes('super_admin') && user?.role === 'super_admin';
  if (isSuperAdminRoute) return <>{children}</>;

  if (!currentBusiness) {
    bizguardDebug('ProtectedRoute.noCurrentBusiness', { userId: user?.id || null, userBusinessId: user?.businessId || null, currentBusiness: null });
    return <LoadingScreen />;
  }
  if (!canAccessRole(user?.role, allowedRoles)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAppStore();
  const [isChecking, setIsChecking] = React.useState(true);
  const [allowed, setAllowed] = React.useState(user?.role === 'super_admin');

  React.useEffect(() => {
    let mounted = true;
    if (!isAuthenticated || isLoading) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    checkSuperAdminAccess(user?.role).then((result) => {
      if (!mounted) return;
      setAllowed(result);
      setIsChecking(false);
    });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isLoading, user?.role]);

  if (isLoading || isChecking) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};

type AuthMode = 'signin' | 'signup' | 'reset' | 'magic';

const LoginPage: React.FC = () => {
  const { setUser, setCurrentBusiness, setBusinesses } = useAppStore();
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<AuthMode>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadSignedInProfile = async () => {
    // Super Admin access is independent of business context. Resolve the
    // server-authoritative admin predicate BEFORE ensureBusinessContext(),
    // because that helper may require/create a business for ordinary users.
    const { data: authData, error: authUserError } = await supabase.auth.getUser();
    if (authUserError || !authData.user) throw new Error('Authenticated user could not be loaded.');

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError || !profile) throw new Error('Profile was not created. Check Supabase auth trigger/migrations.');

    const loginIsSuperAdmin = await checkSuperAdminAccess(profile.role);
    if (loginIsSuperAdmin) {
      const effectiveLoginProfile = { ...profile, role: 'super_admin' as const };
      setUser(toAppUser(effectiveLoginProfile));
      setCurrentBusiness(null);
      setBusinesses([]);
      bizguardDebug('Login.superAdmin', { userId: authData.user.id, currentBusiness: null });
      return;
    }

    const context = await ensureBusinessContext({ businessName });
    bizguardDebug('Login.loadSignedInProfile.context', { userId: context.user?.id || null, profileBusinessId: context.profile?.business_id || null, loadedBusinessId: context.business?.id || null });
    if (!context.profile) throw new Error('Profile was not created. Check Supabase auth trigger/migrations.');
    if (!context.business) throw new Error('Business was not created. Check Supabase business context migration.');

    const loginProfile = context.profile as Profile;
    setUser(toAppUser(loginProfile));
    const appBusiness = toAppBusiness(context.business);
    setCurrentBusiness(appBusiness);
    setBusinesses([appBusiness]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === 'magic') {
        const { error } = await signInWithMagicLink(email);
        if (error) throw error;
        toast.success('Magic sign-in link sent. Check your email.');
        setMode('signin');
        return;
      }

      if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast.success('Password reset link sent. Check your email.');
        setMode('signin');
        return;
      }

      if (mode === 'signup') {
        const { error } = await signUp(email, password, businessName, name);
        if (error) throw error;
        toast.success('Account created. Check your email to verify your address before signing in.');
        setMode('signin');
        return;
      }

      const { error } = await signIn(email, password);
      if (error) throw error;
      await loadSignedInProfile();
      toast.success('Signed in successfully');
      const { data: adminAfterLogin } = await supabase.rpc('is_super_admin');
      navigate(adminAfterLogin === true ? '/admin' : '/', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'signin' ? 'Sign in to BizGuard' : mode === 'signup' ? 'Create your BizGuard account' : mode === 'magic' ? 'Email a magic sign-in link' : 'Reset your password';
  const submitLabel = mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'magic' ? 'Send Magic Link' : 'Send Reset Link';

  return (
    <div className="min-h-screen bg-[#f4f1e8] lg:grid lg:grid-cols-[minmax(0,1fr)_480px] xl:grid-cols-[minmax(0,1fr)_520px]">
      <div className="min-h-[620px] lg:min-h-screen">
        <React.Suspense fallback={<div className="min-h-[620px] bg-[#17202b] lg:min-h-screen" />}>
          <PremiumLandingHero />
        </React.Suspense>
      </div>

      <aside id="auth-panel" className="relative z-40 flex min-h-screen items-center justify-center border-l border-[#17202b]/10 bg-[#f4f1e8] p-5 shadow-[-18px_0_50px_rgba(23,32,43,.08)]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center border-2 border-[#17202b] bg-[#e3b34b]">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="font-serif text-3xl font-black text-[#17202b]">Welcome back.</h2>
            <p className="mt-2 text-sm font-medium text-[#17202b]/55">Sign in and get back to the work.</p>
          </div>

          <div className="border border-[#17202b]/10 bg-white p-7 shadow-[8px_8px_0_#e3b34b]">
            <h1 className="mb-6 font-serif text-2xl font-black text-[#17202b]">{title}</h1>
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[#17202b]/70">Your name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-[#17202b]/15 bg-[#f8f6f0] px-4 py-3 text-[#17202b] placeholder-[#17202b]/35 focus:border-[#17202b] focus:outline-none focus:ring-2 focus:ring-[#e3b34b]/40" placeholder="Business Owner" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[#17202b]/70">Business name</label>
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full border border-[#17202b]/15 bg-[#f8f6f0] px-4 py-3 text-[#17202b] placeholder-[#17202b]/35 focus:border-[#17202b] focus:outline-none focus:ring-2 focus:ring-[#e3b34b]/40" placeholder="My Store" required />
                  </div>
                </>
              )}
              <div>
                <label className="mb-2 block text-sm font-bold text-[#17202b]/70">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-[#17202b]/15 bg-[#f8f6f0] px-4 py-3 text-[#17202b] placeholder-[#17202b]/35 focus:border-[#17202b] focus:outline-none focus:ring-2 focus:ring-[#e3b34b]/40" placeholder="you@example.com" required />
              </div>
              {mode !== 'reset' && mode !== 'magic' && (
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#17202b]/70">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-[#17202b]/15 bg-[#f8f6f0] px-4 py-3 text-[#17202b] placeholder-[#17202b]/35 focus:border-[#17202b] focus:outline-none focus:ring-2 focus:ring-[#e3b34b]/40" placeholder="••••••••" minLength={8} required />
                </div>
              )}
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#17202b] py-3 font-black text-white transition hover:bg-[#2a3848] disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? 'Please wait...' : submitLabel}
              </button>
            </form>

            <div className="mt-6 space-y-2 text-center">
              {mode === 'signup' && email && (
                <button type="button" onClick={async () => {
                  const { error } = await resendEmailVerification(email);
                  if (error) toast.error(error.message);
                  else toast.success('Verification email resent.');
                }} className="block w-full text-sm font-medium text-[#9a6b16] hover:text-[#17202b]">
                  Resend verification email
                </button>
              )}
              {mode !== 'signin' && <button onClick={() => setMode('signin')} className="text-sm font-medium text-[#9a6b16] hover:text-[#17202b]">Back to sign in</button>}
              {mode === 'signin' && (
                <>
                  <p className="text-sm text-slate-400">Don't have an account? <button onClick={() => setMode('signup')} className="font-bold text-[#9a6b16] hover:text-[#17202b]">Start Free Trial</button></p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setMode('magic')} className="text-sm text-[#9a6b16] hover:text-[#17202b]">Email magic link</button>
                    <span className="text-[#17202b]/25">•</span>
                    <button onClick={() => setMode('reset')} className="text-sm text-[#17202b]/50 hover:text-[#17202b]">Forgot password?</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-[#17202b]/45">
            Protected by Supabase Auth, tenant-aware RLS, and BizGuard secure onboarding.
          </p>
        </div>
      </aside>
    </div>
  );
};

const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setUser, setCurrentBusiness, setBusinesses, setIsLoading, clearSession } = useAppStore();

  React.useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      setIsLoading(true);
      try {
        const { user: authUser, error: authError } = await getCurrentUser();
        bizguardDebug('AuthBootstrap.authUser', { userId: authUser?.id || null, metadataBusinessId: authUser?.user_metadata?.business_id || null, error: authError?.message || null });
        if (!mounted) return;

        if (authError || !authUser) {
          clearSession();
          return;
        }

        // Resolve Super Admin BEFORE business-context bootstrap. Super Admins
        // are allowed to exist without a current business.
        let serverIsSuperAdmin = false;
        try {
          const { data } = await supabase.rpc('is_super_admin');
          serverIsSuperAdmin = data === true;
        } catch (error) {
          bizguardDebug('AuthBootstrap.superAdminCheck', { error: error instanceof Error ? error.message : String(error) });
        }

        if (serverIsSuperAdmin) {
          const { data: adminProfile, error: adminProfileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
          if (adminProfileError || !adminProfile) throw new Error('BizGuard could not load the Super Admin profile.');
          setUser(toAppUser({ ...adminProfile, role: 'super_admin' } as Profile));
          setCurrentBusiness(null);
          setBusinesses([]);
          bizguardDebug('AuthBootstrap.superAdmin', { userId: authUser.id, currentBusiness: null });
          return;
        }

        const context = await ensureBusinessContext();
        bizguardDebug('AuthBootstrap.businessContext', { userId: context.user?.id || null, profileBusinessId: context.profile?.business_id || null, loadedBusinessId: context.business?.id || null, loadedBusinessName: context.business?.name || null });
        if (!mounted) return;

        if (!context.profile) {
          throw new Error('BizGuard could not create or load your user profile.');
        }

        const resolvedProfile = context.profile as Profile;
        const effectiveProfile = resolvedProfile;

        setUser(toAppUser(effectiveProfile));

        if (context.business) {
          const appBusiness = toAppBusiness(context.business);
          setCurrentBusiness(appBusiness);
          setBusinesses([appBusiness]);
        } else {
          bizguardDebug('AuthBootstrap.noBusinessAfterRepair', { profileId: resolvedProfile.id, profileBusinessId: resolvedProfile.business_id || null });
          setCurrentBusiness(null);
          setBusinesses([]);
        }
      } catch (error) {
        console.error('BizGuard auth bootstrap failed:', error);
        if (mounted) clearSession();
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    hydrate();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearSession();
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') hydrate();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [clearSession, setBusinesses, setCurrentBusiness, setIsLoading, setUser]);

  return <>{children}</>;
};

const App: React.FC = () => {
  const { theme, currentBusiness, user } = useAppStore();

  React.useEffect(() => {
    setupGlobalErrorTracking(() => ({ businessId: currentBusiness?.id, userId: user?.id }));
  }, [currentBusiness?.id, user?.id]);

  return (
    <BrowserRouter>
      <AuthBootstrap>
        <div className={theme}>
          <Toaster position="top-right" toastOptions={{ style: { background: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b', border: '1px solid', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' } }} />
          <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Portal is intentionally outside the business-context root route.
                Super Admin access must not depend on currentBusiness being loaded. */}
            <Route path="/admin" element={<AdminRoute><Layout /></AdminRoute>}>
              <Route index element={<AdminPortal />} />
            </Route>

            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="sales" element={<Sales />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="debtors" element={<Debtors />} />
              <Route path="customer-intelligence" element={<CustomerIntelligence />} />
              <Route path="customer-predictor" element={<CustomerPredictor />} />
              <Route path="customer-future-intelligence" element={<CustomerFutureIntelligence />} />
              <Route path="customer-action-automation" element={<CustomerActionAutomation />} />
              <Route path="ai-boardroom" element={<AIBoardroom />} />
              <Route path="executive-briefing" element={<ExecutiveBriefing />} />
              <Route path="autonomous-growth-engine" element={<AutonomousGrowthEngine />} />
              <Route path="opportunity-marketplace" element={<OpportunityMarketplace />} />
              <Route path="business-guardian" element={<BusinessGuardian />} />
              <Route path="business-doctor" element={<BusinessDoctor />} />
              <Route path="ai-ceo" element={<AICEO />} />
              <Route path="cashflow-forecast" element={<CashflowForecast />} />
              <Route path="voice-operator" element={<VoiceOperator />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="risk-score" element={<RiskScore />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="reports" element={<Reports />} />
              <Route path="predictions" element={<Predictions />} />
              <Route path="opportunities" element={<Opportunities />} />
              <Route path="subscription" element={<Subscription />} />
              <Route path="system-health" element={<ProtectedRoute allowedRoles={['super_admin', 'business_owner', 'owner', 'manager']}><SystemHealth /></ProtectedRoute>} />
              <Route path="analytics" element={<ProtectedRoute allowedRoles={['super_admin', 'business_owner', 'owner', 'manager']}><Analytics /></ProtectedRoute>} />
              <Route path="observability" element={<ProtectedRoute allowedRoles={['super_admin', 'business_owner', 'owner', 'manager']}><Observability /></ProtectedRoute>} />
              <Route path="market-intelligence" element={<MarketIntelligence />} />
              <Route path="settings" element={<ProtectedRoute allowedRoles={['super_admin', 'business_owner', 'owner', 'manager']}><Settings /></ProtectedRoute>} />
              <Route path="ai-evolution" element={<AIEvolutionCenter />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </div>
      </AuthBootstrap>
    </BrowserRouter>
  );
};

export default App;
