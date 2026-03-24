import { Image } from "expo-image";
import { Toast, useToast } from "heroui-native";
import { View } from "react-native";

type Variant = "success" | "warning" | "danger" | "default";

const ICONS: Record<Variant, { source: string; color: string } | null> = {
  success: { source: "sf:checkmark.circle.fill", color: "#10b981" },
  warning: { source: "sf:exclamationmark.triangle.fill", color: "#f59e0b" },
  danger: { source: "sf:xmark.circle.fill", color: "#ef4444" },
  default: null,
};

const DEFAULT_DURATION: Record<Variant, number> = {
  success: 2000,
  warning: 3000,
  danger: 3000,
  default: 2000,
};

const glassStyle = {
  backgroundColor: "rgba(20, 20, 24, 0.93)",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.08)",
  borderRadius: 14,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.28,
  shadowRadius: 10,
  elevation: 8,
};

type AppToastProps = {
  label: string;
  variant: Variant;
  withClose: boolean;
  [key: string]: unknown;
};

function AppToastComponent({ label, variant, withClose, ...props }: AppToastProps) {
  const icon = ICONS[variant];

  return (
    <Toast {...props} placement="top" style={glassStyle}>
      <View className="flex-row items-center gap-2.5 px-3.5 py-2.5">
        {icon && (
          <Image
            source={icon.source}
            style={{ width: 15, height: 15, tintColor: icon.color }}
          />
        )}
        <Toast.Title className="text-white/90 text-sm font-medium flex-1 tracking-tight">
          {label}
        </Toast.Title>
        {withClose && (
          <Toast.Close
            className="ml-1"
            iconProps={{ size: 11, color: "rgba(255,255,255,0.35)" }}
          />
        )}
      </View>
    </Toast>
  );
}

export function useAppToast() {
  const { toast } = useToast();

  return {
    show(options: { label: string; variant?: Variant; duration?: number }) {
      const variant = options.variant ?? "default";
      const withClose = variant === "warning" || variant === "danger";
      const duration = options.duration ?? DEFAULT_DURATION[variant];

      toast.show({
        duration,
        component: (props) => (
          <AppToastComponent
            {...props}
            label={options.label}
            variant={variant}
            withClose={withClose}
          />
        ),
      });
    },
  };
}
