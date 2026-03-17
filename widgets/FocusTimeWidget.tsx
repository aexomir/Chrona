import { VStack, Text, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  frame,
  kerning,
  onTapGesture,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets/build/Widgets.types';

type FocusTimeProps = {
  todayMinutes: number;
  streakDays: number;
  isTracking: boolean;
  elapsedMinutes: number;
  suggestedProjectName: string;
  suggestedProjectId: string;
};

const FocusTimeWidgetComponent = (props: FocusTimeProps, env: WidgetEnvironment) => {
  'widget';

  const { todayMinutes, streakDays, isTracking, elapsedMinutes, suggestedProjectName } = props;
  const isSmall = env.widgetFamily === 'systemSmall';
  const pad = isSmall ? 14 : 20;

  const h = Math.floor((isTracking ? elapsedMinutes : todayMinutes) / 60);
  const m = (isTracking ? elapsedMinutes : todayMinutes) % 60;
  const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const displayTime = isTracking
    ? (elapsedMinutes === 0 ? '0m' : timeLabel)
    : (todayMinutes === 0 ? '—' : timeLabel);

  const hasProject = suggestedProjectName.length > 0;

  return (
    <ZStack
      alignment="bottomLeading"
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        background('black'),
        onTapGesture(() => {}),
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
            font({ size: isSmall ? 11 : 12, weight: 'semibold' }),
            foregroundStyle({ type: 'color', color: '#99FFFFFF' }),
            kerning(1.5),
          ]}
        >
          {isTracking ? '\u25CF LIVE' : 'FOCUS'}
        </Text>

        {/* Large time display */}
        <Text
          modifiers={[
            font({ size: isSmall ? 36 : 44, weight: 'bold' }),
            foregroundStyle('white'),
            kerning(-1),
          ]}
        >
          {displayTime}
        </Text>

        {/* Secondary line: current project (tracking) or suggestion / streak (idle) */}
        {isTracking
          ? hasProject && (
              <Text
                modifiers={[
                  font({ size: 12, weight: 'medium' }),
                  foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
                ]}
              >
                {suggestedProjectName}
              </Text>
            )
          : hasProject
            ? (
                <Text
                  modifiers={[
                    font({ size: 12, weight: 'medium' }),
                    foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
                  ]}
                >
                  {`\u2192 ${suggestedProjectName}`}
                </Text>
              )
            : streakDays > 1 && (
                <Text
                  modifiers={[
                    font({ size: 12, weight: 'medium' }),
                    foregroundStyle({ type: 'color', color: '#66FFFFFF' }),
                  ]}
                >
                  {`\uD83D\uDD25 ${streakDays} day streak`}
                </Text>
              )
        }
      </VStack>
    </ZStack>
  );
};

export default createWidget('FocusTimeWidget', FocusTimeWidgetComponent);
