import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";

export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          overflow: "hidden",
          borderRadius: 20,
          borderWidth: 0.5,
          borderColor: "rgba(255,255,255,0.10)",
        },
        style,
      ]}
    >
      <BlurView
        intensity={55}
        tint="systemUltraThinMaterialDark"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
