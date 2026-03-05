import { createContext, useEffect, useRef, useState } from "react";
import { type Project } from "@/constants/projects";

type TimerContextType = {
  isTracking: boolean;
  title: string;
  project: Project | null;
  elapsedSeconds: number;
  startTimer: (title: string, project?: Project) => void;
  stopTimer: () => void;
  updateTitle: (title: string) => void;
  updateProject: (project: Project | null) => void;
};

export const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (newTitle: string, newProject?: Project) => {
    setTitle(newTitle);
    setProject(newProject ?? null);
    setElapsedSeconds(0);
    setIsTracking(true);

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const updateTitle = (newTitle: string) => setTitle(newTitle);
  const updateProject = (newProject: Project | null) => setProject(newProject);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    setTitle("");
    setProject(null);
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
      project,
      elapsedSeconds,
      startTimer,
      stopTimer,
      updateTitle,
      updateProject,
    }}>
      {children}
    </TimerContext>
  );
}
