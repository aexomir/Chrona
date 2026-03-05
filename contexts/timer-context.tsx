import { createContext, useEffect, useRef, useState } from "react";

type TimerContextType = {
  isTracking: boolean;
  title: string;
  projectId: string | null;
  elapsedSeconds: number;
  startTimer: (title: string, projectId?: string) => void;
  stopTimer: () => void;
  updateTitle: (title: string) => void;
  updateProjectId: (projectId: string | null) => void;
};

export const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (newTitle: string, newProjectId?: string) => {
    setTitle(newTitle);
    setProjectId(newProjectId ?? null);
    setElapsedSeconds(0);
    setIsTracking(true);

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const updateTitle = (newTitle: string) => setTitle(newTitle);
  const updateProjectId = (newProjectId: string | null) => setProjectId(newProjectId);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    setTitle("");
    setProjectId(null);
    setElapsedSeconds(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <TimerContext value={{
      isTracking,
      title,
      projectId,
      elapsedSeconds,
      startTimer,
      stopTimer,
      updateTitle,
      updateProjectId,
    }}>
      {children}
    </TimerContext>
  );
}
