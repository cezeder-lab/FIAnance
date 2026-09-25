export type DropPosition = 'before' | 'after';

/** Moves the element `fromId` next to `toId`; the rest of the list keeps its relative order. */
export function moveById<T extends { id: string }>(list: T[], fromId: string, toId: string, position: DropPosition): T[] {
  if (fromId === toId) return list;
  const moved = list.find((x) => x.id === fromId);
  if (!moved) return list;
  const rest = list.filter((x) => x.id !== fromId);
  const index = rest.findIndex((x) => x.id === toId);
  if (index < 0) return list;
  rest.splice(position === 'before' ? index : index + 1, 0, moved);
  return rest;
}
