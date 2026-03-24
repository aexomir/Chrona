import { storage } from "@/storage";

const KEY = "onboarding_complete";

export const hasCompletedOnboarding = () => storage.getBoolean(KEY) ?? false;
export const markOnboardingComplete = () => storage.set(KEY, true);
