import { HStack, Image, Link, Text, VStack } from "@expo/ui/swift-ui";
import {
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

import { Semantic } from "@/constants/theme";

export type ChronaLiveActivityProps = {
  startDate: string;
  title: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
};

function accentOf(props: ChronaLiveActivityProps): string {
  return props.projectColor.length > 0 ? props.projectColor : Semantic.streak;
}

function StopLink() {
  "widget";
  return (
    <Link
      destination="chrona://stop"
      modifiers={[
        padding({ vertical: 8 }),
        foregroundStyle("rgba(255,255,255,0.6)"),
        font({ size: 13, weight: "semibold" }),
      ]}
    >
      <HStack spacing={4}>
        <Image systemName="stop.fill" size={12} color="rgba(255,255,255,0.6)" />
        <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("rgba(255,255,255,0.6)")]}>
          Stop
        </Text>
      </HStack>
    </Link>
  );
}

function IconCircle(props: { icon: string; color: string; size: number }) {
  "widget";
  return (
    <VStack
      alignment="center"
      modifiers={[
        frame({ width: props.size, height: props.size }),
        cornerRadius(props.size / 2),
      ]}
    >
      <Image systemName={(props.icon || "timer") as never} size={props.size * 0.5} color={props.color} />
    </VStack>
  );
}

function Banner(props: ChronaLiveActivityProps) {
  "widget";
  const accent = accentOf(props);
  return (
    <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 16, vertical: 14 })]}>
      <HStack spacing={10}>
        <IconCircle icon={props.projectIcon} color={accent} size={36} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("#FFFFFF")]}>
            {props.title.length > 0 ? props.title : "Chrona Session"}
          </Text>
          <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(accent)]}>
            {props.projectName.length > 0 ? props.projectName : "Chrona"}
          </Text>
        </VStack>
        <Text
          date={new Date(props.startDate)}
          dateStyle="timer"
          modifiers={[
            font({ size: 22, weight: "bold", design: "monospaced" }),
            foregroundStyle(accent),
          ]}
        />
      </HStack>
      <StopLink />
    </VStack>
  );
}

function ExpandedLeading(props: ChronaLiveActivityProps) {
  "widget";
  const accent = accentOf(props);
  return (
    <HStack spacing={10} modifiers={[padding({ leading: 4 })]}>
      <IconCircle icon={props.projectIcon} color={accent} size={36} />
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("#FFFFFF")]}>
          {props.title.length > 0 ? props.title : "Chrona Session"}
        </Text>
        <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(accent)]}>
          {props.projectName.length > 0 ? props.projectName : "Chrona"}
        </Text>
      </VStack>
    </HStack>
  );
}

function ExpandedTrailing(props: ChronaLiveActivityProps) {
  "widget";
  return (
    <Text
      date={new Date(props.startDate)}
      dateStyle="timer"
      modifiers={[
        padding({ trailing: 4 }),
        font({ size: 22, weight: "bold", design: "monospaced" }),
        foregroundStyle(accentOf(props)),
      ]}
    />
  );
}

function ExpandedBottom() {
  "widget";
  return (
    <VStack modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
      <StopLink />
    </VStack>
  );
}

function CompactLeading(props: ChronaLiveActivityProps) {
  "widget";
  return (
    <Image
      systemName={(props.projectIcon || "timer") as never}
      size={16}
      color={accentOf(props)}
    />
  );
}

function CompactTrailing(props: ChronaLiveActivityProps) {
  "widget";
  return (
    <Text
      date={new Date(props.startDate)}
      dateStyle="timer"
      modifiers={[
        font({ size: 12, weight: "semibold", design: "monospaced" }),
        foregroundStyle(accentOf(props)),
      ]}
    />
  );
}

function Minimal(props: ChronaLiveActivityProps) {
  "widget";
  return (
    <Image
      systemName={(props.projectIcon || "timer") as never}
      size={14}
      color={accentOf(props)}
    />
  );
}

function ChronaLiveActivityLayout(
  props: ChronaLiveActivityProps,
  _environment: LiveActivityEnvironment,
) {
  "widget";
  return {
    banner: <Banner {...props} />,
    compactLeading: <CompactLeading {...props} />,
    compactTrailing: <CompactTrailing {...props} />,
    minimal: <Minimal {...props} />,
    expandedLeading: <ExpandedLeading {...props} />,
    expandedTrailing: <ExpandedTrailing {...props} />,
    expandedBottom: <ExpandedBottom />,
  };
}

export default createLiveActivity<ChronaLiveActivityProps>(
  "ChronaLiveActivity",
  ChronaLiveActivityLayout,
);
