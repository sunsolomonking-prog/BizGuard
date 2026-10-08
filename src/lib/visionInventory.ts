import { SUPABASE_ANON_KEY, SUPABASE_URL, ensureUserProfile, supabase } from './supabase';
import { optimizeSnapImage } from './imageOptimization';

export type VisionMode = 'inventory' | 'sales';

export interface VisionDetection {
  name: string;
  quantity: number;
  confidence: number;
  barcode?: string | null;
  category?: string | null;
  notes?: string | null;
  product_id?: string | null;
}

export interface VisionAnalysisResult {
  mode: VisionMode;
  detections: VisionDetection[];
  summary: string;
  provider: string;
  requires_review: boolean;
}

const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const ANALYSIS_TIMEOUT_MS = 28_000;

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image.'));
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(file);
});

const scanBarcodesFromImage = async (file: File): Promise<string[]> => {
  if (!('BarcodeDetector' in window) || typeof createImageBitmap !== 'function') return [];
  const Detector = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
  if (!Detector) return [];
  try {
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
    const bitmap = await createImageBitmap(file);
    const results = await detector.detect(bitmap);
    bitmap.close();
    return Array.from(new Set(results.map((result) => result.rawValue || '').filter(Boolean))).slice(0, 12);
  } catch {
    return [];
  }
};

const assessImageQuality = async (file: File) => {
  if (typeof createImageBitmap !== 'function') return;
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 480 || bitmap.height < 360) throw new Error('Image is too small for a reliable count. Move closer to the products and retake the photo.');
    // Cheap 48x48 luminance/contrast sample. It catches unusably dark frames
    // before paying the network/model latency cost.
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(bitmap, 0, 0, 48, 48);
    const pixels = context.getImageData(0, 0, 48, 48).data;
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      sum += luminance;
      sumSquares += luminance * luminance;
    }
    const count = pixels.length / 4;
    const mean = sum / count;
    const variance = Math.max(0, sumSquares / count - mean * mean);
    if (mean < 24 || variance < 18) throw new Error('The photo is too dark or flat for a reliable count. Improve lighting and retake the photo.');
  } finally {
    bitmap.close();
  }
};

export const analyzeBusinessSnap = async (input: {
  businessId: string;
  mode: VisionMode;
  file: File;
  knownProducts?: Array<{ id: string; name: string; sku: string; barcode: string | null }>;
}): Promise<VisionAnalysisResult> => {
  if (!input.file.type.startsWith('image/')) throw new Error('Snap requires an image.');

  const optimized = await optimizeSnapImage(input.file);
  if (optimized.size > MAX_IMAGE_BYTES) throw new Error('Image is still too large. Move closer to the products and retake the photo.');
  await assessImageQuality(optimized);

  const image = await fileToDataUrl(optimized);
  const detectedBarcodes = await scanBarcodesFromImage(optimized);
  const allProducts = input.knownProducts || [];
  const barcodeMatches = detectedBarcodes.length
    ? allProducts.filter((product) => product.barcode && detectedBarcodes.includes(product.barcode)).slice(0, 24)
    : [];
  const catalog = [...barcodeMatches, ...allProducts.filter((product) => !barcodeMatches.some((hit) => hit.id === product.id)).slice(0, 140)]
    .map((product) => ({ id: product.id, name: product.name, sku: product.sku, barcode: product.barcode }));

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Your BizGuard session has expired. Sign in again and retry Snap.');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('BizGuard Supabase configuration is missing. Check Vercel environment variables, then rebuild/redeploy the app.');

  // Repair the authenticated user's legacy BizGuard membership before calling
  // the server-side Vision gateway. Older sessions can legitimately have a
  // business in the app store while the public.users row was never created.
  // This is a client-side repair only; the Vercel gateway still performs the
  // authoritative membership check and will reject mismatched businesses.
  const profileRepair = await ensureUserProfile({ businessId: input.businessId });
  const repairedBusinessId = String(profileRepair.profile?.business_id || input.businessId).trim();
  if (profileRepair.error && !profileRepair.profile?.business_id) {
    throw new Error(`Your BizGuard business profile could not be prepared for Snap. ${profileRepair.error.message}`);
  }

  const requestBody = JSON.stringify({
    business_id: repairedBusinessId,
    mode: input.mode,
    image,
    known_products: catalog,
    barcode_hints: detectedBarcodes,
  });

  // Production path is deliberately same-origin Vercel only. This removes the
  // browser -> Supabase Edge Function CORS/preflight dependency that was causing
  // misleading double-failure messages in Snap Count. The Edge Function remains
  // deployable for server-side use, but is never required by the browser.
  const fallbackEndpoint = String(import.meta.env.VITE_VISION_FALLBACK_URL || '/api/bizguard-vision').trim();

  const parseResponse = async (response: Response, source: string): Promise<VisionAnalysisResult> => {
    const rawText = await response.text();
    let payload: any = null;
    try { payload = rawText ? JSON.parse(rawText) : null; } catch { payload = null; }
    if (!response.ok) {
      const platformCode = response.headers.get('sb-error-code') || '';
      if (response.status === 401) throw new Error(payload?.error || 'Vision authorization failed. Sign in again and retry Snap.');
      if (response.status === 402 && payload?.code === 'SNAP_COUNT_LIMIT_REACHED') {
        const message = payload?.error || 'You have reached today’s Snap Count limit. Upgrade your BizGuard plan to continue.';
        const limitError = new Error(message) as Error & { code?: string; redirectToSubscription?: boolean };
        limitError.code = 'SNAP_COUNT_LIMIT_REACHED';
        limitError.redirectToSubscription = true;
        throw limitError;
      }
      if (response.status === 403) throw new Error(payload?.error || 'BizGuard Vision rejected access to this business workspace.');
      if (response.status === 404 || platformCode === 'NOT_FOUND' || platformCode === 'NOT_FOUND_FUNCTION_BLOB') throw new Error(`${source} is not deployed.`);
      if (response.status === 413) throw new Error(payload?.error || 'The image is too large for Vision. Retake closer or reduce the frame.');
      if (response.status === 503) throw new Error(payload?.error || `${source} is not configured.`);
      throw new Error(payload?.error || `${source} returned HTTP ${response.status}.`);
    }
    const data = payload as VisionAnalysisResult | null;
    if (!data || !Array.isArray(data.detections)) throw new Error(`${source} returned an invalid analysis result.`);
    return {
      ...data,
      detections: data.detections.map((item) => ({
        ...item,
        quantity: Math.max(0, Math.min(10000, Math.floor(Number(item.quantity) || 0))),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      })).filter((item) => item.quantity > 0),
    };
  };

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch(fallbackEndpoint, {
        method: 'POST', signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-BizGuard-Vision-Client': '44.11-final-targeted-snap-admin-auth',
        },
        body: requestBody,
      });
      return await parseResponse(response, 'BizGuard Vision Vercel gateway');
    } finally {
      window.clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('BizGuard Vision timed out after 35 seconds. Retake a closer, well-lit photo and try again.');
    }
    throw error instanceof Error ? error : new Error('BizGuard Vision gateway request failed.');
  }

};

export const scanBarcodes = scanBarcodesFromImage;
