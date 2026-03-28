import { startAutoTracker, stopAutoTracker } from "@/features/auto-track/auto-tracker";
import { useUntrackedStore } from "@/features/auto-track/untracked-store";
import { startJournalTracker, stopJournalTracker } from "@/features/intelligence/journal-store";
import { startPatternTracker, stopPatternTracker } from "@/features/intelligence/pattern-store";
import { useStreamStore } from "@/features/stream/stream-store";
import { useEffect } from "react";

export function useBackgroundServices() {
  useEffect(() => {
    if (process.env.EXPO_OS !== "ios") return;
    const { start, stop } = useStreamStore.getState();
    const { _startWatching, _stopWatching } = useUntrackedStore.getState();
    start();
    startAutoTracker();
    startJournalTracker();
    startPatternTracker();
    _startWatching();
    return () => {
      stopAutoTracker();
      stopJournalTracker();
      stopPatternTracker();
      _stopWatching();
      stop();
    };
  }, []);
}
