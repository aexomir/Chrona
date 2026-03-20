import { requireNativeModule } from 'expo';

import type { StartActivityParams, StartActivityResult } from './ActivityController.types';

declare class ActivityControllerModule {
  startActivity(params: StartActivityParams): Promise<StartActivityResult>;
  endActivity(): Promise<void>;
  isLiveActivityRunning(): boolean;
}

export default requireNativeModule<ActivityControllerModule>('ActivityController');
