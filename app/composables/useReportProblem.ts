/**
 * Shared open/close state for the "Report a Problem" modal.
 *
 * The two entry points sit in different component trees — the in-game ESC
 * menu (`GameEscMenu.vue`) and the app-wide header (`AppHeader.vue`) — so the
 * flag has to be global rather than prop-drilled through either. Mirrors
 * `useConfirm`, which solves the same problem for the confirm dialog, and the
 * modal itself is mounted once in `app.vue` alongside it.
 */
export function useReportProblem() {
  const isOpen = useState("report-problem-open", () => false);

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  return { isOpen, open, close };
}

export default useReportProblem;
