"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CropBox {
  x: number; y: number; w: number; h: number;
}

interface ImageCropperToolProps {
  defaultW?: number;
  defaultH?: number;
  onConfirm: (file: File) => void;
}

export default function ImageCropperTool({ defaultW = 460, defaultH = 290, onConfirm }: ImageCropperToolProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [mode, setMode] = useState<"preset" | "resize">("preset");
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outW, setOutW] = useState(defaultW);
  const [outH, setOutH] = useState(defaultH);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  const curRatio = outW / outH;

  const getDisplayDims = useCallback(() => {
    const c = containerRef.current;
    if (!c) return { dw: 0, dh: 0, dx: 0, dy: 0, scale: 1 };
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const iw = natural.w;
    const ih = natural.h;
    if (iw === 0 || ih === 0) return { dw: 0, dh: 0, dx: 0, dy: 0, scale: 1 };
    const scale = Math.min(cw / iw, ch / ih, 1);
    return { dw: iw * scale, dh: ih * scale, dx: (cw - iw * scale) / 2, dy: (ch - ih * scale) / 2, scale };
  }, [natural]);

  const initCropBox = useCallback((img: HTMLImageElement, w?: number, h?: number) => {
    const { dw, dh, dx, dy, scale } = getDisplayDims();
    if (dw === 0) return;
    let bw = (w ?? outW) * scale;
    let bh = (h ?? outH) * scale;
    if (bw > dw * 0.9) { const f = (dw * 0.9) / bw; bw *= f; bh *= f; }
    if (bh > dh * 0.9) { const f = (dh * 0.9) / bh; bw *= f; bh *= f; }
    if (bw < 10) bw = 10;
    if (bh < 10) bh = 10;
    const cx = dx + (dw - bw) / 2;
    const cy = dy + (dh - bh) / 2;
    setCropBox({ x: cx, y: cy, w: bw, h: bh });
  }, [getDisplayDims, outW, outH]);

  const loadFile = (file: File) => {
    setFilename(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setSrc(url);
    };
    img.src = url;
  };

  useEffect(() => {
    if (src && imgRef.current && natural.w > 0) {
      const timer = setTimeout(() => initCropBox(imgRef.current!), 50);
      return () => clearTimeout(timer);
    }
  }, [src, natural, outW, outH, initCropBox]);

  const handleImageClick = (e: React.MouseEvent) => {
    if (mode !== "preset") return;
    if (!containerRef.current || !imgRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { dw, dh, dx, dy, scale } = getDisplayDims();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx < dx || mx > dx + dw || my < dy || my > dy + dh) return;
    let bw = outW * scale;
    let bh = outH * scale;
    if (bw > dw) { const f = dw / bw; bw *= f; bh *= f; }
    if (bh > dh) { const f = dh / bh; bw *= f; bh *= f; }
    if (bw < 10) bw = 10;
    if (bh < 10) bh = 10;
    let cx = mx - bw / 2;
    let cy = my - bh / 2;
    cx = Math.max(dx, Math.min(dx + dw - bw, cx));
    cy = Math.max(dy, Math.min(dy + dh - bh, cy));
    setCropBox({ x: cx, y: cy, w: bw, h: bh });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { dw, dh, dx, dy } = getDisplayDims();
    if (mx < dx || mx > dx + dw || my < dy || my > dy + dh) return;

    const hs = 10;
    for (const h of ["nw", "ne", "sw", "se"]) {
      let hx: number, hy: number;
      if (h === "nw") { hx = cropBox.x; hy = cropBox.y; }
      else if (h === "ne") { hx = cropBox.x + cropBox.w - hs; hy = cropBox.y; }
      else if (h === "sw") { hx = cropBox.x; hy = cropBox.y + cropBox.h - hs; }
      else { hx = cropBox.x + cropBox.w - hs; hy = cropBox.y + cropBox.h - hs; }
      if (mx >= hx && mx <= hx + hs && my >= hy && my <= hy + hs) {
        setResizing(true); setActiveHandle(h);
        dragStart.current = { mx: e.clientX, my: e.clientY, cx: cropBox.x, cy: cropBox.y, cw: cropBox.w, ch: cropBox.h };
        return;
      }
    }
    if (mx >= cropBox.x && mx <= cropBox.x + cropBox.w && my >= cropBox.y && my <= cropBox.y + cropBox.h) {
      setDragging(true);
      dragStart.current = { mx: e.clientX, my: e.clientY, cx: cropBox.x, cy: cropBox.y, cw: cropBox.w, ch: cropBox.h };
    }
  };

  useEffect(() => {
    if (!dragging && !resizing) return;
    const hMM = (e: MouseEvent) => {
      const { dw, dh, dx, dy } = getDisplayDims();
      if (dragging) {
        const nx = Math.max(dx, Math.min(dx + dw - cropBox.w, dragStart.current.cx + (e.clientX - dragStart.current.mx)));
        const ny = Math.max(dy, Math.min(dy + dh - cropBox.h, dragStart.current.cy + (e.clientY - dragStart.current.my)));
        setCropBox((p) => ({ ...p, x: nx, y: ny }));
      } else if (resizing && activeHandle) {
        const dxm = e.clientX - dragStart.current.mx;
        const dym = e.clientY - dragStart.current.my;
        let nx = dragStart.current.cx, ny = dragStart.current.cy;
        let nw = dragStart.current.cw, nh = dragStart.current.ch;
        if (activeHandle.includes("e")) { nw = Math.max(20, dragStart.current.cw + dxm); nh = nw / curRatio; }
        if (activeHandle.includes("s")) { nh = Math.max(20 / curRatio, dragStart.current.ch + dym); nw = nh * curRatio; }
        if (activeHandle.includes("w")) { nw = Math.max(20, dragStart.current.cw - dxm); nh = nw / curRatio; nx = dragStart.current.cx + dragStart.current.cw - nw; }
        if (activeHandle.includes("n")) { nh = Math.max(20 / curRatio, dragStart.current.ch - dym); nw = nh * curRatio; ny = dragStart.current.cy + dragStart.current.ch - nh; }
        if (nx < dx) nx = dx;
        if (ny < dy) ny = dy;
        if (nx + nw > dx + dw) nx = dx + dw - nw;
        if (ny + nh > dy + dh) ny = dy + dh - nh;
        setCropBox({ x: nx, y: ny, w: nw, h: nh });
      }
    };
    const hMU = () => { setDragging(false); setResizing(false); setActiveHandle(null); };
    document.addEventListener("mousemove", hMM);
    document.addEventListener("mouseup", hMU);
    return () => { document.removeEventListener("mousemove", hMM); document.removeEventListener("mouseup", hMU); };
  }, [dragging, resizing, activeHandle, cropBox, getDisplayDims, curRatio]);

  useEffect(() => {
    if (!src || !imgRef.current || cropBox.w === 0) return;
    const img = imgRef.current;
    const { dw, dh, dx, dy, scale } = getDisplayDims();
    if (dw === 0 || scale === 0) return;
    const sx = (cropBox.x - dx) / scale;
    const sy = (cropBox.y - dy) / scale;
    const sw = cropBox.w / scale;
    const sh = cropBox.h / scale;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/webp", 0.82);
  }, [cropBox, src, getDisplayDims, outW, outH]);

  const handleOk = () => {
    if (!imgRef.current || cropBox.w === 0) return;
    const img = imgRef.current;
    const { scale } = getDisplayDims();
    const sx = (cropBox.x - getDisplayDims().dx) / scale;
    const sy = (cropBox.y - getDisplayDims().dy) / scale;
    const sw = cropBox.w / scale;
    const sh = cropBox.h / scale;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = filename.replace(/\.[^.]+$/, "");
      onConfirm(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
    }, "image/webp", 0.82);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {!src ? (
        <label className="flex flex-col items-center justify-center py-16 cursor-pointer hover:bg-gray-50 transition">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-gray-500">Click to select an image</span>
          <span className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 10MB</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </label>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 p-4">
          <div className="flex-1 min-w-0">
            <div
              ref={containerRef}
              className="relative bg-gray-100 rounded-lg overflow-hidden select-none"
              style={{ width: "100%", height: 340, cursor: mode === "preset" ? "crosshair" : "default" }}
              onClick={handleImageClick}
              onMouseDown={handleMouseDown}
            >
              <img src={src} className="absolute w-full h-full" style={{ objectFit: "contain" }} draggable={false} alt="Source" />
              {cropBox.w > 0 && (
                <>
                  <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{ clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropBox.x}px 0%, ${cropBox.x}px ${cropBox.y}px, ${cropBox.x + cropBox.w}px ${cropBox.y}px, ${cropBox.x + cropBox.w}px ${cropBox.y + cropBox.h}px, ${cropBox.x}px ${cropBox.y + cropBox.h}px, ${cropBox.x}px 0%, 0% 0%)` }} />
                  <div className="absolute border-2 border-white pointer-events-none" style={{ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h }} />
                  {["nw", "ne", "sw", "se"].map((h) => (
                    <div key={h} className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" style={{
                      left: h.includes("w") ? cropBox.x - 5 : cropBox.x + cropBox.w - 5,
                      top: h.includes("n") ? cropBox.y - 5 : cropBox.y + cropBox.h - 5,
                    }} />
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="w-full lg:w-56 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Size</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Width</label>
                <input type="number" min={1} max={5000} value={outW} onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setOutW(v); if (imgRef.current) initCropBox(imgRef.current, v, outH); }} className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Height</label>
                <input type="number" min={1} max={5000} value={outH} onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setOutH(v); if (imgRef.current) initCropBox(imgRef.current, outW, v); }} className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm" />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 pt-1">Tools</h3>
            <div className="flex gap-2">
              <button onClick={() => setMode("preset")} className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition ${mode === "preset" ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Preset</button>
              <button onClick={() => setMode("resize")} className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition ${mode === "resize" ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Resize</button>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
              {mode === "preset" ? `Click anywhere on the image to place a ${outW}×${outH} box. The box never exceeds Size values above.` : `Drag corner handles to resize. Aspect ratio (${outW}:${outH}) is locked.`}
            </div>

            <hr className="border-gray-200" />
            <h3 className="text-sm font-semibold text-gray-700">Preview ({outW}×{outH})</h3>
            <div className="bg-gray-50 rounded-lg overflow-hidden" style={{ width: "100%", aspectRatio: `${outW}/${outH}` }}>
              {previewUrl ? <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Preview</div>}
            </div>

            <hr className="border-gray-200" />
            <div className="flex gap-2">
              <button onClick={handleOk} className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition">OK</button>
              <button onClick={() => { if (imgRef.current) initCropBox(imgRef.current); }} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
