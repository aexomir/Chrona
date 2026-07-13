import { HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import { Colors, Semantic } from "@/constants/theme";

export type TimelineWidgetSession = {
  title: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
  startTime: string;
  durationMinutes: number;
  isActive: boolean;
};

export type TimelineWidgetProps = {
  sessions: TimelineWidgetSession[];
  isTracking: boolean;
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatStartTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function TimelineHeader(props: { isTracking: boolean; accent: string }) {
  "widget";
  return (
    <HStack spacing={6}>
      <Text
        modifiers={[
          font({ size: 9, weight: "semibold", design: "monospaced" }),
          foregroundStyle("rgba(255,255,255,0.7)"),
        ]}
      >
        TIMELINE
      </Text>
      {props.isTracking ? (
        <Text
          modifiers={[
            font({ size: 9, weight: "bold", design: "monospaced" }),
            foregroundStyle(props.accent),
          ]}
        >
          LIVE
        </Text>
      ) : (
        <Text
          modifiers={[
            font({ size: 9, weight: "medium", design: "monospaced" }),
            foregroundStyle("rgba(255,255,255,0.3)"),
          ]}
        >
          TODAY
        </Text>
      )}
    </HStack>
  );
}

function SessionRow(props: { session: TimelineWidgetSession }) {
  "widget";
  const { session } = props;
  return (
    <HStack spacing={8}>
      <Image
        systemName={(session.projectIcon || "folder.fill") as never}
        size={10}
        color={session.projectColor}
      />
      <VStack alignment="leading" spacing={1}>
        <Text
          modifiers={[
            font({ size: 12, weight: "medium" }),
            foregroundStyle("#FFFFFF"),
          ]}
        >
          {session.title.length > 0 ? session.title : "Untitled"}
        </Text>
        {session.projectName.length > 0 ? (
          <Text
            modifiers={[
              font({ size: 10 }),
              foregroundStyle("rgba(255,255,255,0.35)"),
            ]}
          >
            {session.projectName}
          </Text>
        ) : null}
      </VStack>
      {session.isActive ? (
        <Text
          date={new Date(session.startTime)}
          dateStyle="timer"
          modifiers={[
            font({ size: 11, weight: "semibold", design: "monospaced" }),
            foregroundStyle(session.projectColor),
          ]}
        />
      ) : (
        <Text
          modifiers={[
            font({ size: 11, weight: "semibold", design: "monospaced" }),
            foregroundStyle("rgba(255,255,255,0.55)"),
          ]}
        >
          {formatDuration(session.durationMinutes)}
        </Text>
      )}
      <Text
        modifiers={[
          font({ size: 9, design: "monospaced" }),
          foregroundStyle("rgba(255,255,255,0.25)"),
        ]}
      >
        {formatStartTime(session.startTime)}
      </Text>
    </HStack>
  );
}

function EmptyState() {
  "widget";
  return (
    <VStack alignment="center" spacing={5}>
      <Image systemName="timer" size={16} color="rgba(255,255,255,0.25)" />
      <Text
        modifiers={[font({ size: 11 }), foregroundStyle("rgba(255,255,255,0.25)")]}
      >
        No sessions yet
      </Text>
    </VStack>
  );
}

function TimelineWidget(props: TimelineWidgetProps, environment: WidgetEnvironment) {
  "widget";

  const maxRows = environment.widgetFamily === "systemLarge" ? 6 : 3;
  const visible = props.sessions.slice(0, maxRows);
  const overflow = props.sessions.length - visible.length;
  const accent = props.sessions[0]?.projectColor ?? Semantic.streak;

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[
        padding({ all: 14 }),
        containerBackground(Colors.dark.background, "widget"),
        widgetURL("chrona://(tabs)/timeline"),
      ]}
    >
      <TimelineHeader isTracking={props.isTracking} accent={accent} />
      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <VStack alignment="leading" spacing={10}>
          {visible.map((session, index) => (
            <SessionRow key={`${session.startTime}-${index}`} session={session} />
          ))}
        </VStack>
      )}
      {overflow > 0 ? (
        <Text
          modifiers={[
            font({ size: 10 }),
            foregroundStyle("rgba(255,255,255,0.3)"),
          ]}
        >
          {`+${overflow} more`}
        </Text>
      ) : null}
    </VStack>
  );
}

export default createWidget<TimelineWidgetProps>("TimelineWidget", TimelineWidget);
