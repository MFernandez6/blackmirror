"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CameraCapture,
  type CapturedImage,
} from "@/components/inspection/camera-capture";

type Draft = {
  id: string;
  itemName: string;
  brand: string | null;
  modelNumber: string | null;
  description: string | null;
  condition: string;
  matchKind: string;
  productTitle: string | null;
  productUrl: string | null;
  listedPrice: string | null;
  priceNote: string | null;
  quantity: number;
};

const MATCH: Record<string, string> = {
  SAME: "Same product",
  SIMILAR: "Similar product",
  UNIDENTIFIED: "Not identified",
};

export function ContentsCapture({
  claimId,
  onClose,
  onSaved,
}: {
  claimId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photo, setPhoto] = useState<CapturedImage | null>(null);
  const [room, setRoom] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [busy, setBusy] = useState(false);

  async function findReplacement(e: React.FormEvent) {
    e.preventDefault();
    if (!photo || !navigator.onLine) {
      toast("Contents pricing needs a connection. The photo stays on this screen.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("claimId", claimId);
      form.set("room", room);
      form.set("file", photo.blob, "contents.jpg");
      const res = await fetch("/api/contents", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: Draft };
      if (!res.ok || !data.item) throw new Error(data.error || "The product search did not finish.");
      setDraft(data.item);
      setQuantity(String(data.item.quantity));
      setUnitCost(data.item.listedPrice ?? "");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The product search did not finish.");
    } finally {
      setBusy(false);
    }
  }

  async function addLine() {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch("/api/contents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          quantity: Number(quantity) || 1,
          unitCost: unitCost === "" ? null : Number(unitCost),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "The line could not be added.");
      toast("Added to the Coverage C inventory");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "The line could not be added.");
    } finally {
      setBusy(false);
    }
  }

  if (!photo) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-navy-deep">
        <CameraCapture onCancel={onClose} onSave={async (payload) => setPhoto(payload)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-navy-deep px-4 py-6">
      <div className="mx-auto w-full max-w-lg space-y-5">
        <div>
          <p className="eyebrow">Coverage C</p>
          <h2 className="mt-1 font-serif text-2xl text-brand-white">Contents item</h2>
          <p className="mt-2 text-sm text-brand-slate">
            The photo is priced against the same product, or the closest similar one. Confirm the
            cost before it joins the inventory in BLACKBOX.
          </p>
        </div>

        {!draft ? (
          <form onSubmit={findReplacement} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contents-room">Room or area</Label>
              <Input id="contents-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Living room" required />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || room.trim().length < 2}>
                {busy ? "Searching…" : "Find replacement"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 rounded-2xl border border-brand-gold/15 p-4">
            <p className="font-serif text-xl text-brand-white">{draft.itemName}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              {MATCH[draft.matchKind] ?? draft.matchKind}
            </p>
            <p className="text-xs text-brand-slate">
              {room}
              {draft.brand ? ` · ${draft.brand}` : ""}
              {draft.modelNumber ? ` · ${draft.modelNumber}` : ""} · {draft.condition}
            </p>
            {draft.description ? <p className="text-sm text-brand-white/80">{draft.description}</p> : null}
            {draft.productTitle ? (
              <p className="text-sm">
                {draft.productUrl ? (
                  <a href={draft.productUrl} target="_blank" rel="noreferrer" className="text-brand-gold underline underline-offset-4">
                    {draft.productTitle}
                  </a>
                ) : (
                  draft.productTitle
                )}
              </p>
            ) : null}
            <p className="text-xs text-brand-slate">{draft.priceNote}</p>
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label htmlFor="contents-qty">Qty</Label>
                <Input id="contents-qty" inputMode="numeric" className="w-20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contents-cost">Unit cost</Label>
                <Input id="contents-cost" inputMode="decimal" className="w-32" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" disabled={busy} onClick={() => void addLine()}>
                {busy ? "Saving…" : "Add to inventory"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
