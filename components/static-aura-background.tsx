import { getAtmosphereColors } from "@/lib/atmosphereColors"
import { useSettingsStore } from "@/stores/settings-store"
import { LinearGradient } from "expo-linear-gradient"
import { StyleSheet } from "react-native"

export function StaticAuraBackground() {
  const auroraEnabled = useSettingsStore(s => s.auroraEnabled)
  if (!auroraEnabled) return null

  const c = getAtmosphereColors('calm')
  const bg = `rgba(${c.background[0]}, ${c.background[1]}, ${c.background[2]}, 1)`
  const mid = `rgba(${c.auroraLow[0]}, ${c.auroraLow[1]}, ${c.auroraLow[2]}, ${(c.auroraLow[3] / 255 * 0.5).toFixed(2)})`

  return (
    <LinearGradient
      colors={[mid, bg, bg]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 0.7 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  )
}
