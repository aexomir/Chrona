import SessionActivity from '@/widgets/SessionActivity';
import type { SessionActivityProps } from '@/widgets/SessionActivity';

let currentActivity: Awaited<ReturnType<typeof SessionActivity.start>> | null =
  null;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const startSessionActivity = (props: Omit<SessionActivityProps, 'elapsedTime'> & { elapsed: number }) => {
  try {
    // End existing activity if any
    if (currentActivity) {
      currentActivity.end();
    }
    // Start new activity
    currentActivity = SessionActivity.start({
      projectName: props.projectName,
      elapsedTime: formatTime(props.elapsed),
      title: props.title,
    });
  } catch (error) {
    console.warn('Failed to start session activity:', error);
  }
};

export const updateSessionActivity = (props: Omit<SessionActivityProps, 'elapsedTime'> & { elapsed: number }) => {
  try {
    if (currentActivity) {
      currentActivity.update({
        projectName: props.projectName,
        elapsedTime: formatTime(props.elapsed),
        title: props.title,
      });
    } else {
      // If activity doesn't exist, start a new one
      startSessionActivity(props);
    }
  } catch (error) {
    console.warn('Failed to update session activity:', error);
  }
};

export const endSessionActivity = () => {
  try {
    if (currentActivity) {
      currentActivity.end();
      currentActivity = null;
    }
  } catch (error) {
    console.warn('Failed to end session activity:', error);
  }
};
