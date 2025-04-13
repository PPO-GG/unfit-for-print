// composables/useNotifications.ts

import { useToast } from '#imports'

/**
 * Type definition for the possible toast notification types.
 * These types determine the color and style of the toast.
 */
type ToastType = 'info' | 'success' | 'error' | 'warning' | 'neutral' | 'primary' | 'secondary'

/**
 * Interface defining the options for a toast notification.
 */
interface ToastOptions {
  /** The title of the toast notification. */
  title: string
  /** Optional description providing additional details about the notification. */
  description?: string
  /** The color/type of the toast (e.g., 'info', 'success'). Defaults to 'info'. */
  color?: ToastType
  /** Optional icon to display in the toast. */
  icon?: string
  /** Optional avatar to display in the toast. */
  avatar?: any
  /** Duration (in milliseconds) for which the toast is displayed. */
  duration?: number
  /** Orientation of the toast ('horizontal' or 'vertical'). Defaults to 'vertical'. */
  orientation?: 'horizontal' | 'vertical'
  /** Whether the toast can be closed. Can be a boolean or an object for advanced options. */
  close?: boolean | object
  /** Optional actions (e.g., buttons) to include in the toast. */
  actions?: { label: string; click: () => void }[]
}

/**
 * Composable function to manage toast notifications.
 * Provides a `notify` function to display toast notifications with customizable options.
 */
export const useNotifications = () => {
  // Access the toast functionality from the imported `useToast` composable.
  const toast = useToast()

  /**
   * Displays a toast notification with the specified options.
   *
   * @param {ToastOptions} options - The configuration options for the toast notification.
   */
  const notify = ({
                    title,
                    description,
                    color = 'info',
                    icon,
                    avatar,
                    duration,
                    orientation = 'vertical',
                    close = true,
                    actions
                  }: ToastOptions) => {
    toast.add({
      title,
      description,
      color,
      icon,
      avatar,
      duration,
      orientation,
      close,
      actions
    })
  }

  // Return the `notify` function for use in other parts of the application.
  return {
    notify
  }
}