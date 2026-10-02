"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { BlacklineMark } from "@/components/brand/blackline-mark";
import { BlackmirrorMark } from "@/components/brand/blackmirror-mark";
import { SyncBar } from "@/components/layout/sync-bar";
import { Button } from "@/components/ui/button";

type Props = {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
};

export function FieldShell({ user, children }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col md:px-4 md:py-3 lg:px-6">
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col bg-brand-navy/80 md:min-h-[calc(100dvh-1.5rem)] md:overflow-hidden md:rounded-lg md:border md:border-brand-white/10 md:shadow-panel">
        <header className="sticky top-0 z-30 border-b border-brand-white/5 bg-brand-navy/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link
              href="/inspections"
              className="flex min-w-0 items-center gap-3 touch-manipulation"
            >
              <BlacklineMark size={28} />
              <span className="min-w-0">
                <BlackmirrorMark className="font-serif text-xl font-bold tracking-[0.2em] text-brand-gold sm:text-2xl" />
                <span className="mt-1.5 block font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brand-slate">
                  For Blackline Public Adjusters LLC
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  {user.role}
                </p>
                <p className="text-sm text-brand-white/90">{user.name}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </Button>
            </div>
          </div>
          <SyncBar />
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
