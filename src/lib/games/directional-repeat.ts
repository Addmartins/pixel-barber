export type DirectionalRepeat = { direction: number; next: number };

export function repeatDirection(state: DirectionalRepeat, direction: number, tick: number, repeat: number) {
  if (direction < 0) {
    state.direction = -1;
    return false;
  }
  if (state.direction !== direction) {
    state.direction = direction;
    state.next = tick + 20;
    return true;
  }
  if (tick < state.next) return false;
  state.next = tick + repeat;
  return true;
}
