import { PROJECTS, type Project } from "@/constants/projects";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProjectsState = {
  projects: Project[];
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  removeProject: (id: string) => void;
};

export const useProjects = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: PROJECTS,
      addProject: (data) =>
        set((state) => ({
          projects: [
            ...state.projects,
            { ...data, id: Date.now().toString() },
          ],
        })),
      updateProject: (id, patch) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),
    }),
    {
      name: "projects",
      storage: mmkvStorage,
    }
  )
);
