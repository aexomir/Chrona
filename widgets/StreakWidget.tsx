import { VStack, Text, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  frame,
  kerning,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets/build/Widgets.types';

type StreakProps = {
  streakDays: number;
};

const StreakWidgetComponent = (props: StreakProps, _env: WidgetEnvironment) => {
  'widget';

  const { streakDays } = props;

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
        modifiers={[padding({ all: 14 })]}
      >
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            foregroundStyle({ type: 'color', color: '#99FFFFFF' }),
            kerning(1.5),
          ]}
        >
          STREAK
        </Text>

        <Text
          modifiers={[
            font({ size: 48, weight: 'bold' }),
            foregroundStyle('white'),
            kerning(-1),
          ]}
        >
          {streakDays === 0 ? '\u2014' : streakDays.toString()}
        </Text>

        <Text
          modifiers={[
            font({ size: 12, weight: 'medium' }),
            foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
          ]}
        >
          {streakDays === 0 ? 'Start today' : 'day streak'}
        </Text>
      </VStack>
    </ZStack>
  );
};

export default createWidget('StreakWidget', StreakWidgetComponent);
