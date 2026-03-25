import { AIComponentRenderer } from "@/features/search/ai-component-renderer";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useSearchQuery } from "@/features/search/use-search-query";
import { generateTrendingInsights } from "@/features/analytics/trending-insights";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { GlassView } from "expo-glass-effect";
import { Image } from "expo-image";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SUGGESTION_CHIPS = [
  "What did I focus on today?",
  "Show me this week stats",
  "How's my focus streak?",
  "Projects this month",
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { sessions: allSessions } = useSessionsStore();
  const { projects } = useProjects();
  const { isSearching, specs, search, reset } = useSearchQuery();

  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const trendingInsights = useMemo(
    () => generateTrendingInsights(allSessions, projects),
    [allSessions, projects],
  );

  const handleSearch = async (text: string) => {
    if (!text.trim()) return;
    await search(text, allSessions, projects);
  };

  const handleChipTap = async (chip: string) => {
    setQueryText(chip);
    await search(chip, allSessions, projects);
  };

  const handleInsightTap = async (query: string) => {
    setQueryText(query);
    await search(query, allSessions, projects);
  };

  const handleClear = () => {
    setQueryText("");
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
        <View
          className="px-4 pb-6"
          style={{
            paddingTop: insets.top + 16,
          }}
        >
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            className="rounded-3xl overflow-hidden"
          >
            <View className="flex-row items-center px-4 py-3 gap-[10px]">
              <Image
                source="sf:magnifyingglass"
                style={{
                  width: 18,
                  height: 18,
                  tintColor: "rgba(255, 255, 255, 0.6)",
                }}
              />
              <TextInput
                ref={inputRef}
                placeholder="Ask about your focus..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                style={{
                  flex: 1,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "500",
                }}
                value={queryText}
                onChangeText={setQueryText}
                onSubmitEditing={() => handleSearch(queryText)}
                returnKeyType="search"
                editable={!isSearching}
                selectTextOnFocus
              />
              {queryText.trim() && (
                <Pressable
                  onPress={handleClear}
                  className="p-1"
                  hitSlop={8}
                >
                  <Image
                    source="sf:xmark.circle.fill"
                    style={{
                      width: 18,
                      height: 18,
                      tintColor: "rgba(255, 255, 255, 0.5)",
                    }}
                  />
                </Pressable>
              )}
            </View>
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
                      entering={FadeInDown.delay(i * 80).duration(600)}
                      style={{
                        height: 100 + i * 20,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                      }}
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
                      style={{
                        color: "rgba(255, 255, 255, 0.6)",
                        fontSize: 13,
                        fontWeight: "500",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      ✨ Trending Today
                    </Animated.Text>

                    {trendingInsights.map((insight, idx) => (
                      <Animated.View
                        key={insight.id}
                        entering={FadeInDown.delay((idx + 1) * 60).duration(
                          400,
                        )}
                      >
                        <Pressable
                          onPress={() =>
                            handleInsightTap(insight.suggestedQuery)
                          }
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.8 : 1,
                          })}
                        >
                          <GlassView
                            glassEffectStyle="thin"
                            colorScheme="dark"
                            style={{
                              borderRadius: 12,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              className="px-[14px] py-3 flex-row items-center gap-3"
                              style={{
                                borderLeftWidth: 3,
                                borderLeftColor: insight.color,
                              }}
                            >
                              <Image
                                source={insight.icon}
                                style={{
                                  width: 20,
                                  height: 20,
                                  tintColor: insight.color,
                                }}
                              />
                              <View className="flex-1 gap-0.5">
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontSize: 13,
                                    fontWeight: "600",
                                  }}
                                >
                                  {insight.title}
                                </Text>
                                <Text
                                  style={{
                                    color: "rgba(255, 255, 255, 0.5)",
                                    fontSize: 12,
                                  }}
                                >
                                  {insight.subtitle}
                                </Text>
                              </View>
                              <Image
                                source="sf:chevron.right"
                                style={{
                                  width: 14,
                                  height: 14,
                                  tintColor: "rgba(255, 255, 255, 0.3)",
                                }}
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
                      entering={FadeInDown.delay(idx * 80).duration(400)}
                    >
                      <Pressable
                        onPress={() => handleChipTap(chip)}
                        className="px-[14px] py-3 bg-white/10 rounded-xl border border-white/[0.15]"
                      >
                        <Animated.Text
                          style={{
                            color: "#fff",
                            fontSize: 15,
                            fontWeight: "500",
                          }}
                        >
                          {chip}
                        </Animated.Text>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          // Results: render specs
          <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}>
            {specs.map((spec, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 50).duration(400)}
              >
                <AIComponentRenderer
                  spec={spec}
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
