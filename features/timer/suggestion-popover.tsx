import { useProjects } from "@/features/projects/projects-store";
import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import {
  usePatternStore,
  computeRuleSuggestion,
  computeSplitSuggestion,
  computeCompanionBundleIds,
} from "@/features/intelligence/pattern-store";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { Neutral } from "@/constants/theme";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const enterAnim = FadeInDown.duration(240).easing(Easing.out(Easing.cubic));
const exitAnim = FadeOutDown.duration(180).easing(Easing.in(Easing.cubic));

export function SuggestionPopover() {
  const insets = useSafeAreaInsets();
  const theme = useAuroraTheme();
  const projects = useProjects((s) => s.projects);
  const patternCounts = usePatternStore((s) => s.counts);
  const patternNames = usePatternStore((s) => s.nameIndex);
  const patternDismissed = usePatternStore((s) => s.dismissed);
  const patternTitleHistory = usePatternStore((s) => s.titleHistory);
  const patternOverrides = usePatternStore((s) => s.overrides);
  const dismissSuggestion = usePatternStore((s) => s.dismiss);
  const rules = useTrackingRulesStore((s) => s.rules);
  const addRule = useTrackingRulesStore((s) => s.addRule);

  const projectIdSet = new Set(projects.map((p) => p.id));

  const ruleSuggestion = computeRuleSuggestion(
    patternCounts,
    patternNames,
    patternDismissed,
    patternTitleHistory,
    rules,
    projectIdSet,
  );

  const splitSuggestion = computeSplitSuggestion(
    patternOverrides,
    patternTitleHistory,
    rules,
    patternDismissed,
    patternNames,
    projectIdSet,
  );

  const suggestionProject = ruleSuggestion
    ? projects.find((p) => p.id === ruleSuggestion.projectId) ?? null
    : null;
  const splitNewProject = splitSuggestion
    ? projects.find((p) => p.id === splitSuggestion.newProjectId) ?? null
    : null;

  const [pendingKeywords, setPendingKeywords] = useState<string[]>([]);
  const prevSuggestionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ruleSuggestion) {
      setPendingKeywords([]);
      prevSuggestionRef.current = null;
      return;
    }
    const fingerprint = `${ruleSuggestion.bundleId}::${ruleSuggestion.projectId}`;
    if (prevSuggestionRef.current !== fingerprint) {
      prevSuggestionRef.current = fingerprint;
      setPendingKeywords(ruleSuggestion.titleKeywords);
    }
  }, [ruleSuggestion]);

  function handleCreateRule() {
    if (!ruleSuggestion) return;
    const companions = computeCompanionBundleIds(
      ruleSuggestion.bundleId,
      ruleSuggestion.projectId,
    );
    addRule({
      appName: ruleSuggestion.appName,
      titleKeywords: pendingKeywords,
      projectId: ruleSuggestion.projectId,
      primaryBundleId: ruleSuggestion.bundleId,
      companionBundleIds: companions.length > 0 ? companions : undefined,
    });
  }

  function handleCreateSplitRule() {
    if (!splitSuggestion) return;
    addRule({
      appName: splitSuggestion.appName,
      titleKeywords: splitSuggestion.titleKeywords,
      projectId: splitSuggestion.newProjectId,
      primaryBundleId: splitSuggestion.bundleId,
    });
  }

  if (!ruleSuggestion && !splitSuggestion) return null;

  // 49pt tab triggers + 44pt BottomAccessory + 16pt gap above it
  const bottomOffset = insets.bottom + 109;

  if (ruleSuggestion) {
    return (
      <Animated.View
        entering={enterAnim}
        exiting={exitAnim}
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: bottomOffset,
          left: 16,
          right: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          backgroundColor: theme.card,
          padding: 14,
          gap: 10,
        }}
      >
        <View className="flex-row items-center gap-1.5">
          <View
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: suggestionProject?.color ?? Neutral.z600 }}
          />
          <Text className="text-white/50 text-sm">Auto-track</Text>
          <Text className="text-white text-sm font-medium">
            {ruleSuggestion.appName}
          </Text>
          <Text className="text-white/50 text-sm">
            for {suggestionProject?.name}?
          </Text>
          <View className="flex-1" />
          <Pressable
            onPress={() =>
              dismissSuggestion(
                `${ruleSuggestion.bundleId}::${ruleSuggestion.projectId}`,
              )
            }
            hitSlop={12}
          >
            <Text className="text-white/30 text-base font-semibold">×</Text>
          </Pressable>
        </View>

        {pendingKeywords.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5">
            {pendingKeywords.map((kw) => (
              <Pressable
                key={kw}
                onPress={() =>
                  setPendingKeywords((prev) => prev.filter((k) => k !== kw))
                }
                hitSlop={4}
              >
                <View
                  className="flex-row items-center px-2 py-1 rounded-lg"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Text className="text-white/70 text-xs">{kw}</Text>
                  <Text className="text-white/30 text-xs ml-1.5">×</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable onPress={handleCreateRule} className="self-end">
          <View
            className="px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
          >
            <Text className="text-white/80 text-sm font-medium">Create rule</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={enterAnim}
      exiting={exitAnim}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 16,
        right: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        backgroundColor: theme.card,
        padding: 14,
        gap: 10,
      }}
    >
      <View className="flex-row items-center gap-1.5">
        <View
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: splitNewProject?.color ?? Neutral.z600 }}
        />
        <Text className="text-white/50 text-sm">Refine</Text>
        <Text className="text-white text-sm font-medium">
          {splitSuggestion!.appName}
        </Text>
        <Text className="text-white/50 text-sm">
          → {splitNewProject?.name}?
        </Text>
        <View className="flex-1" />
        <Pressable
          onPress={() =>
            dismissSuggestion(
              `split::${splitSuggestion!.ruleId}::${splitSuggestion!.newProjectId}`,
            )
          }
          hitSlop={12}
        >
          <Text className="text-white/30 text-base font-semibold">×</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {splitSuggestion!.titleKeywords.map((kw) => (
          <View
            key={kw}
            className="px-2 py-1 rounded-lg"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <Text className="text-white/70 text-xs">{kw}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={handleCreateSplitRule} className="self-end">
        <View
          className="px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
        >
          <Text className="text-white/80 text-sm font-medium">Add rule</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
