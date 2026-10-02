"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";

type Props = {
  user: { name: string; role: string };
};

export function AccountMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pill =
    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 font-sans text-[9px] font-bold uppercase tracking-[0.2em] transition-colors";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-right transition-colors hover:border-brand-gold/25"
      >
        <span className="hidden sm:block">
          <span className="block font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            {user.role}
          </span>
          <span className="block text-sm text-brand-white/90">{user.name}</span>
        </span>
        <UserRound className="h-5 w-5 text-brand-gold sm:hidden" aria-hidden />
        <ChevronDown
          className={cn("h-4 w-4 text-brand-slate transition-transform", open && "rotate-180")}
          aria-hidden
        />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in rounded-2xl border border-brand-gold/15 bg-brand-navy p-3"
        >
          <div className="px-1 pb-3 sm:hidden">
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              {user.role}
            </p>
            <p className="text-sm text-brand-white/90">{user.name}</p>
          </div>

          <p className="eyebrow px-1">Appearance</p>
          <div
            className="mt-2 flex gap-1 rounded-md border border-brand-white/10 bg-brand-navy-deep/50 p-1"
            role="group"
            aria-label="Appearance"
          >
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
              className={cn(
                pill,
                theme === "dark"
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-brand-slate hover:text-brand-white"
              )}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden />
              Dark
            </button>
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
              className={cn(
                pill,
                theme === "light"
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-brand-slate hover:text-brand-white"
              )}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden />
              Light
            </button>
          </div>

          <div className="my-3 border-t border-brand-white/10" />

          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-white/80 transition-colors hover:bg-brand-gold/10 hover:text-brand-gold"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
