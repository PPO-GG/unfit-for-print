/** Whether every selected item agrees on a field — drives "Mixed" in bulk forms. */
export type Shared<T> = { state: "same"; value: T } | { state: "mixed" } | { state: "empty" };

export function sharedValue<I, T>(items: I[], get: (item: I) => T): Shared<T> {
  if (!items.length) return { state: "empty" };
  const first = get(items[0]!);
  for (const item of items) {
    if (get(item) !== first) return { state: "mixed" };
  }
  return { state: "same", value: first };
}
