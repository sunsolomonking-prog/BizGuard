import React from 'react';
import { Archive, Bot, Download, Edit3, Mail, MessageCircle, Pin, PinOff, Plus, Search, Send, Star, Trash2, User, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { cn } from '../utils/cn';
import { recordVoiceCommand, type VoiceCommandResult } from '../lib/subscriptions';
import {
  agentModeLabel,
  createAIConversation,
  generateAgentResponse,
  generateBusinessMemory,
  loadAIConversations,
  loadBusinessAIContext,
  messagesToJson,
  parseMessages,
  updateAIConversation,
  type AIAgentMode,
  type AIConversationCategory,
  type AIMessageV3,
} from '../lib/aiAssistantV3';
import type { Database } from '../lib/database.types';

type ConversationRow = Database['public']['Tables']['ai_conversations']['Row'];

const agentModes: Array<{ mode: AIAgentMode; category: AIConversationCategory; description: string }> = [
  { mode: 'guardian', category: 'guardian', description: 'Executive summary and business priorities' },
  { mode: 'cfo', category: 'cfo', description: 'Profit, margin, cashflow and pricing' },
  { mode: 'coo', category: 'coo', description: 'Operations, bottlenecks and efficiency' },
  { mode: 'credit_controller', category: 'credit', description: 'Debtors, collections and credit risk' },
  { mode: 'sales_director', category: 'sales', description: 'Upsell, cross-sell and revenue growth' },
  { mode: 'inventory_strategist', category: 'inventory', description: 'Reorder, dead stock and demand signals' },
  { mode: 'business_doctor', category: 'guardian', description: 'Diagnosis, root cause and action plan' },
];

const suggestedPrompts = [
  'What should I prioritize today?',
  'How profitable am I this month?',
  'Who owes me money and who should I call?',
  'What should I reorder now?',
  'Which customers should I reward?',
  'Where am I losing money?',
];

const nowMessage = (role: AIMessageV3['role'], content: string, mode?: AIAgentMode): AIMessageV3 => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  role,
  content,
  timestamp: new Date().toISOString(),
  mode,
});

