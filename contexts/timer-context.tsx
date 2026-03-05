import { createContext, useEffect, useRef, useState } from "react";

type TimerContextType = {
  isTracking: boolean;
  title: string;
  elapsedSeconds: number;
  startTimer: (title: string) => void;
  stopTimer: () => void;
};

export const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [title, setTitle] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (newTitle: string) => {
    setTitle(newTitle);
    setElapsedSeconds(0);
    setIsTracking(true);

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    setTitle("");
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
      elapsedSeconds,
      startTimer,
      stopTimer,
    }}>
      {children}
    </TimerContext>
  );
}
