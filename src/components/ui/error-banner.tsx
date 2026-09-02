"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
  className?: string;
};

export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-4 rounded-md border border-denied/40 bg-denied-muted px-4 py-3 text-sm text-denied-soft",
        className
      )}
    >
      <p>{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="touch-target shrink-0 text-denied/70 hover:text-denied-soft"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
