"use client";

import Link from "next/link";
import { BlacklineMark } from "@/components/brand/blackline-mark";
import { AccountMenu } from "@/components/layout/account-menu";
import { BlackmirrorMark } from "@/components/brand/blackmirror-mark";
import { SyncBar } from "@/components/layout/sync-bar";

type Props = {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
};

export function FieldShell({ user, children }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col md:px-4 md:py-3 lg:px-6">
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col bg-brand-navy/40 md:min-h-[calc(100dvh-1.5rem)] md:overflow-hidden md:rounded-2xl md:border md:border-brand-gold/15">
        <header className="sticky top-0 z-30 border-b border-brand-gold/10 bg-[linear-gradient(to_bottom,rgb(var(--brand-navy))_0%,rgb(var(--brand-navy-deep)/0.94)_100%)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link
              href="/inspections"
              className="flex min-w-0 items-center gap-3 touch-manipulation"
            >
              <BlacklineMark size={28} className="brightness-[1.2]" />
              <span className="min-w-0">
                <BlackmirrorMark className="font-serif text-xl font-bold tracking-[0.2em] text-brand-gold sm:text-2xl" />
                <span className="mt-1.5 block font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brand-slate">
                  For Blackline Public Adjusters LLC
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <AccountMenu user={user} />
            </div>
          </div>
          <SyncBar />
        </header>
        <main className="flex min-h-0 flex-1 animate-fade-up flex-col overflow-y-auto motion-reduce:animate-none">
          {children}
        </main>
      </div>
    </div>
  );
}
