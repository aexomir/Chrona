import { HStack, Image, Link, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  font,
  foregroundStyle,
  frame,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

export type ChronaLiveActivityProps = {
  startDate: string;
  title: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
};

function ChronaLiveActivityLayout(
  props: ChronaLiveActivityProps,
  _environment: LiveActivityEnvironment,
) {
  "widget";

  const accent = props.projectColor.length > 0 ? props.projectColor : "#f97316";

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={10}
        modifiers={[padding({ horizontal: 16, vertical: 14 })]}
      >
        <HStack spacing={10}>
          <VStack
            alignment="center"
            modifiers={[
              frame({ width: 34, height: 34 }),
              background(accent, shapes.roundedRectangle({ cornerRadius: 10 })),
            ]}
          >
            <Image
              systemName={(props.projectIcon || "timer") as never}
              size={16}
              color="#FFFFFF"
            />
          </VStack>
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[
                font({ size: 14, weight: "semibold" }),
                foregroundStyle("#FFFFFF"),
              ]}
            >
              {props.title.length > 0 ? props.title : "Chrona Session"}
            </Text>
            <Text
              modifiers={[
                font({ size: 11, weight: "medium" }),
                foregroundStyle(accent),
              ]}
            >
              {props.projectName.length > 0 ? props.projectName : "Chrona"}
            </Text>
          </VStack>
        </HStack>
        <HStack spacing={10}>
          <Text
            date={new Date(props.startDate)}
            dateStyle="timer"
            modifiers={[
              font({ size: 30, weight: "bold", design: "monospaced" }),
              foregroundStyle("#FFFFFF"),
            ]}
          />
          <Spacer />
          <Link
            destination="chrona://stop"
            modifiers={[
              padding({ horizontal: 14, vertical: 7 }),
              background(accent, shapes.capsule()),
            ]}
          >
            <HStack spacing={5}>
              <Image systemName="stop.fill" size={11} color="#FFFFFF" />
              <Text
                modifiers={[
                  font({ size: 12, weight: "semibold" }),
                  foregroundStyle("#FFFFFF"),
                ]}
              >
                Stop
              </Text>
            </HStack>
          </Link>
        </HStack>
      </VStack>
    ),
    compactLeading: (
      <Image
        systemName={(props.projectIcon || "timer") as never}
        size={13}
        color={accent}
      />
    ),
    compactTrailing: (
      <Text
        date={new Date(props.startDate)}
        dateStyle="timer"
        modifiers={[
          font({ size: 11, weight: "semibold", design: "monospaced" }),
          foregroundStyle(accent),
          monospacedDigit(),
          frame({ width: 44, alignment: "trailing" }),
          minimumScaleFactor(0.8),
        ]}
      />
    ),
    minimal: (
      <Image
        systemName={(props.projectIcon || "timer") as never}
        size={13}
        color={accent}
      />
    ),
    expandedLeading: (
      <HStack spacing={10} modifiers={[padding({ leading: 4 })]}>
        <VStack
          alignment="center"
          modifiers={[
            frame({ width: 36, height: 36 }),
            background(accent, shapes.roundedRectangle({ cornerRadius: 10 })),
          ]}
        >
          <Image
            systemName={(props.projectIcon || "timer") as never}
            size={17}
            color="#FFFFFF"
          />
        </VStack>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ size: 14, weight: "semibold" }),
              foregroundStyle("#FFFFFF"),
            ]}
          >
            {props.title.length > 0 ? props.title : "Chrona Session"}
          </Text>
          <Text
            modifiers={[
              font({ size: 11, weight: "medium" }),
              foregroundStyle(accent),
            ]}
          >
            {props.projectName.length > 0 ? props.projectName : "Chrona"}
          </Text>
        </VStack>
      </HStack>
    ),
    expandedTrailing: (
      <Text
        date={new Date(props.startDate)}
        dateStyle="timer"
        modifiers={[
          padding({ trailing: 4 }),
          font({ size: 26, weight: "bold", design: "monospaced" }),
          foregroundStyle("#FFFFFF"),
          monospacedDigit(),
          frame({ width: 100, alignment: "trailing" }),
          minimumScaleFactor(0.8),
        ]}
      />
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
        <Spacer />
        <Link
          destination="chrona://stop"
          modifiers={[
            padding({ horizontal: 18, vertical: 9 }),
            background(accent, shapes.capsule()),
          ]}
        >
          <HStack spacing={6}>
            <Image systemName="stop.fill" size={13} color="#FFFFFF" />
            <Text
              modifiers={[
                font({ size: 13, weight: "semibold" }),
                foregroundStyle("#FFFFFF"),
              ]}
            >
              Stop
            </Text>
          </HStack>
        </Link>
        <Spacer />
      </HStack>
    ),
  };
}

export default createLiveActivity<ChronaLiveActivityProps>(
  "ChronaLiveActivity",
  ChronaLiveActivityLayout,
);
