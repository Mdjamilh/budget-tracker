import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Tells the user when the app is ready offline, and when a new version can
 * be loaded. Uses the shared notification stack so these never cover other
 * messages (such as "Undo") on small screens.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    notifications.show({ title: "Ready to work offline", message: "Budget is saved on this device and works without a connection." });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    notifications.show({
      id: "update",
      title: "A new version is available",
      autoClose: false,
      message: (
        <Group justify="space-between" mt={4}>
          <Text size="sm">Reload to update. Your data is kept.</Text>
          <Button size="compact-sm" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        </Group>
      ),
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
