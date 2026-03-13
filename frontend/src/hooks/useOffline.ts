"use client";

import { useState, useEffect, useCallback } from "react";
import { isOnline, getOfflineEntries, clearOfflineEntries, getOfflineCount } from "@/lib/storage";
import { syncApi } from "@/lib/api";

export function useOffline() {
  const [online, setOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const check = async () => {
      const result = await isOnline();
      setOnline(result);
      setOfflineCount(getOfflineCount());
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const syncNow = useCallback(async () => {
    if (!online || offlineCount === 0) return;
    setSyncing(true);
    try {
      const entries = getOfflineEntries();
      await syncApi.import({ entries });
      clearOfflineEntries();
      setOfflineCount(0);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, [online, offlineCount]);

  return { online, offlineCount, syncing, syncNow };
}
