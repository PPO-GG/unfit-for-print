/**
 * Shared open-state for the BrandSettingsDrawer.
 *
 * Any brand-page component can call `useBrandSettings()` and mutate
 * `open` to show/hide the drawer. The drawer itself is mounted once
 * inside BrandTopBar (which lives on every brand page).
 *
 * Using Nuxt's `useState` makes the ref safe under SSR and keeps the
 * state keyed to `"brand-settings-open"` so HMR and route changes
 * don't spawn duplicate stores.
 */
export function useBrandSettings() {
  const open = useState<boolean>("brand-settings-open", () => false);

  function openDrawer() { open.value = true; }
  function closeDrawer() { open.value = false; }
  function toggleDrawer() { open.value = !open.value; }

  return { open, openDrawer, closeDrawer, toggleDrawer };
}
