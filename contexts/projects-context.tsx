import { PROJECTS, type Project } from "@/constants/projects";
import { storage } from "@/storage";
import { createContext, useState } from "react";

const STORAGE_KEY = "projects";

type ProjectsContextType = {
  projects: Project[];
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  removeProject: (id: string) => void;
};

export const ProjectsContext = createContext<ProjectsContextType | null>(null);

function load(): Project[] {
  const raw = storage.getString(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through
    }
  }
  return PROJECTS;
}

function persist(projects: Project[]) {
  storage.set(STORAGE_KEY, JSON.stringify(projects));
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(load);

  function addProject(data: Omit<Project, "id">) {
    const next = [...projects, { ...data, id: Date.now().toString() }];
    setProjects(next);
    persist(next);
  }

  function updateProject(id: string, patch: Partial<Omit<Project, "id">>) {
    const next = projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setProjects(next);
    persist(next);
  }

  function removeProject(id: string) {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    persist(next);
  }

  return (
    <ProjectsContext value={{ projects, addProject, updateProject, removeProject }}>
      {children}
    </ProjectsContext>
  );
}
