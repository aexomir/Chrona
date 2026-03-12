import { makeMutable } from 'react-native-reanimated';

export const heroProgress = makeMutable(0); // 0 = splash, 1 = done
export const heroIconOpacity = makeMutable(1); // 1 = icon visible, 0 = faded out
