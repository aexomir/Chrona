import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";

export interface AnimatedHeaderScrollViewProps {
  title: string;
  subtitle?: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  children: React.ReactNode;
  contentContainerStyle?: object;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  shadowGradientContainer: {
    ...StyleSheet.absoluteFill,
    height: 1,
    pointerEvents: "none",
  },
  compactHeaderContainer: {
    height: 56,
    paddingHorizontal: 16,
    pointerEvents: "auto",
  },
  compactTitleWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  compactTitleCenter: {
    alignItems: "center",
  },
  compactTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  compactSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
  },
  largeHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  largeHeaderContent: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    minHeight: 60,
  },
  largeComponentSlot: {
    marginHorizontal: 12,
    pointerEvents: "auto",
  },
  largeComponentLeft: {
    marginRight: 12,
  },
  largeComponentRight: {
    marginLeft: 12,
  },
  largeTitle: {
    flex: 1,
  },
  gradientContent: {
    flex: 1,
    height: 20,
  },
});

/**
 * iOS-style animated header that collapses while scrolling.
 * Large title at top fades into compact header as user scrolls.
 */
export function AnimatedHeaderScrollView({
  title,
  subtitle,
  leftComponent,
  rightComponent,
  children,
  contentContainerStyle,
}: AnimatedHeaderScrollViewProps) {
  const insets = useSafeAreaInsets();
  const theme = useAuroraTheme();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Compact header (reveals as you scroll)
  const compactAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [15, 45], [0, 1], Extrapolation.CLAMP),
  }));

  // Large header (fades out as you scroll)
  const largeAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 30], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 60],
          [0, -20],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Shadow gradient opacity
  const shadowAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 40],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const headerHeight = insets.top + 56;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingVertical: headerHeight,
          ...contentContainerStyle,
        }}
        onScroll={scrollHandler}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {children}
      </Animated.ScrollView>

      {/* Fixed header — rendered above scroll area */}
      <View
        style={[styles.fixedHeader, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        {/* Scroll shadow gradient */}
        <Animated.View style={[styles.shadowGradientContainer, shadowAnimStyle]}>
          <LinearGradient
            colors={theme.headerGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradientContent}
          />
        </Animated.View>

        <View style={styles.compactHeaderContainer}>
          {/* Compact title (hidden initially) */}
          <Animated.View
            style={[styles.compactTitleWrapper, compactAnimStyle]}
            pointerEvents="none"
          >
            <View style={styles.compactTitleCenter}>
              <Text style={styles.compactTitle}>{title}</Text>
              {subtitle && (
                <Text style={styles.compactSubtitle}>{subtitle}</Text>
              )}
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Large title area — fades out as you scroll */}
      <View
        style={[styles.largeHeader, { paddingTop: insets.top + 16 }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[styles.largeHeaderContent, largeAnimStyle]}
          pointerEvents="none"
        >
          {leftComponent && (
            <View style={[styles.largeComponentSlot, styles.largeComponentLeft]}>
              {leftComponent}
            </View>
          )}
          <View style={styles.largeTitle}>
            <Text className="text-white text-4xl font-bold">{title}</Text>
            {subtitle && (
              <Text className="text-zinc-500 text-sm mt-1">{subtitle}</Text>
            )}
          </View>
          {rightComponent && (
            <View
              style={[styles.largeComponentSlot, styles.largeComponentRight]}
            >
              {rightComponent}
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
