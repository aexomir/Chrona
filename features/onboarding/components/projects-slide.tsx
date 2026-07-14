import { PROJECTS } from "@/constants/projects";
import { TextAlpha } from "@/constants/theme";
import { ContinueLink } from "@/features/onboarding/components/continue-link";
import { ProjectTile } from "@/features/onboarding/components/project-tile";
import { MOSAIC_RATIOS, MOSAIC_ROWS } from "@/features/onboarding/onboarding-constants";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export function ProjectsSlide({
  selectedIds,
  onToggle,
  onContinue,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  const projectById = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

  return (
    <View className="flex-1">
      <Animated.View
        entering={FadeIn.duration(350)}
        className="px-6 pt-4 pb-5"
      >
        <Text style={styles.heading}>{"What fills\nyour days?"}</Text>
        <Text style={styles.subtitle}>
          Tap to remove what doesn&apos;t apply.
        </Text>
      </Animated.View>

      <View className="flex-1 gap-[3px] px-5">
        {MOSAIC_ROWS.map(([idA, idB], rowIdx) => {
          const projectA = projectById[idA];
          const projectB = projectById[idB];
          if (!projectA || !projectB) return null;

          return (
            <View key={rowIdx} className="flex-1 flex-row gap-[3px]">
              <ProjectTile
                project={projectA}
                selected={selectedIds.has(idA)}
                onToggle={onToggle}
                flex={MOSAIC_RATIOS[rowIdx][0]}
                delay={rowIdx * 80}
              />
              <ProjectTile
                project={projectB}
                selected={selectedIds.has(idB)}
                onToggle={onToggle}
                flex={MOSAIC_RATIOS[rowIdx][1]}
                delay={rowIdx * 80 + 40}
              />
            </View>
          );
        })}
      </View>

      <View className="px-6 pt-4 pb-2 items-end">
        {selectedIds.size > 0 ? (
          <ContinueLink onPress={onContinue} />
        ) : (
          <Text style={styles.emptyHint}>Select at least one</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 30,
    fontWeight: "600",
    color: "white",
    letterSpacing: -1,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: TextAlpha.disabled,
    letterSpacing: -0.1,
  },
  emptyHint: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 12,
  },
});
