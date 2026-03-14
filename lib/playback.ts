import { makeMutable } from 'react-native-reanimated';

// 0 = start of day (midnight), 1 = end of today's sessions
// Represents the fraction of the day currently being previewed
export const scrubProgress = makeMutable(1);

// 0 = inactive, 1 = user actively scrubbing
// Drives time label visibility and focus ring state changes
export const scrubActive = makeMutable(0);
