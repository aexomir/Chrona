import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type SessionActivityProps = {
  projectName: string;
  elapsedTime: string;
  title: string;
};

const SessionActivity = (props: SessionActivityProps) => {
  'widget';

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#a1a1a1')]}>
          {props.projectName}
        </Text>
        <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle('#ffffff')]}>
          {props.elapsedTime}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#71717a')]}>
          {props.title}
        </Text>
      </VStack>
    ),
    compactLeading: (
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#ffffff')]}>
        {props.elapsedTime}
      </Text>
    ),
    compactTrailing: (
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#a1a1a1')]}>
        {props.projectName}
      </Text>
    ),
    minimal: (
      <Image systemName="timer.circle.fill" color="#3b82f6" />
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Image systemName="timer.circle.fill" color="#3b82f6" />
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#a1a1a1')]}>
          Tracking
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle('#ffffff')]}>
          {props.elapsedTime}
        </Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle('#71717a')]}>
          elapsed
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#a1a1a1')]}>
          {props.projectName}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#71717a')]}>
          {props.title}
        </Text>
      </VStack>
    ),
  };
};

export default createLiveActivity('SessionActivity', SessionActivity);
