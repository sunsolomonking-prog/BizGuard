import React from 'react';
import { Camera, Check, Image as ImageIcon, Loader2, ScanLine, X, RotateCcw, Zap, ShieldCheck, SwitchCamera } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyzeBusinessSnap, type VisionAnalysisResult, type VisionDetection, type VisionMode } from '../../lib/visionInventory';
import { getSnapCountUsageStatus, type SnapUsageStatus } from '../../lib/subscriptions';

type KnownProduct = { id: string; name: string; sku: string; barcode: string | null };

interface SmartSnapModalProps {
  open: boolean;
  mode: VisionMode;
  businessId?: string | null;
  knownProducts?: KnownProduct[];
  onClose: () => void;
  onApply: (result: VisionAnalysisResult) => Promise<void> | void;
}

const confidenceLabel = (confidence: number) => confidence >= 0.9 ? 'High confidence' : confidence >= 0.7 ? 'Review recommended' : 'Low confidence — verify';

const waitForVideoFrame = async (video: HTMLVideoElement) => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
    await new Promise<void>((resolve) => {
      const onReady = () => { video.removeEventListener('loadeddata', onReady); resolve(); };
      video.addEventListener('loadeddata', onReady, { once: true });
      window.setTimeout(() => { video.removeEventListener('loadeddata', onReady); resolve(); }, 1800);
    });
  }
  if ('requestVideoFrameCallback' in video) {
    await new Promise<void>((resolve) => {
      const callback = () => resolve();
      (video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number }).requestVideoFrameCallback?.(callback);
      window.setTimeout(resolve, 250);
    });
  }
};

