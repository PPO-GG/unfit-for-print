type MenuHotkeyOptions = {
  create: () => void;
  join: () => void;
  games: () => void;
  labs: () => void;
  howToPlay: () => void;
  canCreate: () => boolean;
  canJoin: () => boolean;
  isJoinOpen: () => boolean;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function createMenuHotkeyHandler(options: MenuHotkeyOptions) {
  return (event: KeyboardEvent) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      options.isJoinOpen() ||
      isTypingTarget(event.target)
    ) {
      return;
    }

    const actions: Record<string, (() => void) | undefined> = {
      n: options.canCreate() ? options.create : undefined,
      j: options.canJoin() ? options.join : undefined,
      g: options.games,
      l: options.labs,
      "?": options.howToPlay,
    };
    const action = actions[event.key.toLowerCase()];

    if (!action) return;

    event.preventDefault();
    action();
  };
}