export const AIAssistant: React.FC = () => {
  const { currentBusiness, user } = useAppStore();
  const [conversations, setConversations] = React.useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [input, setInput] = React.useState('');
  const [activeMode, setActiveMode] = React.useState<AIAgentMode>('guardian');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isThinking, setIsThinking] = React.useState(false);
  const [voiceCommand, setVoiceCommand] = React.useState('');
  const [voiceResult, setVoiceResult] = React.useState<VoiceCommandResult | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const businessId = currentBusiness?.id;
  const userId = user?.id;
  const activeConversation = conversations.find((conversation) => conversation.id === activeId) || conversations[0] || null;
  const activeMessages = React.useMemo(() => parseMessages(activeConversation?.messages || []), [activeConversation]);

  const loadConversations = React.useCallback(async () => {
    if (!businessId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await loadAIConversations(businessId);
      setConversations(data);
      if (!activeId && data[0]) setActiveId(data[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI conversations unavailable. Apply AI memory migration.');
    } finally {
      setIsLoading(false);
    }
  }, [activeId, businessId]);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  const createConversation = async (category?: AIConversationCategory) => {
    if (!businessId || !userId) return;
    try {
      const conversation = await createAIConversation(businessId, userId, category || agentModes.find((agent) => agent.mode === activeMode)?.category || 'general');
      setConversations((current) => [conversation, ...current]);
      setActiveId(conversation.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create chat. Apply AI memory migration.');
    }
  };

  const saveMessages = async (conversation: ConversationRow, messages: AIMessageV3[], title?: string) => {
    const updated = await updateAIConversation(conversation.id, {
      messages: messagesToJson(messages),
      title: title || conversation.title,
      category: agentModes.find((agent) => agent.mode === activeMode)?.category || conversation.category,
      memory: {
        lastMode: activeMode,
        lastPrompt: messages.filter((message) => message.role === 'user').at(-1)?.content || '',
      },
    });
    setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const sendMessage = async (prompt?: string) => {
    const content = (prompt || input).trim();
    if (!content || !businessId || !userId) return;

    let conversation = activeConversation;
    if (!conversation) {
      conversation = await createAIConversation(businessId, userId, agentModes.find((agent) => agent.mode === activeMode)?.category || 'general');
      setConversations((current) => [conversation!, ...current]);
      setActiveId(conversation.id);
    }

    setInput('');
    setIsThinking(true);
    const userMessage = nowMessage('user', content, activeMode);
    const nextMessages = [...parseMessages(conversation.messages), userMessage];
    setConversations((current) => current.map((item) => item.id === conversation!.id ? { ...item, messages: messagesToJson(nextMessages), updated_at: new Date().toISOString() } : item));

    try {
      const context = await loadBusinessAIContext(businessId);
      await generateBusinessMemory(businessId, context, { name: currentBusiness?.name, industry: currentBusiness?.industry, type: currentBusiness?.type });
      const agentResponse = generateAgentResponse(activeMode, content, context);
      const assistantMessage = nowMessage('assistant', [
        `## ${agentResponse.title}`,
        agentResponse.summary,
        '',
        '**Key Metrics**',
        ...Object.entries(agentResponse.metrics).map(([key, value]) => `- ${key}: ${value}`),
        '',
        '**Action Plan**',
        ...agentResponse.recommendations.map((item, index) => `${index + 1}. ${item}`),
      ].join('\n'), activeMode);
      await saveMessages(conversation, [...nextMessages, assistantMessage], conversation.title === 'New Chat' ? content.slice(0, 56) : conversation.title);
    } catch (error) {
      const assistantMessage = nowMessage('assistant', `I could not complete the live AI analysis: ${error instanceof Error ? error.message : 'unknown error'}. Apply the AI memory migration if this is a database error.`, activeMode);
      await saveMessages(conversation, [...nextMessages, assistantMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  const renameConversation = async (conversation: ConversationRow) => {
    const title = window.prompt('Rename chat', conversation.title);
    if (!title?.trim()) return;
    const updated = await updateAIConversation(conversation.id, { title: title.trim() });
    setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const toggleConversation = async (conversation: ConversationRow, field: 'is_pinned' | 'is_favorite' | 'is_archived') => {
    const updated = await updateAIConversation(conversation.id, { [field]: !conversation[field] });
    setConversations((current) => field === 'is_archived' ? current.filter((item) => item.id !== updated.id) : current.map((item) => item.id === updated.id ? updated : item));
    if (field === 'is_archived' && activeId === updated.id) setActiveId(null);
  };

  const deleteConversation = async (conversation: ConversationRow) => {
    if (!window.confirm('Delete this chat permanently?')) return;
    const { error } = await import('../lib/supabase').then(({ supabase }) => supabase.from('ai_conversations').delete().eq('id', conversation.id));
    if (error) toast.error(error.message);
    else {
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      if (activeId === conversation.id) setActiveId(null);
    }
  };

  const exportConversation = () => {
    if (!activeConversation) return;
    const text = parseMessages(activeConversation.messages).map((message) => `[${message.timestamp}] ${message.role.toUpperCase()}\n${message.content}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizguard-ai-${activeConversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleVoiceCommand = async () => {
    if (!voiceCommand.trim() || !businessId) return;
    setIsProcessingVoice(true);
    try {
      const result = await recordVoiceCommand(businessId, voiceCommand.trim());
      setVoiceResult(result);
      await sendMessage(`Voice command: ${voiceCommand}. Parsed intent: ${result.parsed_payload.intent}.`);
      if (result.allowed) setVoiceCommand('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Voice command failed. Apply subscription migration.');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const filteredConversations = conversations.filter((conversation) => `${conversation.title} ${conversation.category}`.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-6 xl:grid-cols-[340px_1fr_320px]">
      <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:flex xl:flex-col">
        <div className="border-b border-slate-200 p-4">
          <button onClick={() => createConversation()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 font-black text-white"><Plus className="h-4 w-4" /> New Chat</button>
          <div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search conversations..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? <p className="p-4 text-sm text-slate-500">Loading conversations...</p> : filteredConversations.map((conversation) => (
            <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={cn('mb-2 w-full rounded-xl p-3 text-left hover:bg-slate-50', activeConversation?.id === conversation.id && 'bg-emerald-50')}>
              <div className="flex items-start justify-between gap-2"><p className="line-clamp-1 font-semibold text-slate-800">{conversation.title}</p>{conversation.is_pinned && <Pin className="h-3 w-3 text-emerald-600" />}</div>
              <p className="mt-1 text-xs capitalize text-slate-500">{conversation.category} · {parseMessages(conversation.messages).length} messages</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-xl font-black text-slate-800">AI Assistant V3</h1><p className="text-sm text-slate-500">Multi-agent business operating companion with persistent memory</p></div><div className="flex flex-wrap gap-2"><button onClick={exportConversation} disabled={!activeConversation} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="inline h-4 w-4" /> Export</button>{activeConversation && <><button onClick={() => renameConversation(activeConversation)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><Edit3 className="h-4 w-4" /></button><button onClick={() => toggleConversation(activeConversation!, 'is_pinned')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{activeConversation.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button><button onClick={() => toggleConversation(activeConversation!, 'is_favorite')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><Star className={cn('h-4 w-4', activeConversation.is_favorite && 'fill-yellow-400 text-yellow-500')} /></button><button onClick={() => toggleConversation(activeConversation!, 'is_archived')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><Archive className="h-4 w-4" /></button><button onClick={() => deleteConversation(activeConversation!)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"><Trash2 className="h-4 w-4" /></button></>}</div></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{agentModes.map((agent) => <button key={agent.mode} onClick={() => setActiveMode(agent.mode)} className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold', activeMode === agent.mode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{agentModeLabel(agent.mode)}</button>)}</div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          {activeMessages.length === 0 ? <div className="mx-auto mt-10 max-w-2xl text-center"><Bot className="mx-auto h-14 w-14 text-emerald-600" /><h2 className="mt-4 text-2xl font-black text-slate-800">Ask your AI business team</h2><p className="mt-2 text-slate-500">Choose CFO, COO, Credit Controller, Sales Director, Inventory Strategist, Business Doctor or Guardian mode.</p><div className="mt-6 flex flex-wrap justify-center gap-2">{suggestedPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-emerald-50">{prompt}</button>)}</div></div> : activeMessages.map((message) => <div key={message.id} className={cn('mb-5 flex gap-3', message.role === 'user' && 'flex-row-reverse')}><div className={cn('grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-white', message.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600')}>{message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}</div><div className={cn('max-w-3xl rounded-2xl p-4 text-sm shadow-sm', message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800')}><p className="whitespace-pre-wrap">{message.content}</p><p className="mt-2 text-xs opacity-60">{agentModeLabel(message.mode || 'guardian')} · {new Date(message.timestamp).toLocaleString()}</p></div></div>)}
          {isThinking && <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">BizGuard AI is analyzing live business context...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-200 bg-white p-4"><div className="flex gap-3"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder={`Ask ${agentModeLabel(activeMode)}...`} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /><button onClick={() => sendMessage()} disabled={!input.trim() || isThinking} className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 font-black text-white disabled:opacity-50"><Send className="h-5 w-5" /></button></div></div>
      </section>

      <aside className="hidden space-y-4 xl:block">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-800">Agent Workspace</h3><div className="mt-4 space-y-3">{agentModes.map((agent) => <button key={agent.mode} onClick={() => { setActiveMode(agent.mode); createConversation(agent.category); }} className="block w-full rounded-xl bg-slate-50 p-3 text-left hover:bg-emerald-50"><p className="font-bold text-slate-800">{agentModeLabel(agent.mode)}</p><p className="text-xs text-slate-500">{agent.description}</p></button>)}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Volume2 className="h-5 w-5 text-emerald-600" /><h3 className="font-black text-slate-800">Voice Command Center</h3></div><textarea value={voiceCommand} onChange={(event) => setVoiceCommand(event.target.value)} rows={4} placeholder="Na 3 carton malt I sell today for 15k" className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm" /><button onClick={handleVoiceCommand} disabled={!voiceCommand.trim() || isProcessingVoice} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isProcessingVoice ? 'Processing...' : 'Process Voice'}</button>{voiceResult && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><p className="font-bold text-slate-800">Intent: {voiceResult.parsed_payload.intent}</p><p>{voiceResult.used_today} used · {voiceResult.is_unlimited ? 'Unlimited' : `${voiceResult.remaining_today ?? 0} left`}</p></div>}</div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-cyan-600" /><h3 className="font-black text-slate-800">Customer Care</h3></div><p className="mt-2 text-sm leading-6 text-slate-500">For complaints, feedback or account support, send the conversation to the BizGuard support team.</p><a href="mailto:goodshareintercontinentalventures@hotmail.com?subject=BizGuard%20Customer%20Care%20Request" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"><Mail className="h-4 w-4" /> Email Customer Care</a><a href="tel:07050480997" className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700">Call 07050480997</a></div>
      </aside>
    </div>
  );
};

export default AIAssistant;
