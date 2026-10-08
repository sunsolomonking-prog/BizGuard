import React from 'react';
import { Camera, FileUp, Mic, MicOff, X, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store';
import { supabase } from '../../lib/supabase';

interface CaptureItem { id: string; name: string; url: string; type: string; }

const SpeechRecognitionCtor = () => {
  const candidate = (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
  return (candidate.SpeechRecognition || candidate.webkitSpeechRecognition) as (new () => { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; }) | undefined;
};

export const QuickCaptureBar: React.FC = () => {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [captures, setCaptures] = React.useState<CaptureItem[]>([]);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const recognitionRef = React.useRef<{ start: () => void; stop: () => void } | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: CaptureItem[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
        toast.error(`${file.name}: choose an image or PDF.`);
        continue;
      }
      const url = URL.createObjectURL(file);
      next.push({ id: `${Date.now()}-${Math.random()}`, name: file.name, url, type: file.type });
      if (user?.id) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${user.id}/${Date.now()}-${safeName}`;
          await supabase.storage.from('bizguard-captures').upload(path, file, { upsert: false, contentType: file.type });
        } catch {
          // Preview remains available even when the optional storage bucket has not been migrated yet.
        }
      }
    }
    setCaptures((current) => [...next, ...current].slice(0, 8));
    if (next.length) toast.success(`${next.length} capture${next.length > 1 ? 's' : ''} ready.`);
  };

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch {
      toast.error('Camera access was blocked. You can still choose an image from your device.');
      cameraRef.current?.click();
    }
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    const file = new File([blob], `bizguard-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    await handleFiles(transfer.files);
    stopCamera();
  };

  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) { toast.error('Voice input is not available in this browser.'); return; }
    const recognition = new Ctor();
    recognition.lang = 'en-NG';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ');
      setTranscript(text);
    };
    recognition.onerror = (event: { error?: string }) => {
      setListening(false);
      const code = event?.error || 'unknown';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') toast.error('Microphone access is blocked. Allow microphone access and try again.');
      else if (code === 'audio-capture') toast.error('No microphone was available. Check the device microphone.');
      else toast.error('Voice recognition could not complete. Please try again.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setTranscript('');
    setListening(true);
    recognition.start();
  };

  React.useEffect(() => {
    let cancelled = false;
    const loadRecentCaptures = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase.storage.from('bizguard-captures').list(user.id, { limit: 8, sortBy: { column: 'created_at', order: 'desc' } });
      if (cancelled || error || !data?.length) return;
      const items: CaptureItem[] = [];
      for (const item of data) {
        const path = `${user.id}/${item.name}`;
        const signed = await supabase.storage.from('bizguard-captures').createSignedUrl(path, 3600);
        if (cancelled || signed.error || !signed.data?.signedUrl) continue;
        items.push({ id: path, name: item.name, url: signed.data.signedUrl, type: item.metadata?.mimetype || 'application/octet-stream' });
      }
      if (!cancelled) setCaptures(items);
    };
    loadRecentCaptures();
    return () => { cancelled = true; recognitionRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [user?.id]);

  return (
    <section className="sticky bottom-3 z-30 mx-auto mb-2 w-full max-w-4xl px-1">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggleVoice} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${listening ? 'bg-rose-500 text-white' : 'bg-slate-950 text-white hover:bg-slate-800'}`}><span className="grid h-6 w-6 place-items-center rounded-full bg-white/10">{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</span>{listening ? 'Listening…' : 'Speak'}</button>
          <button onClick={openCamera} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"><Camera className="h-4 w-4" /> Snap</button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"><FileUp className="h-4 w-4" /> Upload</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <div className="min-w-[180px] flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">{transcript || 'Speak, snap or upload. BizGuard keeps the next step simple.'}</div>
          {transcript && <button onClick={() => navigate(`/ai-assistant?input=${encodeURIComponent(transcript)}`)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Use <ArrowRight className="h-4 w-4" /></button>}
          {captures.length > 0 && <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2 py-1.5">{captures.slice(0, 4).map((item) => <button key={item.id} title={item.name} onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} className="relative h-9 w-9 overflow-hidden rounded-lg border border-slate-200 bg-white">{item.type.startsWith('image/') ? <img src={item.url} alt={item.name} className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-4 w-4 text-slate-400" />}<span className="absolute right-0 top-0 rounded-bl bg-white/90 p-0.5"><X className="h-2.5 w-2.5" /></span></button>)}</div>}
        </div>
      </div>
      {cameraOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/80 p-4" onMouseDown={(event) => event.currentTarget === event.target && stopCamera()}>
        <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Live camera</p><p className="mt-1 text-sm font-bold text-slate-900">Frame the receipt, product or document</p></div><button onClick={stopCamera} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <div className="bg-black p-3"><video ref={videoRef} autoPlay playsInline muted className="max-h-[65vh] w-full rounded-2xl object-contain" /></div>
          <div className="flex items-center justify-end gap-2 p-4"><button onClick={stopCamera} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Cancel</button><button onClick={takePhoto} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"><Camera className="h-4 w-4" /> Take photo</button></div>
        </div>
      </div>}
    </section>
  );
};

export default QuickCaptureBar;
