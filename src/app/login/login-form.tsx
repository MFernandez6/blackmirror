"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BlackmirrorMark } from "@/components/brand/blackmirror-mark";
import { BlacklineLogo } from "@/components/brand/blackline-mark";

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
      <div className="relative w-full max-w-sm md:max-w-md">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-4">Field inspection</p>
          <BlackmirrorMark
            as="h1"
            className="justify-center font-serif text-4xl font-bold tracking-[0.22em] text-brand-gold sm:text-5xl"
          />
          <p className="mt-4 text-sm leading-relaxed text-brand-white/80">
            Property inspection. Offline-first. Not a client portal.
          </p>
        </div>

        <div className="mb-8 rounded-md border border-brand-white/10 bg-brand-navy-deep/40 px-4 py-6 text-center">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            Operated for
          </p>
          <BlacklineLogo className="mx-auto mt-4 w-44" priority />
        </div>

        <div className="hairline mb-8" />

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
            {busy ? "Authenticating…" : "Enter BLACKMIRROR™"}
          </Button>
        </form>
        <p className="mt-8 text-center font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Sign in while you have signal · session lasts 12h
        </p>
      </div>
    </div>
  );
}
