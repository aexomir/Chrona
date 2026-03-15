import { AIComponentRenderer } from "@/components/ai-component-renderer";
import { StaticAuraBackground } from "@/components/static-aura-background";
import { useSearchQuery } from "@/hooks/use-search-query";
import { generateTrendingInsights } from "@/lib/trending-insights";
import { useProjects } from "@/stores/projects-store";
import { useSessionsStore } from "@/stores/sessions-store";
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
    <View style={{ flex: 1 }}>
      <StaticAuraBackground />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 16,
            paddingBottom: 24,
          }}
        >
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            style={{
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 10,
              }}
            >
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
                  style={{ padding: 4 }}
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

        {/* Empty state or results */}
        {!specs ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {queryText.trim() ? (
              // Loading state
              isSearching && (
                <View style={{ gap: 12, marginTop: 12 }}>
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
              // Trending insights + suggestion chips
              <View>
                {/* Trending Insights */}
                {trendingInsights.length > 0 && (
                  <View style={{ marginBottom: 28, gap: 10 }}>
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
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
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
                              <View style={{ flex: 1, gap: 2 }}>
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

                {/* Suggestion Chips */}
                <View
                  style={{
                    marginBottom: 20,
                    paddingHorizontal: 0,
                  }}
                >
                  <Animated.Text
                    entering={FadeInDown.duration(400)}
                    style={{
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: 15,
                      fontWeight: "600",
                      marginBottom: 12,
                    }}
                  >
                    Try asking...
                  </Animated.Text>
                </View>

                <View style={{ gap: 10 }}>
                  {SUGGESTION_CHIPS.map((chip, idx) => (
                    <Animated.View
                      key={chip}
                      entering={FadeInDown.delay(idx * 80).duration(400)}
                    >
                      <Pressable
                        onPress={() => handleChipTap(chip)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.15)",
                        }}
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
                <AIComponentRenderer spec={spec} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
