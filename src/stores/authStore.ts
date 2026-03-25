import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
  orgName?: string;
}

interface AuthStore {
  loggedIn: boolean;
  email: string;
  subscriptionType: string;
  checking: boolean;
  loggingIn: boolean;

  checkStatus: () => Promise<void>;
  startLogin: () => Promise<void>;
  logout: () => Promise<void>;
  stopPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  loggedIn: false,
  email: "",
  subscriptionType: "",
  checking: true,
  loggingIn: false,

  checkStatus: async () => {
    try {
      set({ checking: true });
      const status = await invoke<AuthStatus>("check_auth_status");
      set({
        loggedIn: status.loggedIn,
        email: status.email ?? "",
        subscriptionType: status.subscriptionType ?? "",
        checking: false,
      });
      // Stop polling if login succeeded
      if (status.loggedIn && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        set({ loggingIn: false });
      }
    } catch {
      set({ loggedIn: false, checking: false });
    }
  },

  startLogin: async () => {
    try {
      set({ loggingIn: true });
      await invoke("start_login");
      // Poll auth status every 2s until logged in
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        get().checkStatus();
      }, 2000);
    } catch {
      set({ loggingIn: false });
    }
  },

  logout: async () => {
    try {
      await invoke("logout");
      set({ loggedIn: false, email: "", subscriptionType: "" });
    } catch {
      // ignore
    }
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ loggingIn: false });
  },
}));
