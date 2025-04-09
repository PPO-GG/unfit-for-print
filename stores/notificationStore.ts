import { defineStore } from "pinia";

let idCounter = 0;

export interface Notification {
  id: number;
  message: string;
  type?: "info" | "success" | "error";
  duration?: number;
  icon?: string;
  dismissible?: boolean;
}

export const useNotificationStore = defineStore("notification", {
  state: () => ({
    notifications: [] as Notification[],
  }),

  actions: {
    notify(options: Omit<Notification, "id">) {
      const safeOptions = { ...options } as Omit<Notification, "id">;
      const id = idCounter++;
      const notification: Notification = { id, ...safeOptions };
      this.notifications.push(notification);
    
      if (notification.duration !== 0) {
        setTimeout(() => this.dismiss(id), notification.duration ?? 5000);
      }
    },

    dismiss(id: number) {
      this.notifications = this.notifications.filter(n => n.id !== id);
    },

    clearAll() {
      this.notifications = [];
    },
  },
});