export const SmartSnapModal: React.FC<SmartSnapModalProps> = ({ open, mode, businessId, knownProducts = [], onClose, onApply }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<VisionAnalysisResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = React.useState(false);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [snapUsage, setSnapUsage] = React.useState<SnapUsageStatus | null>(null);
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => () => { mountedRef.current = false; }, []);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraStarting(false);
  }, []);

  const startCamera = React.useCallback(async (requestedFacing: 'environment' | 'user' = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is unavailable in this browser. Choose a photo instead.');
      return;
    }
    if (streamRef.current) return;

    setCameraError(null);
    setCameraStarting(true);
    setCameraReady(false);

    const profiles: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: requestedFacing }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 20, max: 24 }, ...( { focusMode: { ideal: 'continuous' } } as Record<string, unknown>) } as MediaTrackConstraints },
      { audio: false, video: { facingMode: requestedFacing, width: { ideal: 640, max: 960 }, height: { ideal: 480, max: 540 }, frameRate: { ideal: 15, max: 20 } } },
      { audio: false, video: true },
    ];

    let lastError: unknown = null;
    for (const constraints of profiles) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => undefined);
        await waitForVideoFrame(video);
        if (!mountedRef.current) return;
        setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    const errorName = lastError instanceof DOMException ? lastError.name : '';
    setCameraError(errorName === 'NotAllowedError'
      ? 'Camera permission is blocked. Allow camera access or choose a photo.'
      : 'Could not start the camera on this device. Choose a photo instead.');
    setCameraStarting(false);
  }, [facingMode]);

  React.useEffect(() => {
    if (!open) {
      stopCamera();
      setFile(null); setPreview(null); setResult(null); setBusy(false); setAnalysisError(null); setCameraError(null);
      return undefined;
    }
    void startCamera(facingMode);
    if (businessId) void getSnapCountUsageStatus(businessId).then(setSnapUsage).catch(() => setSnapUsage(null));
    return () => stopCamera();
  }, [open, facingMode, startCamera, stopCamera]);

  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!open) return null;

  const analyzeFile = async (nextFile: File) => {
    if (!businessId) { toast.error('Business workspace is not ready.'); return; }
    setBusy(true);
    setAnalysisError(null);
    try {
      const analysis = await analyzeBusinessSnap({ businessId, mode, file: nextFile, knownProducts });
      if (!mountedRef.current) return;
      setResult(analysis);
      if (!analysis.detections.length) toast('No countable products were confidently detected. Retake closer with better lighting.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Snap analysis failed.';
      const isSnapLimit = Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'SNAP_COUNT_LIMIT_REACHED');
      if (mountedRef.current) {
        setAnalysisError(message);
        toast.error(message);
        if (isSnapLimit) {
          window.setTimeout(() => { window.location.assign('/subscription?reason=snap_limit'); }, 700);
        } else if (businessId) {
          void getSnapCountUsageStatus(businessId).then(setSnapUsage).catch(() => undefined);
        }
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const chooseFile = (next: File | null, autoAnalyze = false) => {
    if (!next) return;
    if (!next.type.startsWith('image/')) { toast.error('Please choose an image.'); return; }
    stopCamera();
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setResult(null); setAnalysisError(null);
    if (autoAnalyze) void analyzeFile(next);
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera is still starting.');
      return;
    }
    await waitForVideoFrame(video);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) { toast.error('Camera capture is unavailable.'); return; }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    if (!blob) { toast.error('Could not capture the photo.'); return; }
    const next = new File([blob], `bizguard-snap-${Date.now()}.webp`, { type: 'image/webp' });
    chooseFile(next, true);
  };

  const analyze = () => file ? void analyzeFile(file) : toast.error('Take or choose a photo first.');

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    setFacingMode(next);
    void startCamera(next);
  };

  const updateDetection = (index: number, patch: Partial<VisionDetection>) => {
    setResult((current) => current ? { ...current, detections: current.detections.map((item, i) => i === index ? { ...item, ...patch } : item) } : current);
  };

  const apply = async () => {
    if (!result?.detections.length) { toast.error('There is nothing to apply.'); return; }
    await onApply(result);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="BizGuard Smart Snap">
      <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-600">BizGuard Vision</p><h2 className="truncate text-lg sm:text-xl font-black text-slate-950">{mode === 'inventory' ? 'Snap Count' : 'Snap Sale'}</h2><p className="text-xs text-slate-500">Instant camera → detect → count → review</p></div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.08fr_.92fr]">
          <div className="border-b border-slate-200 p-3 sm:p-5 lg:border-b-0 lg:border-r">
            {!preview ? (
              <div className="relative overflow-hidden rounded-2xl bg-slate-950 aspect-[4/3] min-h-[260px] sm:min-h-[320px]">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover [transform:translateZ(0)]" aria-label="Live product camera" />
                {!cameraReady && <div className="absolute inset-0 grid place-items-center bg-slate-950/80 p-6 text-center text-white"><div>{cameraStarting ? <Loader2 className="mx-auto h-9 w-9 animate-spin" /> : <Camera className="mx-auto h-9 w-9" />}<p className="mt-3 font-black">{cameraStarting ? 'Opening camera…' : 'Camera unavailable'}</p><p className="mt-1 text-xs text-slate-300">{cameraError || 'Use good light. Keep products inside the frame.'}</p></div></div>}
                {cameraReady && <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3"><span className="rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">Live · {facingMode === 'environment' ? 'rear' : 'front'} camera</span><span className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-[10px] font-black text-white">Ready</span></div>}
                {cameraReady && <div className="pointer-events-none absolute inset-[10%] rounded-2xl border-2 border-white/60 shadow-[0_0_0_999px_rgba(15,23,42,.08)]" />}
              </div>
            ) : <div className="relative overflow-hidden rounded-2xl bg-slate-950"><img src={preview} alt="Snap preview" className="max-h-[55vh] w-full object-contain" /><button onClick={() => { setFile(null); setPreview(null); setResult(null); setAnalysisError(null); void startCamera(facingMode); }} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-black text-white backdrop-blur"><RotateCcw className="h-4 w-4" /> Retake</button></div>}

            <input ref={inputRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => chooseFile(e.target.files?.[0] || null, true)} />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={takePhoto} disabled={!cameraReady || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-3 text-sm font-black text-white disabled:opacity-40"><Camera className="h-4 w-4" /> {busy ? 'Working…' : 'Capture & analyze'}</button>
              <button onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-black"><ImageIcon className="h-4 w-4" /> Photo</button>
              <button onClick={switchCamera} disabled={busy || cameraStarting} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-black"><SwitchCamera className="h-4 w-4" /> Flip camera</button>
              <button onClick={analyze} disabled={!file || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} {busy ? 'Analyzing…' : 'Analyze again'}</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><Zap className="h-4 w-4 shrink-0 text-cyan-600" /><span>Fast camera profile + compressed frames. Keep products sharp and fully visible.</span></div>
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><ShieldCheck className="h-4 w-4 shrink-0" /><span>Review required. AI never silently changes stock.</span></div>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {snapUsage && <div className={`mb-4 rounded-2xl border p-4 ${snapUsage.is_unlimited || (snapUsage.remaining_today ?? 0) > 0 ? 'border-cyan-200 bg-cyan-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Snap Count · {snapUsage.plan_name}</p><p className="mt-1 font-black text-slate-950">{snapUsage.is_unlimited ? 'Unlimited' : `${snapUsage.remaining_today ?? 0} remaining today`}</p></div>{!snapUsage.is_unlimited && <p className="text-xs font-bold text-slate-500">{snapUsage.used_today} / {snapUsage.daily_limit}</p>}</div>
              {!snapUsage.is_unlimited && (snapUsage.remaining_today ?? 0) === 0 && <button onClick={() => window.location.assign('/subscription?reason=snap_limit')} className="mt-3 w-full rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white">Upgrade to continue {mode === 'sales' ? 'Snap Sale' : 'Snap Count'}</button>}
            </div>}
            {analysisError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex items-start gap-3"><div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-red-500 text-center text-xs font-black leading-5 text-white">!</div><div className="min-w-0"><p className="font-black text-red-950">Vision analysis could not complete</p><p className="mt-1 break-words text-xs leading-5 text-red-800">{analysisError}</p><button onClick={analyze} disabled={!file || busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><ScanLine className="h-3.5 w-3.5" /> Retry analysis</button></div></div></div>}
            {!result ? <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600"><p className="font-black text-slate-900">Precision count</p><ul className="mt-3 space-y-2"><li>• Counts visible packages/objects conservatively.</li><li>• Uses your catalog when a product match is reliable.</li><li>• Barcode evidence is used when the device supports it.</li><li>• Every quantity is reviewable before Inventory or Sales changes.</li></ul></div> : <div><div className="rounded-2xl bg-emerald-50 p-4"><p className="font-black text-emerald-950">{result.summary}</p><p className="mt-1 text-xs text-emerald-800">{result.provider} · review required before database update</p></div><div className="mt-4 space-y-3">{result.detections.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-black text-slate-950">{item.name}</p><p className="mt-1 text-xs text-slate-500">{confidenceLabel(item.confidence)}{item.barcode ? ` · ${item.barcode}` : ''}</p></div><label className="w-24 shrink-0"><span className="text-[10px] font-black uppercase text-slate-400">Quantity</span><input type="number" min="0" max="10000" step="1" value={item.quantity} onChange={(e) => updateDetection(index, { quantity: Math.max(0, Math.min(10000, Math.floor(Number(e.target.value) || 0))) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-center font-black" /></label></div>{item.notes && <p className="mt-2 text-xs text-slate-500">{item.notes}</p>}</div>)}</div><button onClick={apply} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white hover:bg-emerald-700"><Check className="h-4 w-4" /> Apply reviewed result</button></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartSnapModal;
