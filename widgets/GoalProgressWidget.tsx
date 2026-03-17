import { VStack, HStack, Text, ZStack, Spacer, Gauge } from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  kerning,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets/build/Widgets.types';

type GoalProgressProps = {
  todayMinutes: number;
  goalMinutes: number;
};

const GoalProgressWidgetComponent = (props: GoalProgressProps, env: WidgetEnvironment) => {
  'widget';

  const { todayMinutes, goalMinutes } = props;
  const isSmall = env.widgetFamily === 'systemSmall';
  const pad = isSmall ? 14 : 20;

  const pct = goalMinutes > 0 ? Math.min(100, Math.round((todayMinutes / goalMinutes) * 100)) : 0;
  const gaugeValue = goalMinutes > 0 ? Math.min(1, todayMinutes / goalMinutes) : 0;

  const fmtH = Math.floor(todayMinutes / 60);
  const fmtM = todayMinutes % 60;
  const todayLabel = fmtH > 0 && fmtM > 0
    ? `${fmtH}h ${fmtM}m`
    : fmtH > 0
      ? `${fmtH}h`
      : `${fmtM}m`;

  const goalH = Math.floor(goalMinutes / 60);
  const goalM = goalMinutes % 60;
  const goalLabel = goalH > 0 && goalM > 0
    ? `${goalH}h ${goalM}m`
    : goalH > 0
      ? `${goalH}h`
      : `${goalM}m`;

  const remainingMinutes = Math.max(0, goalMinutes - todayMinutes);
  const remH = Math.floor(remainingMinutes / 60);
  const remM = remainingMinutes % 60;
  const remainingLabel = remH > 0 && remM > 0
    ? `${remH}h ${remM}m more`
    : remH > 0
      ? `${remH}h more`
      : `${remM}m more`;
  const statusLabel = pct >= 100 ? 'Goal reached!' : remainingLabel;

  if (isSmall) {
    return (
      <ZStack
        alignment="bottomLeading"
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          background('black'),
        ]}
      >
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[padding({ all: pad })]}
        >
          <Text
            modifiers={[
              font({ size: 11, weight: 'semibold' }),
              foregroundStyle({ type: 'color', color: '#99FFFFFF' }),
              kerning(1.5),
            ]}
          >
            GOAL
          </Text>

          <Text
            modifiers={[
              font({ size: 36, weight: 'bold' }),
              foregroundStyle('white'),
              kerning(-1),
            ]}
          >
            {`${pct}%`}
          </Text>

          <Gauge
            value={gaugeValue}
            min={0}
            max={1}
            modifiers={[
              gaugeStyle('linearCapacity'),
              tint('white'),
              frame({ maxWidth: Infinity }),
            ]}
          />

          <Text
            modifiers={[
              font({ size: 11, weight: 'medium' }),
              foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
            ]}
          >
            {`${todayLabel} of ${goalLabel}`}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  return (
    <ZStack
      alignment="bottomLeading"
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        background('black'),
      ]}
    >
      <HStack
        alignment="bottom"
        spacing={16}
        modifiers={[
          padding({ all: pad }),
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
        ]}
      >
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[frame({ maxWidth: Infinity })]}
        >
          <Text
            modifiers={[
              font({ size: 11, weight: 'semibold' }),
              foregroundStyle({ type: 'color', color: '#99FFFFFF' }),
              kerning(1.5),
            ]}
          >
            GOAL
          </Text>

          <Text
            modifiers={[
              font({ size: 40, weight: 'bold' }),
              foregroundStyle('white'),
              kerning(-1),
            ]}
          >
            {`${pct}%`}
          </Text>

          <Gauge
            value={gaugeValue}
            min={0}
            max={1}
            modifiers={[
              gaugeStyle('linearCapacity'),
              tint('white'),
              frame({ maxWidth: Infinity }),
            ]}
          />

          <Text
            modifiers={[
              font({ size: 11, weight: 'medium' }),
              foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
            ]}
          >
            {`${todayLabel} of ${goalLabel}`}
          </Text>
        </VStack>

        <VStack alignment="trailing" spacing={4}>
          <Text
            modifiers={[
              font({ size: 11, weight: 'semibold' }),
              foregroundStyle({ type: 'color', color: '#99FFFFFF' }),
              kerning(1.5),
            ]}
          >
            TODAY
          </Text>

          <Text
            modifiers={[
              font({ size: 28, weight: 'bold' }),
              foregroundStyle('white'),
              kerning(-1),
            ]}
          >
            {todayLabel}
          </Text>

          <Text
            modifiers={[
              font({ size: 11, weight: 'medium' }),
              foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
            ]}
          >
            {statusLabel}
          </Text>
        </VStack>
      </HStack>
    </ZStack>
  );
};

export default createWidget('GoalProgressWidget', GoalProgressWidgetComponent);
