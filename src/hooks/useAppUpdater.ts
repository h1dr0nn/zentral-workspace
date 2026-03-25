import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

async function checkForUpdates() {
  try {
    const update = await check();
    if (!update) return;

    toast.info(`Update v${update.version} available`, {
      action: {
        label: "Install",
        onClick: async () => {
          const toastId = toast.loading("Downloading update...");
          try {
            await update.downloadAndInstall();
            toast.dismiss(toastId);
            toast.success("Update installed. Restarting...");
            await relaunch();
          } catch (err) {
            toast.dismiss(toastId);
            toast.error(`Update failed: ${err}`);
          }
        },
      },
      duration: Infinity,
    });
  } catch (err) {
    // Silently fail — don't bother user if update check fails
    console.error("Update check failed:", err);
  }
}

export function useAppUpdater() {
  useEffect(() => {
    // Check for updates 3 seconds after app launch
    const timer = setTimeout(checkForUpdates, 3000);
    return () => clearTimeout(timer);
  }, []);
}
