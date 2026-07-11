import { Semantic } from "@/constants/theme";
import { EMPTY_STATE_HOURS } from "@/features/timeline/timeline-utils";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

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

  let nowRowIndex = -1;
  if (isToday) {
    for (let i = EMPTY_STATE_HOURS.length - 1; i >= 0; i--) {
      if (EMPTY_STATE_HOURS[i] <= Math.floor(currentHour)) {
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
      <View className="w-full max-w-[280px] mb-8">
        {EMPTY_STATE_HOURS.map((h, i) => {
          const isNowRow = i === nowRowIndex;
          return (
            <Animated.View
              key={h}
              entering={FadeInDown.delay(i * 45).duration(320)}
              className="flex-row items-center mb-2.5"
            >
              <Text
                className="w-11 text-[11px] font-medium text-right mr-2.5 tracking-wide"
                style={{
                  color: isNowRow
                    ? Semantic.warningBright
                    : "rgba(255,255,255,0.18)",
                }}
              >
                {formatHour(h)}
              </Text>

              {isNowRow ? (
                <View
                  className="w-1.5 h-1.5 rounded-full mr-2"
                  style={{
                    backgroundColor: Semantic.warningBright,
                    shadowColor: Semantic.warningBright,
                    shadowOpacity: 0.9,
                    shadowRadius: 5,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
              ) : (
                <View className="w-1.5 mr-2" />
              )}

              <View
                className="flex-1 h-px"
                style={{
                  backgroundColor: isNowRow
                    ? "rgba(251,191,36,0.22)"
                    : "rgba(255,255,255,0.05)",
                }}
              />
            </Animated.View>
          );
        })}
      </View>

      <Animated.View
        entering={FadeInDown.delay(EMPTY_STATE_HOURS.length * 45 + 40).duration(300)}
        className="items-center"
      >
        <Text className="text-white text-lg font-semibold mb-2 text-center">
          {title}
        </Text>
        <Text
          className={`text-zinc-500 text-sm text-center leading-5 max-w-[240px] ${isToday ? "mb-6" : ""}`}
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
