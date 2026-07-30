"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";

export interface ImageSettings {
  width: number;
  height: number;
  quality: number;
  brightness: number;
  sharpness: number;
}

interface ImageProcessingModalProps {
  src: string;
  filename: string;
  defaults: ImageSettings;
  onConfirm: (processed: File) => void;
  onCancel: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function applyBrightness(ctx: CanvasRenderingContext2D, w: number, h: number, brightness: number) {
  if (brightness === 100) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const factor = brightness / 100;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * factor);
    data[i + 1] = Math.min(255, data[i + 1] * factor);
    data[i + 2] = Math.min(255, data[i + 2] * factor);
  }
  ctx.putImageData(imageData, 0, 0);
}

function applySharpness(ctx: CanvasRenderingContext2D, w: number, h: number, sharpness: number) {
  if (sharpness <= 0) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const factor = sharpness / 100;
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = copy[((y - 1) * w + x) * 4 + c];
        const bottom = copy[((y + 1) * w + x) * 4 + c];
        const left = copy[(y * w + (x - 1)) * 4 + c];
        const right = copy[(y * w + (x + 1)) * 4 + c];
        const sharpened = 5 * copy[idx + c] - top - bottom - left - right;
        data[idx + c] = Math.min(255, Math.max(0, copy[idx + c] + factor * (sharpened - copy[idx + c])));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

const sliderClass =
  "w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-[var(--primary)]";

export default function ImageProcessingModal({
  src,
  filename,
  defaults,
  onConfirm,
  onCancel,
}: ImageProcessingModalProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ImageSettings>({ ...defaults });
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const targetRatio = defaults.width / defaults.height;

  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });

  const previewUrlRef = useRef<string | null>(null);

  const fitCropToContainer = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const imgRatio = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (imgRatio > cw / ch) {
      drawW = cw;
      drawH = cw / imgRatio;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgRatio;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    }

    const maxCropW = drawW * 0.95;
    const maxCropH = drawH * 0.95;

    let cropW: number, cropH: number;
    if (maxCropW / maxCropH > targetRatio) {
      cropH = maxCropH;
      cropW = cropH * targetRatio;
    } else {
      cropW = maxCropW;
      cropH = cropW / targetRatio;
    }

    const cx = drawX + (drawW - cropW) / 2;
    const cy = drawY + (drawH - cropH) / 2;

    setCropBox({ x: cx, y: cy, w: cropW, h: cropH });
  }, [targetRatio]);

  useEffect(() => {
    loadImage(src).then((img) => {
      imgRef.current = img;
      fitCropToContainer();
    });
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); };
  }, [src, fitCropToContainer]);

  useEffect(() => {
    const handleResize = () => fitCropToContainer();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitCropToContainer]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: cropBox.x, cy: cropBox.y };
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      const img = imgRef.current;
      if (!img) return;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > cw / ch) {
        drawW = cw; drawH = cw / imgRatio; drawX = 0; drawY = (ch - drawH) / 2;
      } else {
        drawH = ch; drawW = ch * imgRatio; drawX = (cw - drawW) / 2; drawY = 0;
      }

      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      let nx = dragStart.current.cx + dx;
      let ny = dragStart.current.cy + dy;

      nx = Math.max(drawX, Math.min(drawX + drawW - cropBox.w, nx));
      ny = Math.max(drawY, Math.min(drawY + drawH - cropBox.h, ny));

      setCropBox((prev) => ({ ...prev, x: nx, y: ny }));
    };

    const handleMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, cropBox.w, cropBox.h]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mx: t.clientX, my: t.clientY, cx: cropBox.x, cy: cropBox.y };
  };

  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      const img = imgRef.current;
      if (!img) return;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > cw / ch) {
        drawW = cw; drawH = cw / imgRatio; drawX = 0; drawY = (ch - drawH) / 2;
      } else {
        drawH = ch; drawW = ch * imgRatio; drawX = (cw - drawW) / 2; drawY = 0;
      }

      const dx = t.clientX - dragStart.current.mx;
      const dy = t.clientY - dragStart.current.my;
      let nx = dragStart.current.cx + dx;
      let ny = dragStart.current.cy + dy;

      nx = Math.max(drawX, Math.min(drawX + drawW - cropBox.w, nx));
      ny = Math.max(drawY, Math.min(drawY + drawH - cropBox.h, ny));

      setCropBox((prev) => ({ ...prev, x: nx, y: ny }));
    };

    const handleTouchEnd = () => setDragging(false);

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragging, cropBox.w, cropBox.h]);

  const generatePreview = useCallback(async () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || cropBox.w === 0) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgRatio > cw / ch) {
      drawW = cw; drawH = cw / imgRatio; drawX = 0; drawY = (ch - drawH) / 2;
    } else {
      drawH = ch; drawW = ch * imgRatio; drawX = (cw - drawW) / 2; drawY = 0;
    }

    const scaleX = img.naturalWidth / drawW;
    const scaleY = img.naturalHeight / drawH;

    const sx = (cropBox.x - drawX) * scaleX;
    const sy = (cropBox.y - drawY) * scaleY;
    const sw = cropBox.w * scaleX;
    const sh = cropBox.h * scaleY;

    const canvas = document.createElement("canvas");
    canvas.width = settings.width;
    canvas.height = settings.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, settings.width, settings.height);

    applyBrightness(ctx, settings.width, settings.height, settings.brightness);
    applySharpness(ctx, settings.width, settings.height, settings.sharpness);

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    canvas.toBlob(
      (blob) => { if (blob) { const url = URL.createObjectURL(blob); previewUrlRef.current = url; setPreviewUrl(url); } },
      "image/webp",
      settings.quality
    );
  }, [cropBox, settings]);

  useEffect(() => {
    if (!imgRef.current || !containerRef.current || cropBox.w === 0) return;
    generatePreview();
  }, [generatePreview]);

  const handleConfirm = async () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || cropBox.w === 0) return;
    setProcessing(true);

    try {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > cw / ch) {
        drawW = cw; drawH = cw / imgRatio; drawX = 0; drawY = (ch - drawH) / 2;
      } else {
        drawH = ch; drawW = ch * imgRatio; drawX = (cw - drawW) / 2; drawY = 0;
      }

      const scaleX = img.naturalWidth / drawW;
      const scaleY = img.naturalHeight / drawH;

      const sx = (cropBox.x - drawX) * scaleX;
      const sy = (cropBox.y - drawY) * scaleY;
      const sw = cropBox.w * scaleX;
      const sh = cropBox.h * scaleY;

      const canvas = document.createElement("canvas");
      canvas.width = settings.width;
      canvas.height = settings.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, settings.width, settings.height);

      applyBrightness(ctx, settings.width, settings.height, settings.brightness);
      applySharpness(ctx, settings.width, settings.height, settings.sharpness);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
          "image/webp",
          settings.quality
        );
      });
      const baseName = filename.replace(/\.[^.]+$/, "");
      const file = new File([blob], `${baseName}.webp`, { type: "image/webp" });
      onConfirm(file);
    } catch {
      toast("Processing failed", "error");
    }
    setProcessing(false);
  };

  const inputRow = "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">Process Image</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PREVIEW + CROP */}
        <div className="px-5 pt-4">
          <div
            ref={containerRef}
            className="relative rounded-lg overflow-hidden bg-gray-900 select-none"
            style={{ height: 340 }}
          >
            {previewUrl ? (
              <>
                <img
                  src={imgRef.current?.src || src}
                  alt="Original"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
                {/* Dark overlay outside crop */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(to right,
                      rgba(0,0,0,0.55) ${cropBox.x}px,
                      transparent ${cropBox.x}px,
                      transparent ${cropBox.x + cropBox.w}px,
                      rgba(0,0,0,0.55) ${cropBox.x + cropBox.w}px)`,
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(to bottom,
                      rgba(0,0,0,0.55) ${cropBox.y}px,
                      transparent ${cropBox.y}px,
                      transparent ${cropBox.y + cropBox.h}px,
                      rgba(0,0,0,0.55) ${cropBox.y + cropBox.h}px)`,
                  }}
                />
                {/* Crop box */}
                <div
                  className="absolute border-2 border-white cursor-move"
                  style={{
                    left: cropBox.x,
                    top: cropBox.y,
                    width: cropBox.w,
                    height: cropBox.h,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                  }}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                >
                  {/* Corner handles */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-2 border-white rounded-sm" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-2 border-white rounded-sm" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-2 border-white rounded-sm" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-sm" />
                </div>
              </>
            ) : (
              <div className="py-12 text-gray-400 text-sm text-center">Loading preview...</div>
            )}
            {processing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-white text-sm font-medium">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Drag the crop area to select the region you want to keep</p>
        </div>

        {/* CONTROLS */}
        <div className="px-5 py-3 space-y-3">
          {/* QUALITY */}
          <div className={inputRow}>
            <label className="text-sm font-semibold text-gray-700 w-24 shrink-0">
              Quality <span className="text-gray-400 font-normal">({settings.quality})</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={settings.quality}
              onChange={(e) => setSettings((s) => ({ ...s, quality: Number(e.target.value) }))}
              className={sliderClass}
            />
            <div className="flex justify-between text-[10px] text-gray-400 w-20 shrink-0">
              <span>Small</span>
              <span>Sharp</span>
            </div>
          </div>

          {/* BRIGHTNESS */}
          <div className={inputRow}>
            <label className="text-sm font-semibold text-gray-700 w-24 shrink-0">
              Brightness <span className="text-gray-400 font-normal">({settings.brightness}%)</span>
            </label>
            <input
              type="range"
              min={10}
              max={200}
              step={1}
              value={settings.brightness}
              onChange={(e) => setSettings((s) => ({ ...s, brightness: Number(e.target.value) }))}
              className={sliderClass}
            />
            <div className="flex justify-between text-[10px] text-gray-400 w-20 shrink-0">
              <span>Dark</span>
              <span>Bright</span>
            </div>
          </div>

          {/* SHARPNESS */}
          <div className={inputRow}>
            <label className="text-sm font-semibold text-gray-700 w-24 shrink-0">
              Sharpness <span className="text-gray-400 font-normal">({settings.sharpness}%)</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.sharpness}
              onChange={(e) => setSettings((s) => ({ ...s, sharpness: Number(e.target.value) }))}
              className={sliderClass}
            />
            <div className="flex justify-between text-[10px] text-gray-400 w-20 shrink-0">
              <span>Soft</span>
              <span>Sharp</span>
            </div>
          </div>

          {imgRef.current && (
            <p className="text-[11px] text-gray-400">
              Original: {imgRef.current.naturalWidth}×{imgRef.current.naturalHeight}px &nbsp;|&nbsp; Output: {settings.width}×{settings.height}px
            </p>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition disabled:opacity-50"
          >
            {processing ? "Processing..." : "Process & Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
