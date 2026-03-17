import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets/build/Widgets.types';

type FocusTimeProps = {
  todayMinutes: number;
  streakDays: number;
};

const FocusTimeWidgetComponent = (props: FocusTimeProps, env: WidgetEnvironment) => {
  'widget';

  const { todayMinutes, streakDays } = props;
  const hours = Math.floor(todayMinutes / 60);
  const minutes = todayMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const isSmall = env.widgetFamily === 'systemSmall';

  return (
    <VStack
      style={{
        width: '100%',
        height: '100%',
        padding: isSmall ? 14 : 18,
        alignment: 'leading',
      }}
    >
      <Text
        style={{ font: 'caption', foregroundStyle: 'secondary' }}
      >
        FOCUS TODAY
      </Text>
      <Text
        style={{
          font: isSmall ? 'title' : 'largeTitle',
          fontWeight: 'bold',
          foregroundStyle: 'primary',
        }}
      >
        {todayMinutes === 0 ? '—' : timeLabel}
      </Text>
      {streakDays > 1 && (
        <HStack style={{ alignment: 'leading', spacing: 4 }}>
          <Text style={{ font: 'caption2', foregroundStyle: 'secondary' }}>
            🔥 {streakDays}-day streak
          </Text>
        </HStack>
      )}
    </VStack>
  );
};

export default createWidget('FocusTimeWidget', FocusTimeWidgetComponent);
