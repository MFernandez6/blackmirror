"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PhotoAnnotation, PhotoExif } from "@/lib/offline/types";
import { blobToJpeg, stampJpegExif } from "@/lib/inspection/capture";
import { getCurrentPosition } from "@/lib/inspection/geo";

type Props = {
  onCancel: () => void;
  onSave: (payload: {
    blob: Blob;
    annotations: PhotoAnnotation[];
    exif: PhotoExif;
    capturedAt: string;
  }) => Promise<void>;
};

export function CameraCapture({ onCancel, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tool, setTool] = useState<"circle" | "arrow">("arrow");
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>([]);
  const [draft, setDraft] = useState<number[][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void getCurrentPosition().then(setGps);
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setAnnotations([]);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.src = url;
  }

  function draw(extra?: PhotoAnnotation | null) {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const maxW = Math.min(window.innerWidth, 430);
    const scale = maxW / img.naturalWidth;
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const all = extra ? [...annotations, extra] : annotations;
    for (const stroke of all) paint(ctx, stroke, canvas.width, canvas.height);
    if (draft && draft.length) {
      paint(
        ctx,
        { tool, color: "#C6A85B", points: draft },
        canvas.width,
        canvas.height
      );
    }
  }

  function paint(
    ctx: CanvasRenderingContext2D,
    stroke: PhotoAnnotation,
    w: number,
    h: number
  ) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const pts = stroke.points.map(([x, y]) => [x * w, y * h] as const);
    if (stroke.tool === "circle" && pts.length >= 2) {
      const [a, b] = pts;
      const r = Math.hypot(b[0] - a[0], b[1] - a[1]);
      ctx.beginPath();
      ctx.arc(a[0], a[1], r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (stroke.tool === "arrow" && pts.length >= 2) {
      const start = pts[0];
      const end = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
      const head = 16;
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(
        end[0] - head * Math.cos(angle - 0.4),
        end[1] - head * Math.sin(angle - 0.4)
      );
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(
        end[0] - head * Math.cos(angle + 0.4),
        end[1] - head * Math.sin(angle + 0.4)
      );
      ctx.stroke();
    }
  }

  function toNorm(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    ];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft([toNorm(e)]);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    setDraft([draft[0], toNorm(e)]);
  }

  function onPointerUp() {
    if (draft && draft.length >= 2) {
      setAnnotations((prev) => [
        ...prev,
        { tool, color: "#C6A85B", points: draft },
      ]);
    }
    setDraft(null);
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, draft, tool, preview]);

  async function flattenAndSave() {
    if (!imageRef.current) return;
    setBusy(true);
    try {
      const img = imageRef.current;
      const full = document.createElement("canvas");
      full.width = img.naturalWidth;
      full.height = img.naturalHeight;
      const ctx = full.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      for (const stroke of annotations) {
        paint(ctx, stroke, full.width, full.height);
      }
      const jpeg = await blobToJpeg(full, 0.88);
      const capturedAt = new Date();
      const stamped = await stampJpegExif(jpeg, gps, capturedAt);
      await onSave({
        blob: stamped.blob,
        annotations,
        exif: stamped.exif,
        capturedAt: capturedAt.toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 pt-safe">
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-slate"
        >
          Cancel
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-gold">
          {gps ? "GPS LOCK" : "NO GPS"}
        </p>
      </div>

      {!preview ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="text-center text-sm text-brand-slate">
            Use the rear camera. Timestamp and GPS are stamped into EXIF on save.
          </p>
          <Button
            variant="solid"
            className="mt-6 h-14 w-full max-w-xs"
            onClick={() => fileRef.current?.click()}
          >
            Open camera
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              className="max-h-full max-w-full touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 px-3 py-3 pb-safe">
            <Button
              size="sm"
              variant={tool === "arrow" ? "solid" : "outline"}
              onClick={() => setTool("arrow")}
            >
              Arrow
            </Button>
            <Button
              size="sm"
              variant={tool === "circle" ? "solid" : "outline"}
              onClick={() => setTool("circle")}
            >
              Circle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAnnotations((a) => a.slice(0, -1))}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="solid"
              disabled={busy}
              onClick={() => void flattenAndSave()}
            >
              {busy ? "…" : "Save"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
