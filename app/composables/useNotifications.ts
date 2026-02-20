// composables/useNotifications.ts

import { useToast } from "#imports";

/**
 * Type definition for the possible toast notification types.
 * These types determine the color and style of the toast.
 */
type ToastType =
  | "info"
  | "success"
  | "error"
  | "warning"
  | "neutral"
  | "primary"
  | "secondary";

/**
 * Interface defining the options for a toast notification.
 */
interface ToastOptions {
  /** The title of the toast notification. */
  title: string;
  /** Optional description providing additional details about the notification. */
  description?: string;
  /** The color/type of the toast (e.g., 'info', 'success'). Defaults to 'info'. */
  color?: ToastType;
  /** Optional icon to display in the toast. */
  icon?: string;
  /** Optional avatar to display in the toast. */
  avatar?: any;
  /** Duration (in milliseconds) for which the toast is displayed. Defaults to 5000. */
  duration?: number;
  /** Orientation of the toast ('horizontal' or 'vertical'). Defaults to 'vertical'. */
  orientation?: "horizontal" | "vertical";
  /** Whether the toast can be closed. Can be a boolean or an object for advanced options. */
  close?: boolean | object;
  /** Optional actions (e.g., buttons) to include in the toast. */
  actions?: { label: string; click: () => void }[];
}

/** Dedup window in ms — identical toasts within this window are suppressed. */
const DEDUP_WINDOW_MS = 2000;

/**
 * Composable function to manage toast notifications.
 * Provides a `notify` function to display toast notifications with customizable options.
 * Includes deduplication to prevent identical toasts from stacking and
 * a default auto-dismiss duration.
 */
export const useNotifications = () => {
  // Access the toast functionality from the imported `useToast` composable.
  const toast = useToast();

  // Track recent notifications to prevent rapid-fire duplicates
  const recentNotifications = new Map<string, number>();

  /**
   * Displays a toast notification with the specified options.
   * Deduplicates identical notifications within a 2-second window.
   *
   * @param {ToastOptions} options - The configuration options for the toast notification.
   */
  const notify = ({
    title,
    description,
    color = "info",
    icon,
    avatar,
    duration = 5000,
    orientation = "vertical",
    close = true,
    actions,
  }: ToastOptions) => {
    // Create a dedup key from the notification content
    const dedupKey = `${title}:${description || ""}:${color}`;
    const now = Date.now();
    const lastSeen = recentNotifications.get(dedupKey);

    // Suppress if an identical notification was shown recently
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return;
    }

    recentNotifications.set(dedupKey, now);

    // Prune old entries to prevent memory leaks
    if (recentNotifications.size > 50) {
      for (const [key, timestamp] of recentNotifications.entries()) {
        if (now - timestamp > DEDUP_WINDOW_MS) {
          recentNotifications.delete(key);
        }
      }
    }

    toast.add({
      title,
      description,
      color,
      icon,
      avatar,
      duration,
      orientation,
      close,
      actions,
    });
  };

  // Return the `notify` function for use in other parts of the application.
  return {
    notify,
  };
};
