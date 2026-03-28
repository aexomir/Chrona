import { useSessionsStore } from "@/features/sessions/sessions-store";
import { isSameDay } from "@/features/timeline/timeline-utils";
import * as Haptics from "expo-haptics";
import { createContext, useContext, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type LayoutEntry = { pageY: number; height: number };

type MergeContextValue = {
  registerLayout: (id: string, entry: LayoutEntry) => void;
  unregisterLayout: (id: string) => void;
  startDrag: (
    sessionId: string,
    absoluteY: number,
    offsetFromCardTop: number,
  ) => void;
  moveDrag: (absoluteY: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  draggingId: string | null;
  dropTargetId: string | null;
  isDragging: boolean;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  ghostScale: SharedValue<number>;
  ghostMergeProgress: SharedValue<number>;
};

const MergeContext = createContext<MergeContextValue | null>(null);

export function MergeProvider({ children }: { children: React.ReactNode }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const layoutsRef = useRef(new Map<string, LayoutEntry>());
  const draggingIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const dragOffsetRef = useRef(0);
  const dragStartYRef = useRef(0);

  const ghostY = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);
  const ghostScale = useSharedValue(1);
  const ghostMergeProgress = useSharedValue(0);

  // Keep refs in sync with state for use inside moveDrag (called rapidly)
  const syncDraggingId = (id: string | null) => {
    draggingIdRef.current = id;
    setDraggingId(id);
  };
  const syncDropTargetId = (id: string | null) => {
    dropTargetRef.current = id;
    setDropTargetId(id);
    ghostMergeProgress.value = withTiming(id !== null ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  };

  const registerLayout = (id: string, entry: LayoutEntry) => {
    layoutsRef.current.set(id, entry);
  };

  const unregisterLayout = (id: string) => {
    layoutsRef.current.delete(id);
  };

  const _resetDragState = () => {
    syncDraggingId(null);
    syncDropTargetId(null);
  };

  const startDrag = (
    sessionId: string,
    absoluteY: number,
    offsetFromCardTop: number,
  ) => {
    dragOffsetRef.current = offsetFromCardTop;
    dragStartYRef.current = absoluteY - offsetFromCardTop;
    syncDraggingId(sessionId);
    syncDropTargetId(null);
    ghostY.value = absoluteY - offsetFromCardTop;
    ghostOpacity.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
    ghostScale.value = withTiming(1.03, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  };

  const moveDrag = (absoluteY: number) => {
    ghostY.value = absoluteY - dragOffsetRef.current;

    let hit: string | null = null;
    for (const [id, entry] of layoutsRef.current) {
      if (id === draggingIdRef.current) continue;
      if (absoluteY >= entry.pageY && absoluteY <= entry.pageY + entry.height) {
        hit = id;
        break;
      }
    }

    if (hit !== dropTargetRef.current) {
      syncDropTargetId(hit);
      if (hit !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const cancelDrag = () => {
    ghostY.value = withTiming(dragStartYRef.current, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    ghostOpacity.value = withTiming(0, {
      duration: 240,
      easing: Easing.in(Easing.quad),
    });
    ghostScale.value = withTiming(1, { duration: 240 });
    setTimeout(_resetDragState, 280);
  };

  const endDrag = () => {
    const source = draggingIdRef.current;
    const survivor = dropTargetRef.current;

    if (!source || !survivor) {
      cancelDrag();
      return;
    }

    const { sessions, mergeSessions } = useSessionsStore.getState();
    const sourceSession = sessions.find((s) => s.id === source);
    const survivorSession = sessions.find((s) => s.id === survivor);

    if (!sourceSession || !survivorSession) {
      cancelDrag();
      return;
    }

    if (
      !isSameDay(
        new Date(sourceSession.startTime),
        new Date(survivorSession.startTime),
      )
    ) {
      Alert.alert(
        "Can't Merge",
        "Sessions from different days can't be merged.",
      );
      cancelDrag();
      return;
    }

    const survivorLayout = layoutsRef.current.get(survivor);
    if (survivorLayout) {
      ghostY.value = withTiming(
        survivorLayout.pageY + survivorLayout.height / 2 - 34,
        { duration: 180, easing: Easing.out(Easing.cubic) },
      );
    }
    ghostScale.value = withTiming(0, {
      duration: 160,
      easing: Easing.in(Easing.cubic),
    });
    ghostOpacity.value = withTiming(0, {
      duration: 140,
      easing: Easing.in(Easing.quad),
    });
    ghostMergeProgress.value = withTiming(0, {
      duration: 140,
      easing: Easing.in(Easing.quad),
    });

    setTimeout(() => {
      mergeSessions(survivor, source);
      _resetDragState();
    }, 180);
  };

  const value: MergeContextValue = {
    registerLayout,
    unregisterLayout,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    draggingId,
    dropTargetId,
    isDragging: draggingId !== null,
    ghostY,
    ghostOpacity,
    ghostScale,
    ghostMergeProgress,
  };

  return (
    <MergeContext.Provider value={value}>{children}</MergeContext.Provider>
  );
}

export function useMergeContext(): MergeContextValue {
  const ctx = useContext(MergeContext);
  if (!ctx) throw new Error("useMergeContext must be used inside MergeProvider");
  return ctx;
}
