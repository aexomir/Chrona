import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`overflow-hidden rounded-[20px] border-[0.5px] border-white/10 ${className ?? ""}`}
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
