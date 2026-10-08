import React from 'react';
import { Bot, Command, Search, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const actions = [
  { label: 'Open Business Guardian', path: '/business-guardian', keywords: 'guardian priorities health radar' },
  { label: 'Record Sale', path: '/sales', keywords: 'pos invoice receipt sale' },
  { label: 'Add Product / Inventory', path: '/inventory', keywords: 'stock product inventory low' },
  { label: 'Customer Intelligence', path: '/customer-intelligence', keywords: 'customers vip loyalty patronage' },
  { label: 'Collect Debts', path: '/debtors', keywords: 'debtors payments invoices collection' },
  { label: 'Reports Center', path: '/reports', keywords: 'csv export reports' },
  { label: 'Voice AI Assistant', path: '/ai-assistant', keywords: 'voice ai assistant chat' },
  { label: 'Subscription', path: '/subscription', keywords: 'billing plans voice usage' },
];

export const FloatingGuardian: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = actions.filter((action) => `${action.label} ${action.keywords}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-700 px-4 py-3 text-sm font-black text-white shadow-2xl shadow-emerald-900/30"
      >
        <Bot className="h-5 w-5" /> Guardian <span className="hidden rounded-md bg-white/15 px-2 py-0.5 text-xs sm:inline">⌘K</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-2 sm:p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="mx-auto mt-4 w-full max-w-2xl overflow-hidden rounded-2xl sm:mt-20 sm:rounded-3xl border border-white/10 bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-200 p-4">
                <Command className="h-5 w-5 text-emerald-600" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search actions, pages, business commands..." className="flex-1 border-none outline-none" />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-2">
                {filtered.map((action) => (
                  <button key={action.path} onClick={() => { navigate(action.path); setOpen(false); setQuery(''); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left hover:bg-emerald-50">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Zap className="h-5 w-5" /></div>
                    <div><p className="font-bold text-slate-800">{action.label}</p><p className="text-sm text-slate-500">{action.keywords}</p></div>
                  </button>
                ))}
                {filtered.length === 0 && <div className="p-8 text-center text-slate-500"><Search className="mx-auto mb-2 h-8 w-8" />No action found</div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingGuardian;
