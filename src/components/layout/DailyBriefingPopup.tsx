import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowRight, BrainCircuit, Check, Clock3, Pause, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { getExecutiveDailyBriefing, type NeuralCoreResult } from '../../lib/neuralCore';

const POPUP_EVERY_MS = 40_000;
const REFRESH_BRIEFING_MS = 10 * 60_000;
const PREF_KEY = 'bizguard-briefing-popup-preferences';

type Preferences = { enabled: boolean; pausedUntil: number; hiddenForDay: string };
const readPreferences = (): Preferences => {
  try {
    const value = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return { enabled: value.enabled !== false, pausedUntil: Number(value.pausedUntil || 0), hiddenForDay: String(value.hiddenForDay || '') };
  } catch { return { enabled: true, pausedUntil: 0, hiddenForDay: '' }; }
};
const dayKey = () => new Date().toISOString().slice(0, 10);

export const DailyBriefingPopup: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const navigate = useNavigate();
  const businessId = currentBusiness?.id;
  const [preferences, setPreferences] = React.useState<Preferences>(readPreferences);
  const [briefing, setBriefing] = React.useState<NeuralCoreResult | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [nextPopupAt, setNextPopupAt] = React.useState(Date.now() + POPUP_EVERY_MS);
  const [remaining, setRemaining] = React.useState(40);

  const savePreferences = React.useCallback((next: Preferences) => {
    setPreferences(next);
    try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* Preferences are optional. */ }
  }, []);

  const refreshBriefing = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const result = await getExecutiveDailyBriefing(businessId);
      setBriefing(result);
    } catch {
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    setVisible(false);
    setBriefing(null);
    setNextPopupAt(Date.now() + POPUP_EVERY_MS);
    if (businessId) void refreshBriefing();
    const refresh = window.setInterval(() => { void refreshBriefing(); }, REFRESH_BRIEFING_MS);
    return () => window.clearInterval(refresh);
  }, [businessId, refreshBriefing]);

  React.useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      setRemaining(Math.max(0, Math.ceil((nextPopupAt - now) / 1000)));
      if (now >= nextPopupAt) {
        const prefs = readPreferences();
        const allowed = prefs.enabled && prefs.hiddenForDay !== dayKey() && prefs.pausedUntil <= now;
        if (allowed && businessId && !document.hidden) setVisible(true);
        setNextPopupAt(now + POPUP_EVERY_MS);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [businessId, nextPopupAt]);

  if (!businessId) return null;

  const closeAndWait = () => { setVisible(false); setNextPopupAt(Date.now() + POPUP_EVERY_MS); };
  const pauseForHour = () => {
    savePreferences({ ...preferences, pausedUntil: Date.now() + 60 * 60_000 });
    setVisible(false);
  };
  const disableToday = () => {
    savePreferences({ ...preferences, hiddenForDay: dayKey() });
    setVisible(false);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[70] hidden sm:block">
        <button onClick={() => setVisible(true)} className="group flex items-center gap-2 rounded-full border border-violet-300/30 bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-violet-500/20" aria-label="Open Daily CEO Briefing">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" /></span>
          <BrainCircuit className="h-4 w-4 text-violet-300" /> Daily Intelligence
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 tabular-nums">{remaining}s</span>
        </button>
      </div>
      <AnimatePresence>
        {visible && (
          <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeAndWait(); }}>
            <motion.section role="dialog" aria-modal="true" aria-labelledby="daily-briefing-title"
              initial={{ opacity: 0, y: 80, scale: 0.92, rotateX: 8 }} animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 45, scale: 0.96 }} transition={{ type: 'spring', stiffness: 170, damping: 20 }}
              className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/15 bg-slate-950 text-white shadow-[0_30px_120px_rgba(79,70,229,.4)]">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-600/30 blur-3xl" />
                <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.09),transparent_55%)]" />
              </div>
              <div className="relative p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 shadow-lg shadow-cyan-900/20"><BrainCircuit className="h-6 w-6 text-cyan-200" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-200">BizGuard Neural Core</p><p className="mt-1 text-xs text-slate-400">Your business signal, distilled into next steps</p></div>
                  </div>
                  <button onClick={closeAndWait} aria-label="Close briefing" className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-200"><Sparkles className="h-3.5 w-3.5" /> Daily CEO Briefing <span className="ml-auto flex items-center gap-1 text-slate-500 normal-case tracking-normal"><Clock3 className="h-3 w-3" /> 40-second reminder cycle</span></div>
                <h2 id="daily-briefing-title" className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{briefing?.title || (loading ? 'Reading your business signals…' : 'Your next best move starts here')}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{briefing?.summary || 'BizGuard is preparing an evidence-based briefing. Check that the OpenAI service is configured if this message persists.'}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(briefing?.actionPlan || briefing?.recommendations || []).slice(0, 4).map((action, i) => (
                    <div key={action} className="rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-white/[.08]">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-200"><Activity className="h-3.5 w-3.5" /> Priority {String(i + 1).padStart(2, '0')}</div>
                      <p className="mt-2 text-sm leading-5 text-slate-100">{action}</p>
                    </div>
                  ))}
                </div>
                {briefing?.risks?.length ? <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/[.06] p-4"><p className="text-xs font-black text-amber-200">Worth watching</p><p className="mt-1 text-sm text-slate-300">{briefing.risks[0]}</p></div> : null}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <button onClick={() => { setVisible(false); navigate('/ai-evolution'); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-200 px-4 py-3 text-xs font-black text-slate-950 transition hover:scale-[1.02]"><ArrowRight className="h-4 w-4" /> Open AI Evolution</button>
                  <button onClick={closeAndWait} className="rounded-xl border border-white/15 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/10"><Check className="mr-1 inline h-4 w-4" /> Got it</button>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button onClick={pauseForHour} title="Pause reminders for one hour" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white"><Pause className="h-3 w-3" /> Pause 1h</button>
                    <button onClick={disableToday} className="rounded-xl px-3 py-2 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white">Hide today</button>
                  </div>
                </div>
                <p className="mt-4 text-[10px] leading-4 text-slate-500">AI recommendations are decision support. Verify figures and use your judgment before taking financial or operational action.</p>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DailyBriefingPopup;
