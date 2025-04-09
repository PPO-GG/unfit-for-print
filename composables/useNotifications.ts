import { useNotificationStore } from "~/stores/notificationStore";

export const useNotifications = () => {
  const store = useNotificationStore();

  const notify = (
    message: string,
    type: "info" | "success" | "error" = "info",
    options: Partial<Omit<Notification, "message" | "type" | "id">> = {}
  ) => {
    store.notify({ message, type, ...options });
  };

  return {
    notify,
    dismiss: store.dismiss,
    clearAll: store.clearAll,
    notifications: store.notifications,
  };
};
