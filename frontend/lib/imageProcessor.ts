/**
 * Client-side image preprocessing module.
 * Converts uploads into optimized WebP files with smart center-cropping.
 * Zero dependencies — uses native HTML5 Canvas API.
 */

export interface ImagePreset {
  width: number;
  height: number;
  quality: number;
  brightness: number;
  sharpness: number;
  label: string;
}

export const PRESETS = {
  hero: { width: 1920, height: 1080, quality: 0.82, brightness: 100, sharpness: 0, label: "Hero Banner" } as ImagePreset,
  card: { width: 800, height: 450, quality: 0.80, brightness: 100, sharpness: 0, label: "Property Card" } as ImagePreset,
  portrait: { width: 400, height: 400, quality: 0.78, brightness: 100, sharpness: 0, label: "Team Portrait" } as ImagePreset,
} as const;

export type PresetKey = keyof typeof PRESETS;

export interface ProcessOptions {
  preset: PresetKey | ImagePreset;
  outputQuality?: number;
}

export interface ProgressCallback {
  (status: string): void;
}

const DEFAULT_PROGRESS: ProgressCallback = () => {};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function resolvePreset(preset: PresetKey | ImagePreset): ImagePreset {
  if (typeof preset === "string") {
    return PRESETS[preset];
  }
  return preset;
}

/**
 * Smart center-crop: scales the image to cover the target dimensions,
 * then crops from center. Never stretches or squishes.
 */
function centerCrop(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  brightness: number,
  sharpness: number = 0
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;

  const targetRatio = targetW / targetH;
  const srcRatio = img.naturalWidth / img.naturalHeight;

  let sx: number, sy: number, sw: number, sh: number;

  if (srcRatio > targetRatio) {
    sh = img.naturalHeight;
    sw = sh * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  if (brightness !== 100) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;
    const factor = brightness / 100;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * factor);
      data[i + 1] = Math.min(255, data[i + 1] * factor);
      data[i + 2] = Math.min(255, data[i + 2] * factor);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  if (sharpness > 0) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;
    const factor = sharpness / 100;
    const copy = new Uint8ClampedArray(data);
    for (let y = 1; y < targetH - 1; y++) {
      for (let x = 1; x < targetW - 1; x++) {
        const idx = (y * targetW + x) * 4;
        for (let c = 0; c < 3; c++) {
          const top = copy[((y - 1) * targetW + x) * 4 + c];
          const bottom = copy[((y + 1) * targetW + x) * 4 + c];
          const left = copy[(y * targetW + (x - 1)) * 4 + c];
          const right = copy[(y * targetW + (x + 1)) * 4 + c];
          const sharpened = 5 * copy[idx + c] - top - bottom - left - right;
          data[idx + c] = Math.min(255, Math.max(0, copy[idx + c] + factor * (sharpened - copy[idx + c])));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  filename: string,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Canvas toBlob failed"));
        const baseName = filename.replace(/\.[^.]+$/, "");
        const newName = `${baseName}.webp`;
        resolve(new File([blob], newName, { type: "image/webp" }));
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Process a single file: center-crop, transcode to WebP, compress.
 * Returns a File object ready for FormData.append().
 */
export async function processImage(
  file: File,
  options: ProcessOptions,
  onProgress: ProgressCallback = DEFAULT_PROGRESS
): Promise<File> {
  const preset = resolvePreset(options.preset);
  const quality = options.outputQuality ?? preset.quality;

  onProgress(`Optimizing image locally (${preset.label})...`);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    onProgress("Cropping & encoding...");

    const canvas = centerCrop(img, preset.width, preset.height, preset.brightness, preset.sharpness);
    const result = await canvasToFile(canvas, file.name, quality);

    const ratio = ((1 - result.size / file.size) * 100).toFixed(0);
    onProgress(`Done — ${result.size < 1024 ? result.size : `${(result.size / 1024).toFixed(0)}KB`} (${ratio}% smaller)`);

    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Process multiple files with the same preset.
 * Returns File[] in the same order as input.
 */
export async function processImages(
  files: File[],
  options: ProcessOptions,
  onProgress: ProgressCallback = DEFAULT_PROGRESS
): Promise<File[]> {
  const results: File[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress(`[${i + 1}/${files.length}] Processing...`);
    results.push(await processImage(files[i], options, onProgress));
  }
  return results;
}

/**
 * Compress a single image to WebP WITHOUT cropping.
 * The full image is preserved (aspect ratio kept) and only downscaled
 * when its longest edge exceeds `maxSize`. Never crops or stretches.
 */
export async function compressToWebP(
  file: File,
  options: { maxSize?: number; quality?: number } = {},
  onProgress: ProgressCallback = DEFAULT_PROGRESS
): Promise<File> {
  const maxSize = options.maxSize ?? 1600;
  const quality = options.quality ?? 0.82;

  onProgress("Optimizing image locally...");

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    onProgress("Encoding as WebP...");

    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const outW = Math.max(1, Math.round(img.naturalWidth * scale));
    const outH = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, outW, outH);

    const result = await canvasToFile(canvas, file.name, quality);
    const ratio = ((1 - result.size / file.size) * 100).toFixed(0);
    onProgress(`Done — ${result.size < 1024 ? result.size : `${(result.size / 1024).toFixed(0)}KB`} (${ratio}% smaller)`);

    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compress multiple files to WebP without cropping.
 * Returns File[] in the same order as input.
 */
export async function compressImagesToWebP(
  files: File[],
  options: { maxSize?: number; quality?: number } = {},
  onProgress: ProgressCallback = DEFAULT_PROGRESS
): Promise<File[]> {
  const results: File[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress(`[${i + 1}/${files.length}] Processing...`);
    results.push(await compressToWebP(files[i], options, onProgress));
  }
  return results;
}

/**
 * Attach to an <input type="file"> element.
 */
export function attachImageProcessor(
  input: HTMLInputElement,
  config: {
    preset: PresetKey | ImagePreset;
    onFiles: (files: File[]) => void | Promise<void>;
    onStatus?: ProgressCallback;
    multiple?: boolean;
  }
): () => void {
  const handler = async () => {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    try {
      const processed = await processImages(
        files,
        { preset: config.preset },
        config.onStatus
      );
      await config.onFiles(processed);
    } catch (err) {
      console.error("Image processing failed:", err);
      config.onStatus?.("Processing failed — uploading original.");
      await config.onFiles(files);
    } finally {
      input.value = "";
    }
  };

  input.addEventListener("change", handler);
  return () => input.removeEventListener("change", handler);
}
