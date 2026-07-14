import { AppReviewView } from "@/components/app-review-view";
import { usePendingReviewStore } from "@/features/auto-track/pending-review-store";
import { BottomSheet } from "heroui-native";

export function AppReviewSheet() {
  const pending = usePendingReviewStore((s) => s.queue[0] ?? null);
  const confirm = usePendingReviewStore((s) => s.confirm);
  const skip = usePendingReviewStore((s) => s.skip);

  return (
    <BottomSheet isOpen={pending !== null}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay isCloseOnPress={false} />
        <BottomSheet.Content
          enablePanDownToClose={false}
          backgroundStyle={{ backgroundColor: "#18181b" }}
        >
          {pending && (
            <AppReviewView
              apps={pending.apps}
              sessionTitle={pending.title}
              sessionProjectId={pending.projectId}
              onConfirm={confirm}
              onSkip={skip}
            />
          )}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
