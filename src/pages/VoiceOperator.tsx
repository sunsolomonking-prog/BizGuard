import React from 'react';
import { Mic, ShieldCheck, Workflow, Zap } from 'lucide-react';
import { getVoiceOperatorArchitecture } from '../lib/aiOperatingSystem';

export const VoiceOperator: React.FC = () => {
  const architecture = getVoiceOperatorArchitecture();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-black text-slate-800">Voice Business Operator</h1><p className="text-slate-500">Natural-language business operation architecture for safe voice-to-record workflows.</p></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><Panel icon={Mic} title="Supported Commands" items={architecture.supportedCommands} /><Panel icon={ShieldCheck} title="Safety Workflow" items={architecture.safety} /><Panel icon={Zap} title="Examples" items={architecture.examples} /></div>
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6"><div className="flex items-start gap-3"><Workflow className="h-6 w-6 text-purple-700" /><div><h2 className="font-black text-slate-800">Execution Architecture</h2><p className="mt-2 text-sm text-slate-600">Voice commands are parsed into structured intent first. Mutating actions such as Create Sale, Create Invoice, Update Inventory or Create Debtor should require validation and confirmation before applying to production records.</p></div></div></div>
    </div>
  );
};

const Panel = ({ icon: Icon, title, items }: { icon: typeof Mic; title: string; items: string[] }) => <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><Icon className="h-6 w-6 text-purple-600" /><h2 className="mt-3 font-bold text-slate-800">{title}</h2><div className="mt-4 space-y-2">{items.map((item) => <div key={item} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item}</div>)}</div></div>;

export default VoiceOperator;
