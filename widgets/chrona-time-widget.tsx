import { Divider, HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import { Colors, Semantic } from "@/constants/theme";

export type ChronaTimeWidgetProps = {
  focusMinutesToday: number;
  isTracking: boolean;
  currentSessionMinutes: number;
  startTimestamp: string;
  currentSessionTitle: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
  /** Precomputed idle-state suggestion string for this timeline entry's minute. */
  suggestion: string;
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Header() {
  "widget";
  return (
    <Text
      modifiers={[
        font({ size: 10, weight: "semibold", design: "monospaced" }),
        foregroundStyle("rgba(255,255,255,0.7)"),
      ]}
    >
      CHRONA
    </Text>
  );
}

function LeftColumn(props: ChronaTimeWidgetProps) {
  "widget";
  const hasProject = props.isTracking && props.projectName.length > 0;
  const accent = hasProject ? props.projectColor : Semantic.streak;

  return (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={6}>
        <Header />
        {props.isTracking ? (
          <Text
            modifiers={[
              font({ size: 8, weight: "bold", design: "monospaced" }),
              foregroundStyle(accent),
            ]}
          >
            LIVE
          </Text>
        ) : null}
      </HStack>
      <Text
        modifiers={[
          font({ size: 44, weight: "bold", design: "rounded" }),
          foregroundStyle("#FFFFFF"),
        ]}
      >
        {formatDuration(props.focusMinutesToday)}
      </Text>
      <Text
        modifiers={[font({ size: 11 }), foregroundStyle("rgba(255,255,255,0.45)")]}
      >
        today
      </Text>
    </VStack>
  );
}

function TrackingRightView(props: ChronaTimeWidgetProps) {
  "widget";
  return (
    <VStack alignment="leading" spacing={4}>
      <Image
        systemName={(props.projectIcon || "folder.fill") as never}
        size={16}
        color={props.projectColor}
      />
      <Text
        modifiers={[
          font({ size: 13, weight: "semibold" }),
          foregroundStyle("#FFFFFF"),
        ]}
      >
        {props.projectName}
      </Text>
      <Text
        modifiers={[
          font({ size: 11 }),
          foregroundStyle("rgba(255,255,255,0.55)"),
        ]}
      >
        {props.currentSessionTitle.length > 0 ? props.currentSessionTitle : "In session"}
      </Text>
      {props.startTimestamp.length > 0 ? (
        <Text
          date={new Date(props.startTimestamp)}
          dateStyle="timer"
          modifiers={[
            font({ size: 12, weight: "semibold", design: "monospaced" }),
            foregroundStyle(props.projectColor),
          ]}
        />
      ) : (
        <Text
          modifiers={[
            font({ size: 12, weight: "semibold", design: "monospaced" }),
            foregroundStyle(props.projectColor),
          ]}
        >
          {formatDuration(props.currentSessionMinutes)}
        </Text>
      )}
    </VStack>
  );
}

function IdleRightView(props: ChronaTimeWidgetProps) {
  "widget";
  return (
    <VStack alignment="leading" spacing={4}>
      <Text
        modifiers={[
          font({ size: 9, weight: "semibold", design: "monospaced" }),
          foregroundStyle("rgba(255,255,255,0.35)"),
        ]}
      >
        START
      </Text>
      <Image systemName="play.fill" size={20} color="#FFFFFF" />
      <Text
        modifiers={[
          font({ size: 12, weight: "medium" }),
          foregroundStyle("rgba(255,255,255,0.7)"),
        ]}
      >
        {props.suggestion}
      </Text>
      <Text
        modifiers={[font({ size: 10 }), foregroundStyle("rgba(255,255,255,0.35)")]}
      >
        Tap to begin
      </Text>
    </VStack>
  );
}

function ChronaTimeWidget(props: ChronaTimeWidgetProps, environment: WidgetEnvironment) {
  "widget";

  const hasProject = props.isTracking && props.projectName.length > 0;

  if (environment.widgetFamily === "systemMedium") {
    return (
      <HStack
        spacing={14}
        modifiers={[
          padding({ all: 14 }),
          containerBackground(Colors.dark.background, "widget"),
        ]}
      >
        <LeftColumn {...props} />
        <Divider />
        {hasProject ? <TrackingRightView {...props} /> : <IdleRightView {...props} />}
      </HStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        padding({ all: 14 }),
        containerBackground(Colors.dark.background, "widget"),
      ]}
    >
      <LeftColumn {...props} />
      {hasProject ? (
        <HStack spacing={6}>
          <Image
            systemName={(props.projectIcon || "folder.fill") as never}
            size={11}
            color={props.projectColor}
          />
          <Text
            modifiers={[
              font({ size: 11, weight: "medium" }),
              foregroundStyle("#FFFFFF"),
            ]}
          >
            {props.projectName}
          </Text>
          {props.startTimestamp.length > 0 ? (
            <Text
              date={new Date(props.startTimestamp)}
              dateStyle="timer"
              modifiers={[
                font({ size: 10, weight: "semibold", design: "monospaced" }),
                foregroundStyle(props.projectColor),
              ]}
            />
          ) : null}
        </HStack>
      ) : (
        <HStack spacing={5}>
          <Image systemName="play.fill" size={9} color="rgba(255,255,255,0.35)" />
          <Text
            modifiers={[
              font({ size: 11, weight: "medium" }),
              foregroundStyle("rgba(255,255,255,0.7)"),
            ]}
          >
            {props.suggestion}
          </Text>
        </HStack>
      )}
    </VStack>
  );
}

export default createWidget<ChronaTimeWidgetProps>("ChronaTimeWidget", ChronaTimeWidget);
