import { Semantic } from "@/constants/theme";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const HOURS = [7, 9, 11, 13, 15, 17, 19, 21];

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function TimelineEmptyState({ selectedDate }: { selectedDate: Date }) {
  const today = new Date();
  const isToday = isSameCalendarDay(selectedDate, today);
  const isPast =
    !isToday &&
    selectedDate <
      new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const currentHour = today.getHours() + today.getMinutes() / 60;

  // Index of the last hour slot that is <= current hour (for "now" marker)
  let nowRowIndex = -1;
  if (isToday) {
    for (let i = HOURS.length - 1; i >= 0; i--) {
      if (HOURS[i] <= Math.floor(currentHour)) {
        nowRowIndex = i;
        break;
      }
    }
  }

  const title = isToday
    ? "Nothing tracked yet"
    : isPast
      ? "Nothing was tracked"
      : "Day ahead";

  const subtitle = isToday
    ? "Start a session to record your focus time."
    : isPast
      ? "No sessions were logged on this day."
      : "Sessions will appear here as the day unfolds.";

  return (
    <View className="items-center pt-8 pb-12 px-8">
      {/* Hour rail */}
      <View style={{ width: "100%", maxWidth: 280, marginBottom: 32 }}>
        {HOURS.map((h, i) => {
          const isNowRow = i === nowRowIndex;
          return (
            <Animated.View
              key={h}
              entering={FadeInDown.delay(i * 45).duration(320)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              {/* Time label */}
              <Text
                style={{
                  width: 44,
                  fontSize: 11,
                  fontWeight: "500",
                  color: isNowRow
                    ? Semantic.warningBright
                    : "rgba(255,255,255,0.18)",
                  textAlign: "right",
                  marginRight: 10,
                  letterSpacing: 0.2,
                }}
              >
                {formatHour(h)}
              </Text>

              {/* Now dot or spacer */}
              {isNowRow ? (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: Semantic.warningBright,
                    marginRight: 8,
                    shadowColor: Semantic.warningBright,
                    shadowOpacity: 0.9,
                    shadowRadius: 5,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
              ) : (
                <View style={{ width: 6, marginRight: 8 }} />
              )}

              {/* Tick line */}
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isNowRow
                    ? "rgba(251,191,36,0.22)"
                    : "rgba(255,255,255,0.05)",
                }}
              />
            </Animated.View>
          );
        })}
      </View>

      {/* Copy + CTA */}
      <Animated.View
        entering={FadeInDown.delay(HOURS.length * 45 + 40).duration(300)}
        className="items-center"
      >
        <Text className="text-white text-lg font-semibold mb-2 text-center">
          {title}
        </Text>
        <Text
          className="text-zinc-500 text-sm text-center leading-5"
          style={{ maxWidth: 240, marginBottom: isToday ? 24 : 0 }}
        >
          {subtitle}
        </Text>
        {isToday && (
          <Button variant="primary" onPress={() => router.push("/timer")}>
            <Button.Label>Start a Session</Button.Label>
          </Button>
        )}
      </Animated.View>
    </View>
  );
}
