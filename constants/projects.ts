export type Project = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export const PROJECTS: Project[] = [
  { id: "work", name: "Work", icon: "briefcase.fill", color: "#ef4444" },
  { id: "study", name: "Study", icon: "book.fill", color: "#22c55e" },
  { id: "exercise", name: "Exercise", icon: "figure.run", color: "#f97316" },
  {
    id: "creative",
    name: "Creative",
    icon: "paintbrush.fill",
    color: "#a855f7",
  },
  { id: "personal", name: "Personal", icon: "house.fill", color: "#3b82f6" },
  { id: "rest", name: "Rest", icon: "moon.stars.fill", color: "#6366f1" },
];
