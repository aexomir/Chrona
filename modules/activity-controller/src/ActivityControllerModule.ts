import { requireNativeModule } from 'expo';

import type { StartActivityParams, StartActivityResult, UpdateActivityParams } from './ActivityController.types';

declare class ActivityControllerModule {
  startActivity(params: StartActivityParams): Promise<StartActivityResult>;
  updateActivity(params: UpdateActivityParams): Promise<void>;
  endActivity(): Promise<void>;
  isLiveActivityRunning(): boolean;
}

export default requireNativeModule<ActivityControllerModule>('ActivityController');
