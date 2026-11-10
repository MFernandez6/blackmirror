"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BlackmirrorMark } from "@/components/brand/blackmirror-mark";
import { BlacklineLogo } from "@/components/brand/blackline-mark";

const BLACKBOX_ACCOUNT_URL = `${(process.env.NEXT_PUBLIC_BLACKBOX_URL || "").replace(/\/$/, "")}/account`;

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Credentials rejected. Access denied.",
  ACCOUNT_LOCKED: "Too many failed attempts. This account is locked for 15 minutes — or ask an admin to unlock it.",
  TOO_MANY_ATTEMPTS: "Too many failed sign-ins from this network. Wait 15 minutes and retry.",
  MFA_INVALID: "Authenticator code rejected. Check the time on your phone and retry.",
  PASSWORD_CHANGE_REQUIRED: "Set a new password in BLACKBOX before using BLACKMIRROR.",
  MFA_SETUP_REQUIRED: "Admins must enroll in multi-factor authentication in BLACKBOX before using BLACKMIRROR.",
};

const NEEDS_BLACKBOX = new Set(["PASSWORD_CHANGE_REQUIRED", "MFA_SETUP_REQUIRED"]);

export default function LoginForm() {
  const router = useRouter();
  const reason = useSearchParams().get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setBusy(true);
    const res = await signIn("credentials", {
      email,
      password,
      otp: needsOtp ? otp : "",
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      if (res.error === "MFA_REQUIRED") {
        setNeedsOtp(true);
        return;
      }
      setErrorCode(res.error);
      setError(LOGIN_ERROR_MESSAGES[res.error] ?? LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS);
      if (res.error === "MFA_INVALID") setOtp("");
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

        <div className="mb-8 rounded-2xl border border-brand-gold/15 bg-brand-navy/40 px-4 py-6 text-center">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            Operated for
          </p>
          <BlacklineLogo className="mx-auto mt-4 w-44" priority />
        </div>

        <div className="hairline mb-8" />

        {reason === "idle" ? (
          <ErrorBanner
            message="Signed out after 15 minutes of inactivity. Captures on this device are kept and sync after you sign in."
            className="mb-6"
          />
        ) : null}

        {error ? (
          <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />
        ) : null}
        {NEEDS_BLACKBOX.has(errorCode) && process.env.NEXT_PUBLIC_BLACKBOX_URL ? (
          <p className="-mt-3 mb-6 text-center text-sm">
            <a href={BLACKBOX_ACCOUNT_URL} className="text-brand-gold underline underline-offset-4">
              Open BLACKBOX account security
            </a>
          </p>
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
          {needsOtp ? (
            <div className="space-y-2">
              <Label htmlFor="otp">Authenticator code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
              <p className="text-xs text-brand-slate">Enter the 6-digit code from your authenticator app.</p>
            </div>
          ) : null}
          <Button
            type="submit"
            variant="solid"
            className="w-full"
            disabled={busy || (needsOtp && otp.length !== 6)}
          >
            {busy ? "Authenticating…" : "Enter BLACKMIRROR™"}
          </Button>
        </form>
        <p className="mt-8 text-center font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Sign in while you have signal · session lasts 8h
        </p>
      </div>
    </div>
  );
}
