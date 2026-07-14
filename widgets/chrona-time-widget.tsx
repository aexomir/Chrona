import { Divider, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

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

function ChronaTimeWidget(props: ChronaTimeWidgetProps, environment: WidgetEnvironment) {
  "widget";

  function formatDuration(minutes: number): string {
    if (minutes <= 0) return "0m";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  const hasProject = props.isTracking && props.projectName.length > 0;
  const accent = hasProject ? props.projectColor : "#f97316";

  const leftColumn = (
    <VStack alignment="leading" spacing={4}>
      <HStack spacing={6}>
        <Text
          modifiers={[
            font({ size: 10, weight: "semibold", design: "monospaced" }),
            foregroundStyle("rgba(255,255,255,0.7)"),
          ]}
        >
          CHRONA
        </Text>
        {props.isTracking ? (
          <Text
            modifiers={[
              font({ size: 8, weight: "bold", design: "monospaced" }),
              foregroundStyle(accent),
              padding({ horizontal: 5, vertical: 2 }),
              background(`${accent}24`, shapes.capsule()),
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

  if (environment.widgetFamily === "systemMedium") {
    return (
      <HStack
        spacing={16}
        modifiers={[
          padding({ all: 14 }),
          containerBackground("#18181b", "widget"),
        ]}
      >
        {leftColumn}
        <Divider />
        {hasProject ? (
          <VStack alignment="leading" spacing={6}>
            <HStack spacing={0}>
              <VStack
                alignment="center"
                modifiers={[
                  frame({ width: 30, height: 30 }),
                  background(props.projectColor, shapes.roundedRectangle({ cornerRadius: 9 })),
                ]}
              >
                <Image
                  systemName={(props.projectIcon || "folder.fill") as never}
                  size={15}
                  color="#FFFFFF"
                />
              </VStack>
              <Spacer />
              <VStack
                alignment="center"
                modifiers={[
                  frame({ width: 7, height: 7 }),
                  background(props.projectColor, shapes.circle()),
                ]}
              >
                {null}
              </VStack>
            </HStack>
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
        ) : (
          <VStack alignment="leading" spacing={8}>
            <VStack
              alignment="center"
              modifiers={[
                frame({ width: 30, height: 30 }),
                background("rgba(255,255,255,0.1)", shapes.roundedRectangle({ cornerRadius: 9 })),
              ]}
            >
              <Image systemName="play.fill" size={12} color="#FFFFFF" />
            </VStack>
            <Text
              modifiers={[
                font({ size: 12, weight: "medium" }),
                foregroundStyle("rgba(255,255,255,0.7)"),
              ]}
            >
              {props.suggestion}
            </Text>
          </VStack>
        )}
      </HStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[
        padding({ all: 14 }),
        containerBackground("#18181b", "widget"),
      ]}
    >
      {leftColumn}
      {hasProject ? (
        <HStack spacing={6}>
          <VStack
            alignment="center"
            modifiers={[
              frame({ width: 18, height: 18 }),
              background(props.projectColor, shapes.roundedRectangle({ cornerRadius: 6 })),
            ]}
          >
            <Image
              systemName={(props.projectIcon || "folder.fill") as never}
              size={9}
              color="#FFFFFF"
            />
          </VStack>
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
        <HStack spacing={6}>
          <VStack
            alignment="center"
            modifiers={[
              frame({ width: 18, height: 18 }),
              background("rgba(255,255,255,0.1)", shapes.roundedRectangle({ cornerRadius: 6 })),
            ]}
          >
            <Image systemName="play.fill" size={8} color="#FFFFFF" />
          </VStack>
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
