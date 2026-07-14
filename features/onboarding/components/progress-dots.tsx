import { StyleSheet, View } from "react-native";

export function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <View className="flex-row gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 18,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  dotInactive: {
    width: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
});
