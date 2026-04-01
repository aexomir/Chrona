import { useSessionsStore } from "@/features/sessions/sessions-store";
import { isSameDay } from "@/features/timeline/timeline-utils";
import * as Haptics from "expo-haptics";
import { createContext, useContext, useRef, useState } from "react";
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type LayoutEntry = { pageY: number; height: number; scrollYAtMeasure: number };

type MergeContextValue = {
  registerLayout: (id: string, entry: Omit<LayoutEntry, "scrollYAtMeasure">) => void;
  unregisterLayout: (id: string) => void;
  startDrag: (sessionId: string, absoluteY: number, offsetFromCardTop: number) => void;
  moveDrag: (absoluteY: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  updateScrollY: (y: number) => void;
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
  const scrollYRef = useRef(0);
  const draggingHeightRef = useRef(0);
  const allowedTargetsRef = useRef(new Set<string>());

  const ghostY = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);
  const ghostScale = useSharedValue(1);
  const ghostMergeProgress = useSharedValue(0);

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

  const registerLayout = (id: string, entry: Omit<LayoutEntry, "scrollYAtMeasure">) => {
    layoutsRef.current.set(id, { ...entry, scrollYAtMeasure: scrollYRef.current });
  };

  const unregisterLayout = (id: string) => {
    layoutsRef.current.delete(id);
  };

  const updateScrollY = (y: number) => {
    scrollYRef.current = y;
  };

  const resetDragState = () => {
    allowedTargetsRef.current = new Set();
    syncDraggingId(null);
    syncDropTargetId(null);
  };

  const startDrag = (sessionId: string, absoluteY: number, offsetFromCardTop: number) => {
    dragOffsetRef.current = offsetFromCardTop;
    dragStartYRef.current = absoluteY - offsetFromCardTop;
    syncDraggingId(sessionId);
    syncDropTargetId(null);

    draggingHeightRef.current = layoutsRef.current.get(sessionId)?.height ?? 0;

    const { sessions } = useSessionsStore.getState();
    const draggingSession = sessions.find((s) => s.id === sessionId);
    if (draggingSession) {
      const daySessions = sessions
        .filter((s) => isSameDay(new Date(s.startTime), new Date(draggingSession.startTime)))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      const idx = daySessions.findIndex((s) => s.id === sessionId);
      const allowed = new Set<string>();
      if (idx > 0) allowed.add(daySessions[idx - 1].id);
      if (idx < daySessions.length - 1) allowed.add(daySessions[idx + 1].id);
      allowedTargetsRef.current = allowed;
    }

    ghostY.value = absoluteY - offsetFromCardTop;
    ghostOpacity.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
    ghostScale.value = withTiming(1.03, { duration: 120, easing: Easing.out(Easing.quad) });
  };

  const moveDrag = (absoluteY: number) => {
    ghostY.value = absoluteY - dragOffsetRef.current;

    const ghostCenter = ghostY.value + draggingHeightRef.current / 2;
    const currentScrollY = scrollYRef.current;

    let hit: string | null = null;
    for (const [id, entry] of layoutsRef.current) {
      if (id === draggingIdRef.current || !allowedTargetsRef.current.has(id)) continue;
      const adjY = entry.pageY - (currentScrollY - entry.scrollYAtMeasure);
      if (ghostCenter >= adjY && ghostCenter < adjY + entry.height) {
        hit = id;
        break;
      }
    }

    if (hit !== dropTargetRef.current) {
      syncDropTargetId(hit);
      if (hit !== null) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const cancelDrag = () => {
    ghostY.value = withTiming(dragStartYRef.current, { duration: 280, easing: Easing.out(Easing.cubic) });
    ghostOpacity.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) });
    ghostScale.value = withTiming(1, { duration: 240 });
    setTimeout(resetDragState, 280);
  };

  const endDrag = () => {
    const source = draggingIdRef.current;
    const survivor = dropTargetRef.current;

    if (!source || !survivor) {
      cancelDrag();
      return;
    }

    const survivorLayout = layoutsRef.current.get(survivor);
    if (survivorLayout) {
      const adjY = survivorLayout.pageY - (scrollYRef.current - survivorLayout.scrollYAtMeasure);
      ghostY.value = withTiming(
        adjY + survivorLayout.height / 2 - draggingHeightRef.current / 2,
        { duration: 180, easing: Easing.out(Easing.cubic) },
      );
    }
    ghostScale.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) });
    ghostOpacity.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) });
    ghostMergeProgress.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) });

    setTimeout(() => {
      useSessionsStore.getState().mergeSessions(survivor, source);
      resetDragState();
    }, 180);
  };

  const value: MergeContextValue = {
    registerLayout,
    unregisterLayout,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    updateScrollY,
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
