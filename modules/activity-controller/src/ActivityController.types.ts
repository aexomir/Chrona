export type StartActivityParams = {
  title: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
  startTimestamp: string; // ISO 8601
};

export type UpdateActivityParams = {
  title?: string;
  projectName?: string;
  projectIcon?: string;
  projectColor?: string;
};

export type StartActivityResult = {
  activityId: string;
};
