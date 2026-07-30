"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ImageCropperToolFixedProps {
  defaultW?: number;
  defaultH?: number;
  onConfirm: (file: File) => void;
}

export default function ImageCropperToolFixed({ defaultW = 400, defaultH = 600, onConfirm }: ImageCropperToolFixedProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [outW, setOutW] = useState(defaultW);
  const [outH, setOutH] = useState(defaultH);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [imgScale, setImgScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const natural = useRef({ w: 0, h: 0 });

  const loadFile = (file: File) => {
    setFilename(file.name);
    setImgOffset({ x: 0, y: 0 });
    setImgScale(1);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      natural.current = { w: img.naturalWidth, h: img.naturalHeight };
      setSrc(url);
    };
    img.src = url;
  };

  const autoFit = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const boxW = Math.min(outW, cw * 0.85);
    const boxH = Math.min(outH, ch * 0.85);
    const bs = Math.min(boxW / outW, boxH / outH, 1);
    const dbw = outW * bs;
    const dbh = outH * bs;
    const { iw, ih } = getImagePixelDims();
    if (iw === 0) return;
    const fit = Math.min(dbw / iw, dbh / ih);
    setImgScale(fit);
  }, [outW, outH]);

  const getImagePixelDims = () => {
    const nw = natural.current.w;
    const nh = natural.current.h;
    if (nw === 0) return { iw: 0, ih: 0 };
    const c = containerRef.current;
    if (!c) return { iw: 0, ih: 0 };
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const fitW = cw * 0.85;
    const fitH = ch * 0.85;
    const scale = Math.min(fitW / nw, fitH / nh, 1);
    return { iw: nw * scale, ih: nh * scale };
  };

  const renderPreview = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || outW === 0 || outH === 0) return;
    const c = containerRef.current;
    if (!c) return;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const boxW = Math.min(outW, cw * 0.85);
    const boxH = Math.min(outH, ch * 0.85);
    const boxScale = Math.min(boxW / outW, boxH / outH, 1);
    const displayBoxW = outW * boxScale;
    const displayBoxH = outH * boxScale;
    const boxX = (cw - displayBoxW) / 2;
    const boxY = (ch - displayBoxH) / 2;

    const { iw, ih } = getImagePixelDims();
    const displayImgW = iw * imgScale;
    const displayImgH = ih * imgScale;
    const imgDrawX = boxX + (displayBoxW - displayImgW) / 2 + imgOffset.x;
    const imgDrawY = boxY + (displayBoxH - displayImgH) / 2 + imgOffset.y;

    const scaleX = natural.current.w / iw;
    const scaleY = natural.current.h / ih;
    const cropSX = Math.max(0, (boxX - imgDrawX) / (displayImgW / natural.current.w));
    const cropSY = Math.max(0, (boxY - imgDrawY) / (displayImgH / natural.current.h));
    const cropSW = Math.min(natural.current.w - cropSX, displayBoxW / (displayImgW / natural.current.w));
    const cropSH = Math.min(natural.current.h - cropSY, displayBoxH / (displayImgH / natural.current.h));

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, cropSX, cropSY, cropSW, cropSH, 0, 0, outW, outH);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/webp", 0.82);
  };

  useEffect(() => {
    if (src) {
      autoFit();
      renderPreview();
    }
  }, [src, outW, outH, imgOffset, imgScale]);

  const zoomStep = 0.1;

  const handleWheel = (e: React.WheelEvent) => {
    if (!src) return;
    e.preventDefault();
    setImgScale((s) => Math.max(0.1, Math.min(5, s + (e.deltaY > 0 ? -zoomStep : zoomStep))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!src) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: imgOffset.x, oy: imgOffset.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const hMM = (e: MouseEvent) => {
      setImgOffset({ x: dragStart.current.ox + (e.clientX - dragStart.current.mx), y: dragStart.current.oy + (e.clientY - dragStart.current.my) });
    };
    const hMU = () => setDragging(false);
    document.addEventListener("mousemove", hMM);
    document.addEventListener("mouseup", hMU);
    return () => { document.removeEventListener("mousemove", hMM); document.removeEventListener("mouseup", hMU); };
  }, [dragging]);

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
              className="relative bg-gray-100 rounded-lg overflow-hidden"
              style={{ width: "100%", height: 400, cursor: src ? "grab" : "default" }}
              onWheel={handleWheel}
            >
              {src && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  onMouseDown={handleMouseDown}
                  style={{ cursor: dragging ? "grabbing" : "grab" }}
                >
                  {(() => {
                    const c = containerRef.current;
                    if (!c) return null;
                    const cw = c.clientWidth;
                    const ch = c.clientHeight;
                    const boxW = Math.min(outW, cw * 0.85);
                    const boxH = Math.min(outH, ch * 0.85);
                    const boxScale = Math.min(boxW / outW, boxH / outH, 1);
                    const dbw = outW * boxScale;
                    const dbh = outH * boxScale;
                    const bx = (cw - dbw) / 2;
                    const by = (ch - dbh) / 2;
                    const { iw, ih } = getImagePixelDims();
                    const diw = iw * imgScale;
                    const dih = ih * imgScale;
                    return (
                      <>
                        <div
                          className="absolute"
                          style={{
                            left: bx + (dbw - diw) / 2 + imgOffset.x,
                            top: by + (dbh - dih) / 2 + imgOffset.y,
                            width: diw,
                            height: dih,
                            backgroundImage: `url(${src})`,
                            backgroundSize: `${diw}px ${dih}px`,
                            backgroundPosition: "0 0",
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 pointer-events-none" style={{ clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${bx}px 0%, ${bx}px ${by}px, ${bx + dbw}px ${by}px, ${bx + dbw}px ${by + dbh}px, ${bx}px ${by + dbh}px, ${bx}px 0%, 0% 0%)` }} />
                        <div className="absolute border-2 border-white pointer-events-none" style={{ left: bx, top: by, width: dbw, height: dbh }} />
                        <div className="absolute text-white text-xs font-medium pointer-events-none" style={{ left: bx + 6, top: by + 6 }}>{outW}×{outH}</div>
                        <canvas ref={canvasRef} className="hidden" />
                      </>
                    );
                  })()}
                </div>
              )}
              {!src && <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No image loaded</div>}
            </div>
          </div>

          <div className="w-full lg:w-56 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Size</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Width</label>
                <input type="number" min={1} max={5000} value={outW} onChange={(e) => setOutW(Math.max(1, Number(e.target.value) || 1))} className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Height</label>
                <input type="number" min={1} max={5000} value={outH} onChange={(e) => setOutH(Math.max(1, Number(e.target.value) || 1))} className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm" />
              </div>
            </div>

            <hr className="border-gray-200" />
            <h3 className="text-sm font-semibold text-gray-700">Controls</h3>
            <p className="text-xs text-gray-500">The fixed box is centered. Drag the image to position it. Use the zoom controls or scroll to scale.</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setImgScale((s) => Math.max(0.1, s - zoomStep))} className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">−</button>
              <input type="number" min={10} max={500} value={Math.round(imgScale * 100)} onChange={(e) => setImgScale(Math.max(0.1, Math.min(5, (Number(e.target.value) || 100) / 100)))} className="w-16 px-2 py-1.5 border border-gray-200 rounded text-sm text-center" />
              <button onClick={() => setImgScale((s) => Math.min(5, s + zoomStep))} className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">+</button>
              <button onClick={() => { setImgOffset({ x: 0, y: 0 }); setImgScale(1); }} className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50 ml-auto">Reset</button>
            </div>

            <hr className="border-gray-200" />
            <h3 className="text-sm font-semibold text-gray-700">Preview ({outW}×{outH})</h3>
            <div className="bg-gray-50 rounded-lg overflow-hidden" style={{ width: "100%", aspectRatio: `${outW}/${outH}` }}>
              {previewUrl ? <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Preview</div>}
            </div>

            <hr className="border-gray-200" />
            <button onClick={() => {
              const img = imgRef.current;
              const canvas = canvasRef.current;
              if (!img || !canvas) return;
              canvas.toBlob((blob) => {
                if (!blob) return;
                const baseName = filename.replace(/\.[^.]+$/, "");
                onConfirm(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
              }, "image/webp", 0.82);
            }} className="w-full px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
