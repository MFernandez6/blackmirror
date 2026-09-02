"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { SyncProvider } from "@/components/pwa/sync-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <SyncProvider>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "#0F1C2E",
              border: "1px solid rgba(198, 168, 91, 0.35)",
              borderRadius: 6,
              color: "#F4F4F4",
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            },
          }}
        />
      </SyncProvider>
    </SessionProvider>
  );
}
