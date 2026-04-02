import { TimerBar } from "@/features/timer/timer-bar";
import { SuggestionPopover } from "@/features/timer/suggestion-popover";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { View } from "react-native";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs minimizeBehavior="onScrollDown">
        <NativeTabs.BottomAccessory>
          <TimerBar />
        </NativeTabs.BottomAccessory>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="dashboard" />
          <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="timeline">
          <NativeTabs.Trigger.Icon sf="clock" md="schedule" />
          <NativeTabs.Trigger.Label>Timeline</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="stats">
          <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
          <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="search" role="search">
          <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        </NativeTabs.Trigger>
      </NativeTabs>
      <SuggestionPopover />
    </View>
  );
}
