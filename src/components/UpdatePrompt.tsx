import { Button, Group, Notification, Text } from "@mantine/core";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Tells the user when the app is ready offline, and when a new version can be loaded. */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;
  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <Notification
      onClose={close}
      title={needRefresh ? "A new version is available" : "Ready to work offline"}
      style={{ position: "fixed", bottom: 16, left: 16, zIndex: 1000, maxWidth: 360 }}
      withBorder
    >
      {needRefresh ? (
        <Group justify="space-between" mt={4}>
          <Text size="sm">Reload to update. Your data is kept.</Text>
          <Button size="compact-sm" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        </Group>
      ) : (
        <Text size="sm">Budget is saved on this device and works without a connection.</Text>
      )}
    </Notification>
  );
}
