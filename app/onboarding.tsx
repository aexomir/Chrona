import { PROJECTS } from "@/constants/projects";
import { Neutral } from "@/constants/theme";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { CalendarSlide } from "@/features/onboarding/components/calendar-slide";
import { ProgressDots } from "@/features/onboarding/components/progress-dots";
import { ProjectsSlide } from "@/features/onboarding/components/projects-slide";
import { ReadySlide } from "@/features/onboarding/components/ready-slide";
import { WelcomeSlide } from "@/features/onboarding/components/welcome-slide";
import { markOnboardingComplete } from "@/features/onboarding/onboarding-storage";
import { TOTAL_SLIDES } from "@/features/onboarding/onboarding-constants";
import { useProjects } from "@/features/projects/projects-store";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  const { removeProject } = useProjects();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(PROJECTS.map((p) => p.id)),
  );

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const calendarGranted = useCalendarStore(
    (s) => s.permissionStatus === "granted",
  );
  const { syncPermissionStatus, requestPermission, setEnabled } =
    useCalendarStore();

  useEffect(() => {
    syncPermissionStatus();
  }, [syncPermissionStatus]);

  const handleGrantCalendar = async () => {
    await requestPermission();
    if (useCalendarStore.getState().permissionStatus === "granted") {
      setEnabled(true);
    }
  };

  const goNext = () =>
    setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));

  const handleProjectsContinue = () => {
    PROJECTS.forEach((p) => {
      if (!selectedIds.has(p.id)) removeProject(p.id);
    });
    goNext();
  };

  const handleFinish = () => {
    markOnboardingComplete();
    router.replace("/(tabs)");
  };

  const showDots = currentSlide > 0 && currentSlide < TOTAL_SLIDES - 1;

  return (
    <View className="flex-1" style={{ backgroundColor: Neutral.z900 }}>
      <StaticAuraBackground />

      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <Animated.View
          key={currentSlide}
          entering={FadeIn.duration(350)}
          className="flex-1"
        >
          {currentSlide === 0 && <WelcomeSlide onDismiss={goNext} />}
          {currentSlide === 1 && (
            <ProjectsSlide
              selectedIds={selectedIds}
              onToggle={toggleProject}
              onContinue={handleProjectsContinue}
            />
          )}
          {currentSlide === 2 && (
            <CalendarSlide
              granted={calendarGranted}
              onGrant={handleGrantCalendar}
              onContinue={goNext}
            />
          )}
          {currentSlide === 3 && <ReadySlide onFinish={handleFinish} />}
        </Animated.View>

        {showDots && (
          <View
            className="items-center"
            style={{ paddingBottom: insets.bottom + 36 }}
          >
            <ProgressDots total={TOTAL_SLIDES} current={currentSlide} />
          </View>
        )}
      </View>
    </View>
  );
}
