"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceNotes({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<InstanceType<RecognitionCtor> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setSupported(!!getRecognition());
  }, []);

  function toggle() {
    const Ctor = getRecognition();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const piece = last?.[0]?.transcript?.trim();
      if (piece) {
        const current = valueRef.current;
        onChange(current ? `${current.trim()} ${piece}` : piece);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Dictate or type field notes"
        className="min-h-[120px]"
      />
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        className="mt-2 inline-flex h-11 items-center gap-2 border border-white/15 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold disabled:opacity-40"
      >
        {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        {supported
          ? listening
            ? "Stop dictation"
            : "Voice to text"
          : "Voice unavailable — type"}
      </button>
    </div>
  );
}
