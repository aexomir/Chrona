import { Image } from "expo-image";
import { Pressable, StyleSheet, Text } from "react-native";

export function ContinueLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5">
      <Text style={styles.text}>Continue</Text>
      <Image
        source="sf:arrow.right"
        style={styles.icon}
        tintColor="rgba(255,255,255,0.4)"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    letterSpacing: 0.1,
  },
  icon: {
    width: 12,
    height: 12,
  },
});
