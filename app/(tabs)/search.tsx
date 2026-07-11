import { SearchResultRenderer } from "@/features/search/components/result-renderer";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useSearchQuery } from "@/features/search/use-search-query";
import { generateTrendingInsights } from "@/features/analytics/trending-insights";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore, type Session } from "@/features/sessions/sessions-store";
import * as Haptics from "expo-haptics";
import { GlassView } from "expo-glass-effect";
import { Image } from "expo-image";
import { SearchField } from "heroui-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, type TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SUGGESTION_CHIPS = [
  "What did I focus on today?",
  "Show me this week stats",
  "How's my focus streak?",
  "Projects this month",
];

const TEXT_MUTED = "rgba(255, 255, 255, 0.6)";
const TEXT_FAINT = "rgba(255, 255, 255, 0.5)";
const TEXT_SUBTLE = "rgba(255, 255, 255, 0.3)";

const SKELETON_BASE_HEIGHT = 100;
const SKELETON_HEIGHT_STEP = 20;
const STAGGER = { skeleton: 80, insight: 60, chip: 80, result: 50 };

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const allSessions = useSessionsStore((s) => s.sessions);
  const projects = useProjects((s) => s.projects);
  const calendarEvents = useCalendarStore((s) => s.events);
  const { isSearching, specs, search, reset } = useSearchQuery();

  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const sessionsById = useMemo(
    () => new Map<string, Session>(allSessions.map((s) => [s.id, s])),
    [allSessions],
  );

  const trendingInsights = useMemo(
    () => generateTrendingInsights(allSessions, projects),
    [allSessions, projects],
  );

  const handleSearch = async (text: string) => {
    if (!text.trim()) return;
    await search(text, allSessions, projects);
  };

  const handleChipTap = async (chip: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueryText(chip);
    await search(chip, allSessions, projects);
  };

  const handleInsightTap = async (query: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueryText(query);
    await search(query, allSessions, projects);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    inputRef.current?.focus();
  };

  return (
    <View className="flex-1">
      <StaticAuraBackground />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pb-6" style={{ paddingTop: insets.top + 16 }}>
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            className="rounded-3xl overflow-hidden"
          >
            <SearchField value={queryText} onChange={setQueryText}>
              <SearchField.Group className="px-4 py-3">
                <SearchField.SearchIcon iconProps={{ size: 18, color: TEXT_MUTED }} />
                <SearchField.Input
                  ref={inputRef}
                  placeholder="Ask about your focus..."
                  placeholderTextColor={TEXT_FAINT}
                  className="bg-transparent border-0 py-0 text-white text-base font-medium"
                  onSubmitEditing={() => handleSearch(queryText)}
                  editable={!isSearching}
                  selectTextOnFocus
                />
                <SearchField.ClearButton
                  iconProps={{ size: 18, color: TEXT_FAINT }}
                  onPress={handleClear}
                />
              </SearchField.Group>
            </SearchField>
          </GlassView>
        </View>

        {!specs ? (
          <View className="px-4 pb-10">
            {queryText.trim() ? (
              isSearching && (
                <View className="gap-3 mt-3">
                  {[0, 1, 2].map((i) => (
                    <Animated.View
                      key={i}
                      entering={FadeInDown.delay(i * STAGGER.skeleton).duration(600)}
                      className="bg-white/[0.08] rounded-xl"
                      style={{ height: SKELETON_BASE_HEIGHT + i * SKELETON_HEIGHT_STEP }}
                    />
                  ))}
                </View>
              )
            ) : (
              <View>
                {trendingInsights.length > 0 && (
                  <View className="mb-7 gap-[10px]">
                    <Animated.Text
                      entering={FadeInDown.duration(400)}
                      className="text-white/60 text-xs font-semibold mb-1 uppercase tracking-wide"
                    >
                      ✨ Trending Today
                    </Animated.Text>

                    {trendingInsights.map((insight, idx) => (
                      <Animated.View
                        key={insight.id}
                        entering={FadeInDown.delay((idx + 1) * STAGGER.insight).duration(400)}
                      >
                        <Pressable
                          onPress={() => handleInsightTap(insight.suggestedQuery)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                        >
                          <GlassView
                            glassEffectStyle="clear"
                            colorScheme="dark"
                            className="rounded-xl overflow-hidden"
                          >
                            <View
                              className="px-[14px] py-3 flex-row items-center gap-3 border-l-[3px]"
                              style={{ borderLeftColor: insight.color }}
                            >
                              <Image
                                source={insight.icon}
                                className="w-5 h-5"
                                tintColor={insight.color}
                              />
                              <View className="flex-1 gap-0.5">
                                <Text className="text-white text-[13px] font-semibold">
                                  {insight.title}
                                </Text>
                                <Text className="text-xs text-white/50">
                                  {insight.subtitle}
                                </Text>
                              </View>
                              <Image
                                source="sf:chevron.right"
                                className="w-3.5 h-3.5"
                                tintColor={TEXT_SUBTLE}
                              />
                            </View>
                          </GlassView>
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                )}

                <View className="mb-5">
                  <Animated.Text
                    entering={FadeInDown.duration(400)}
                    className="text-white/70 text-[15px] font-semibold mb-3"
                  >
                    Try asking...
                  </Animated.Text>
                </View>

                <View className="gap-[10px]">
                  {SUGGESTION_CHIPS.map((chip, idx) => (
                    <Animated.View
                      key={chip}
                      entering={FadeInDown.delay(idx * STAGGER.chip).duration(400)}
                    >
                      <Pressable
                        onPress={() => handleChipTap(chip)}
                        className="px-[14px] py-3 bg-white/10 rounded-xl border border-white/[0.15]"
                      >
                        <Text className="text-white text-[15px] font-medium">{chip}</Text>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          <View className="px-4 pb-10 gap-3">
            {specs.map((spec, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * STAGGER.result).duration(400)}
              >
                <SearchResultRenderer
                  spec={spec}
                  sessionsById={sessionsById}
                  projects={projects}
                  calendarEvents={calendarEvents}
                  onSelectFollowUp={(query) => handleChipTap(query)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
