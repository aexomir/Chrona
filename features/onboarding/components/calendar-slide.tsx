import { Semantic, TextAlpha } from "@/constants/theme";
import { ContinueLink } from "@/features/onboarding/components/continue-link";
import { CALENDAR_BLOCKS } from "@/features/onboarding/onboarding-constants";
import { Image } from "expo-image";
import { Button } from "heroui-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export function CalendarSlide({
  granted,
  onGrant,
  onContinue,
}: {
  granted: boolean;
  onGrant: () => void;
  onContinue: () => void;
}) {
  return (
    <View className="flex-1 justify-center px-6">
      <Animated.View entering={FadeIn.duration(350)} className="mb-2">
        <Text style={styles.heading}>{"What's on\ntoday?"}</Text>
        <Text style={styles.subtitle}>
          Overlay calendar events on your tracked sessions.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(200).duration(400)}
        className="my-7 h-[52px] relative"
      >
        <View style={styles.track}>
          {(["25%", "50%", "75%"] as const).map((left, i) => (
            <View key={i} style={[styles.gridline, { left }]} />
          ))}

          {granted &&
            CALENDAR_BLOCKS.map((b, i) => (
              <Animated.View
                key={i}
                entering={FadeIn.delay(i * 120).duration(400)}
                style={[
                  styles.block,
                  {
                    left: b.left,
                    width: b.width,
                    backgroundColor: b.color + "40",
                    borderLeftColor: b.color,
                  },
                ]}
              />
            ))}
        </View>

        <Text style={[styles.hourLabel, styles.hourLabelLeft]}>9am</Text>
        <Text style={[styles.hourLabel, styles.hourLabelRight]}>6pm</Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(400).duration(350)}
        className="mt-8 gap-3"
      >
        {granted ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Image
                source="sf:checkmark.circle.fill"
                style={styles.checkIcon}
                tintColor={Semantic.success}
              />
              <Text style={styles.connectedText}>Calendar connected</Text>
            </View>
            <View className="self-end">
              <ContinueLink onPress={onContinue} />
            </View>
          </View>
        ) : (
          <View className="gap-[14px]">
            <Button variant="outline" onPress={onGrant}>
              <Button.Label>Connect Calendar</Button.Label>
            </Button>
            <Pressable onPress={onContinue} className="items-center">
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 32,
    fontWeight: "600",
    color: "white",
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    color: TextAlpha.disabled,
    fontSize: 14,
    lineHeight: 20,
  },
  track: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    overflow: "hidden",
  },
  gridline: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  block: {
    position: "absolute",
    top: 8,
    bottom: 8,
    borderRadius: 5,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  hourLabel: {
    position: "absolute",
    bottom: -18,
    color: "rgba(255,255,255,0.18)",
    fontSize: 10,
  },
  hourLabelLeft: {
    left: 4,
  },
  hourLabelRight: {
    right: 4,
  },
  checkIcon: {
    width: 15,
    height: 15,
  },
  connectedText: {
    color: Semantic.success,
    fontSize: 14,
  },
  skipText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 13,
  },
});
