const MAX_DIMENSION = 1600;
const TARGET_BYTES = 1_500_000;
const HARD_MAX_BYTES = 4_500_000;

const isImageBitmap = (source: ImageBitmap | HTMLImageElement): source is ImageBitmap =>
  typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap;

const closeSource = (source: ImageBitmap | HTMLImageElement) => {
  if (isImageBitmap(source)) source.close();
};

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // Safari/older browsers fall through to HTMLImageElement.
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The captured image could not be decoded on this device. Retake the photo or choose Photo from your library.'));
      image.src = url;
    });
    // Safari can report a decode failure even after load; treat decode as a
    // best-effort optimization rather than making the entire Snap pipeline fail.
    try { await image.decode(); } catch { /* loaded image is still usable */ }
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Keep the camera/vision path bounded without throwing away useful detail.
 * A smaller payload improves mobile upload time; the hard ceiling prevents
 * oversized camera files from reaching the edge function.
 */
export const optimizeSnapImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) throw new Error('Snap requires an image.');

  // Captured BizGuard frames are already bounded/compressed. Avoid a second
  // decode/re-encode cycle, which was an unnecessary source of mobile delay.
  if ((file.type === 'image/webp' || file.type === 'image/jpeg') && file.size <= TARGET_BYTES && file.name.startsWith('bizguard-snap-')) {
    return file;
  }

  const source = await loadBitmap(file);
  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  if (file.size <= TARGET_BYTES && scale === 1) {
    closeSource(source);
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!context) {
    closeSource(source);
    return file.size <= HARD_MAX_BYTES ? file : (() => { throw new Error('Could not prepare the image for analysis.'); })();
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  closeSource(source);

  // WebP first: usually the best camera-photo size/quality trade-off.
  let blob = await canvasToBlob(canvas, 'image/webp', 0.84);
  if (!blob) blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
  if (!blob) return file;

  // If the first pass is still large, lower quality rather than increasing
  // resolution. The vision model benefits more from a clean bounded frame.
  if (blob.size > TARGET_BYTES) {
    const compressed = await canvasToBlob(canvas, blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.72);
    if (compressed && compressed.size < blob.size) blob = compressed;
  }

  if (blob.size > HARD_MAX_BYTES) throw new Error('Image is too large. Move closer to the products and retake the photo.');

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
};
