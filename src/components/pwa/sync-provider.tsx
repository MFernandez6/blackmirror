"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getSyncSnapshot,
  startSyncLoop,
  subscribeSync,
  type SyncStatus,
} from "@/lib/offline/sync";

const SyncContext = createContext<SyncStatus>({
  online: true,
  syncing: false,
  pending: 0,
  lastError: null,
  lastSyncedAt: null,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({
    online: true,
    syncing: false,
    pending: 0,
    lastError: null,
    lastSyncedAt: null,
  });

  useEffect(() => {
    startSyncLoop();
    void getSyncSnapshot().then(setStatus);
    return subscribeSync(setStatus);
  }, []);

  return <SyncContext.Provider value={status}>{children}</SyncContext.Provider>;
}

export function useSyncStatus() {
  return useContext(SyncContext);
}
