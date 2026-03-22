import { getAtmosphereColors } from '@/features/aurora/atmosphereColors'
import { useSettingsStore } from '@/features/settings/settings-store'

export type AuroraTheme = {
  card: string             // opaque container bg (cards, session rows)
  cardBorder: string       // container border
  chip: string             // small badge / pill bg
  modalSheet: string       // bottom sheet surface (matches aurora bg color)
  handle: string           // drag handle pill
  headerGradient: [string, string, string]  // 3-stop scrim for stats fixed header
  listGroupClassName: string  // appended to heroui-native ListGroup className
}

export function useAuroraTheme(): AuroraTheme {
  const auroraEnabled = useSettingsStore(s => s.auroraEnabled)

  if (!auroraEnabled) {
    return {
      card:               '#1a1a1c',
      cardBorder:         '#27272a',
      chip:               '#27272a',
      modalSheet:         '#18181b',
      handle:             '#3f3f46',
      headerGradient:     ['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)'],
      listGroupClassName: '',
    }
  }

  const c = getAtmosphereColors('calm')
  const [r, g, b] = c.background
  const rgb = `${r}, ${g}, ${b}`

  return {
    card:               'rgba(255,255,255,0.06)',
    cardBorder:         'rgba(255,255,255,0.10)',
    chip:               'rgba(255,255,255,0.08)',
    modalSheet:         `rgb(${rgb})`,
    handle:             'rgba(255,255,255,0.15)',
    headerGradient:     [`rgba(${rgb},0.85)`, `rgba(${rgb},0.4)`, `rgba(${rgb},0)`],
    listGroupClassName: 'bg-white/5 border-white/10',
  }
}
