import { Button, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  kerning,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";
import type { WidgetEnvironment } from "expo-widgets/build/Widgets.types";

type FocusTimeProps = {
  todayMinutes: number;
  streakDays: number;
  isTracking: boolean;
  elapsedMinutes: number;
  suggestedProjectName: string;
  suggestedProjectId: string;
  suggestedProjectColor: string;
};

const FocusTimeWidgetComponent = (
  props: FocusTimeProps,
  env: WidgetEnvironment,
) => {
  "widget";

  const {
    todayMinutes,
    streakDays,
    isTracking,
    elapsedMinutes,
    suggestedProjectName,
    suggestedProjectColor,
  } = props;
  const isSmall = env.widgetFamily === "systemSmall";
  const pad = isSmall ? 14 : 20;

  const h = Math.floor((isTracking ? elapsedMinutes : todayMinutes) / 60);
  const m = (isTracking ? elapsedMinutes : todayMinutes) % 60;
  const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const displayTime = isTracking
    ? elapsedMinutes === 0
      ? "0m"
      : timeLabel
    : todayMinutes === 0
      ? "—"
      : timeLabel;

  const hasSuggestion = suggestedProjectName.length > 0;
  const accentColor =
    suggestedProjectColor.length > 0 ? suggestedProjectColor : "#ffffff";

  return (
    <ZStack
      alignment="bottomLeading"
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        background("#18181b"),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={isSmall ? 2 : 4}
        modifiers={[padding({ all: pad })]}
      >
        {/* Status label */}
        <Text
          modifiers={[
            font({ size: isSmall ? 11 : 12, weight: "semibold" }),
            foregroundStyle(
              isTracking ? { type: "color", color: accentColor } : "white",
            ),

            kerning(1.5),
          ]}
        >
          {isTracking ? "\u25CF LIVE" : "FOCUS"}
        </Text>

        {/* Large time display */}
        <Text
          modifiers={[
            font({ size: isSmall ? 36 : 44, weight: "bold" }),
            foregroundStyle("white"),
            kerning(-1),
          ]}
        >
          {displayTime}
        </Text>

        {/* Secondary line or button */}
        {isTracking ? (
          hasSuggestion && (
            <Text
              modifiers={[
                font({ size: 12, weight: "medium" }),
                foregroundStyle({ type: "color", color: accentColor }),
              ]}
            >
              {suggestedProjectName}
            </Text>
          )
        ) : (
          <VStack alignment="leading" spacing={4}>
            {!hasSuggestion && streakDays > 1 && (
              <Text
                modifiers={[
                  font({ size: 12, weight: "medium" }),
                  foregroundStyle("white"),
                ]}
              >
                {`\uD83D\uDD25 ${streakDays} day streak`}
              </Text>
            )}
            {hasSuggestion ? (
              <Button
                label={suggestedProjectName}
                systemImage="play.fill"
                target="start-suggested"
                onPress={() => {}}
                modifiers={[
                  buttonStyle("bordered"),
                  controlSize("small"),
                  tint(accentColor),
                ]}
              />
            ) : (
              <Button
                label="Start Timer"
                systemImage="timer"
                target="start-manual"
                onPress={() => {}}
                modifiers={[
                  buttonStyle("bordered"),
                  controlSize("small"),
                  tint("#ffffff"),
                ]}
              />
            )}
          </VStack>
        )}
      </VStack>
    </ZStack>
  );
};

export default createWidget("FocusTimeWidget", FocusTimeWidgetComponent);
