"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BlackmirrorMark } from "@/components/brand/blackmirror-mark";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Credentials rejected. Access denied.");
      return;
    }
    router.push("/inspections");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 pb-safe">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(198,168,91,0.1), transparent)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-4">BLACKBOX field module</p>
          <BlackmirrorMark
            as="h1"
            className="justify-center font-serif text-3xl font-bold tracking-[0.18em] text-brand-gold sm:text-4xl"
          />
          <p className="mt-4 text-sm leading-relaxed text-brand-white/80">
            Property inspection. Offline-first. Not a client portal.
          </p>
        </div>

        <div className="mb-8 border border-white/10 bg-[#05070b] px-4 py-3 text-center">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            Operated for
          </p>
          <p className="mt-1.5 font-serif text-xs font-semibold tracking-[0.14em] text-brand-white/85">
            BLACKLINE PUBLIC ADJUSTERS LLC
          </p>
        </div>

        {error ? (
          <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="solid" className="w-full" disabled={busy}>
            {busy ? "Authenticating…" : "Enter field"}
          </Button>
        </form>
        <p className="mt-8 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Sign in while you have signal · session lasts 12h
        </p>
      </div>
    </div>
  );
}
