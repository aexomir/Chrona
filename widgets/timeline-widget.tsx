import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

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

function TimelineWidget(props: TimelineWidgetProps, environment: WidgetEnvironment) {
  "widget";

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

  const maxRows = environment.widgetFamily === "systemLarge" ? 6 : 3;
  const visible = props.sessions.slice(0, maxRows);
  const overflow = props.sessions.length - visible.length;
  const accent = props.sessions[0]?.projectColor ?? "#f97316";

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[
        padding({ all: 14 }),
        containerBackground("#18181b", "widget"),
        widgetURL("chrona://(tabs)/timeline"),
      ]}
    >
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
              foregroundStyle(accent),
              padding({ horizontal: 6, vertical: 2 }),
              background(`${accent}24`, shapes.capsule()),
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
      {visible.length === 0 ? (
        <VStack alignment="center" spacing={5}>
          <Image systemName="timer" size={16} color="rgba(255,255,255,0.25)" />
          <Text
            modifiers={[font({ size: 11 }), foregroundStyle("rgba(255,255,255,0.25)")]}
          >
            No sessions yet
          </Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={10}>
          {visible.map((session, index) => (
            <HStack key={`${session.startTime}-${index}`} spacing={8}>
              <VStack
                alignment="center"
                modifiers={[
                  frame({ width: 20, height: 20 }),
                  background(session.projectColor, shapes.roundedRectangle({ cornerRadius: 6 })),
                ]}
              >
                <Image
                  systemName={(session.projectIcon || "folder.fill") as never}
                  size={10}
                  color="#FFFFFF"
                />
              </VStack>
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
              <Spacer />
              <VStack alignment="trailing" spacing={1}>
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
              </VStack>
            </HStack>
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
