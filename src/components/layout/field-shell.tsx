"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { BlackmirrorMark } from "@/components/brand/blackmirror-mark";
import { SyncBar } from "@/components/layout/sync-bar";

type Props = {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
};

export function FieldShell({ user, children }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-[#05070b]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05070b]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/inspections" className="touch-manipulation">
            <p className="eyebrow">BLACKBOX module</p>
            <BlackmirrorMark className="font-serif text-lg font-bold tracking-[0.18em] text-brand-gold" />
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="touch-target font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-slate"
          >
            {user.name.split(" ")[0]}
            <span className="mt-0.5 block text-brand-gold/70">{user.role}</span>
          </button>
        </div>
        <SyncBar />
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
