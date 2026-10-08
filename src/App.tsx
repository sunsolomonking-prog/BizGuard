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

  if (!currentBusiness) {
    bizguardDebug('ProtectedRoute.noCurrentBusiness', { userId: user?.id || null, userBusinessId: user?.businessId || null, currentBusiness: null });
    return <LoadingScreen />;
  }
  if (!canAccessRole(user?.role, allowedRoles)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/**
 * Admin Portal guard.
 *
 * The Admin Portal is a Super Admin surface, not a business-workspace surface:
 * it is authorized with the existing Supabase role architecture
 * (public.users.role via the existing admin RPCs) and it must never require
 * currentBusiness/currentBusinessId to be loaded first.
 *
 * The guard resolves authentication from the Supabase session instead of
 * trusting the first render of the Zustand store, so a direct navigation or
 * reload of /admin can never bounce to "/" before authorization is resolved.
 */
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAppStore();
  const [decision, setDecision] = React.useState<'checking' | 'password' | 'allowed' | 'denied' | 'signed-out'>('checking');
  const [adminPassword, setAdminPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [unlocking, setUnlocking] = React.useState(false);
  const [sessionKey, setSessionKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const evaluate = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!mounted) return;
        const sessionUser = sessionData?.session?.user;
        if (!sessionUser) {
          setDecision('signed-out');
          return;
        }

        const allowed = await checkSuperAdminAccess(user?.role);
        bizguardDebug('AdminRoute.decision', { userId: sessionUser.id, allowed });
        if (!mounted) return;

        if (!allowed) {
          setDecision('denied');
          return;
        }

        const key = `bizguard-admin-unlocked:${sessionUser.id}`;
        setSessionKey(key);
        if (window.sessionStorage.getItem(key) === '1') {
          setDecision('allowed');
        } else {
          setDecision('password');
        }
      } catch (error) {
        bizguardDebug('AdminRoute.check.failed', { error: error instanceof Error ? error.message : String(error) });
        if (mounted) setDecision('denied');
      }
    };

    void evaluate();

    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const unlockAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminPassword.trim() || unlocking) return;

    setUnlocking(true);
    setPasswordError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (!email) throw new Error('Your authenticated email could not be resolved.');

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: adminPassword,
      });

      if (error) {
        setPasswordError('Incorrect password. Admin Portal remains locked.');
        return;
      }

      const stillSuperAdmin = await checkSuperAdminAccess('super_admin');
      if (!stillSuperAdmin) {
        setPasswordError('Admin authorization could not be verified. Portal remains locked.');
        return;
      }

      if (sessionKey) window.sessionStorage.setItem(sessionKey, '1');
      setAdminPassword('');
      setDecision('allowed');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Password verification failed.');
    } finally {
      setUnlocking(false);
    }
  };

  if (decision === 'checking') return <LoadingScreen />;
  if (decision === 'signed-out') return <Navigate to="/login" replace />;
  if (decision === 'denied') return <Navigate to="/" replace />;

  if (decision === 'password') {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <form onSubmit={unlockAdmin} className="w-full rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-center text-2xl font-black text-slate-950">Admin Portal Locked</h1>
            <p className="mt-2 text-center text-sm text-slate-500">
              Enter your Super Admin account password to unlock this portal.
            </p>

            <label className="mt-6 block text-sm font-bold text-slate-700" htmlFor="admin-portal-password">
              Password
            </label>
            <input
              id="admin-portal-password"
              type="password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Enter your account password"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              disabled={unlocking}
              autoFocus
            />

            {passwordError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={unlocking || !adminPassword}
              className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {unlocking ? 'Verifying…' : 'Unlock Admin Portal'}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              Your password is verified by Supabase Auth and is not stored by BizGuard.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Resolves an authenticated Supabase session into BizGuard application state.
 *
 * Super Admin status is resolved with the server-authoritative predicate
 * (`checkSuperAdminAccess`) before the business workspace is touched. The
 * business context is then hydrated for every role - Super Admins included, so
 * the normal dashboard keeps working - but a Super Admin whose workspace is
 * missing or cannot be created still resolves: the Admin Portal must never
 * depend on currentBusiness/currentBusinessId being loaded.
 *
 * Ordinary users keep the existing behaviour: a missing profile or business
 * still rejects the hydration, exactly as before.
 */
const resolveSignedInState = async (
  authUser: { id: string; email?: string | null },
  options?: { businessName?: string | null },
): Promise<{ user: AppUser; business: ReturnType<typeof toAppBusiness> | null; isSuperAdmin: boolean }> => {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  const isSuperAdmin = await checkSuperAdminAccess((profile as Profile | null)?.role ?? null);

  try {
    const context = await ensureBusinessContext({ businessName: options?.businessName });
    bizguardDebug('App.resolveSignedInState.context', { userId: context.user?.id || null, isSuperAdmin, profileBusinessId: context.profile?.business_id || null, loadedBusinessId: context.business?.id || null });
    if (!context.profile) throw new Error('BizGuard could not create or load your user profile.');
    if (!isSuperAdmin && !context.business) throw new Error('Business was not created. Check Supabase business context migration.');

    const resolvedProfile = context.profile as Profile;
    const effectiveProfile = isSuperAdmin ? ({ ...resolvedProfile, role: 'super_admin' } as Profile) : resolvedProfile;
    return {
      user: toAppUser(effectiveProfile),
      business: context.business ? toAppBusiness(context.business) : null,
      isSuperAdmin,
    };
  } catch (error) {
    if (!isSuperAdmin) throw error;
    bizguardDebug('App.resolveSignedInState.superAdmin.withoutBusiness', { userId: authUser.id, error: error instanceof Error ? error.message : String(error) });
    if (profileError || !profile) throw new Error('BizGuard could not load the Super Admin profile.');
    return {
      user: toAppUser({ ...(profile as Profile), role: 'super_admin' } as Profile),
      business: null,
      isSuperAdmin: true,
    };
  }
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
    // Super Admin authorization is resolved from the existing Supabase role
    // architecture inside resolveSignedInState, independently of the business
    // workspace context.
    const { data: authData, error: authUserError } = await supabase.auth.getUser();
    if (authUserError || !authData.user) throw new Error('Authenticated user could not be loaded.');

    const resolved = await resolveSignedInState(authData.user, { businessName });
    setUser(resolved.user);
    setCurrentBusiness(resolved.business);
    setBusinesses(resolved.business ? [resolved.business] : []);
    bizguardDebug('Login.resolveSignedInState', { userId: resolved.user.id, isSuperAdmin: resolved.isSuperAdmin, loadedBusinessId: resolved.business?.id || null });
    return resolved;
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
      const resolvedSession = await loadSignedInProfile();
      toast.success('Signed in successfully');
      // Super Admins land on the existing Admin Portal; everyone else keeps the
      // existing dashboard entry point.
      navigate(resolvedSession.isSuperAdmin ? '/admin' : '/', { replace: true });
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

        // Super Admin authorization is resolved from the existing Supabase role
        // architecture (`checkSuperAdminAccess`) before the business workspace
        // is touched. The workspace context is still hydrated when it exists so
        // the normal dashboard keeps working for Super Admins, but a missing
        // workspace never blocks the Admin Portal.
        const resolved = await resolveSignedInState(authUser);
        bizguardDebug('AuthBootstrap.resolvedSession', { userId: resolved.user.id, isSuperAdmin: resolved.isSuperAdmin, loadedBusinessId: resolved.business?.id || null, loadedBusinessName: resolved.business?.name || null });
        if (!mounted) return;

        setUser(resolved.user);

        if (resolved.business) {
          setCurrentBusiness(resolved.business);
          setBusinesses([resolved.business]);
        } else {
          bizguardDebug('AuthBootstrap.noBusinessAfterRepair', { profileId: resolved.user.id, profileBusinessId: resolved.user.businessId || null });
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
