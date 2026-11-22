import { nextSeed } from "./random";

export const boardWidth = 12;
export const boardHeight = 7;
export const salonItemCount = 5;
export const boardSize = boardWidth * boardHeight;
export const cellInputShift = 6;

export const salonItems = ["Tesoura", "Pente", "Pomada", "Navalha", "Pincel"] as const;

export function neighbors(a: number, b: number) {
  return Math.abs(a % boardWidth - b % boardWidth) +
    Math.abs(Math.floor(a / boardWidth) - Math.floor(b / boardWidth)) === 1;
}

function matches(board: number[], indices: number[]) {
  const found = new Set<number>();
  for (const index of indices) {
    for (const stride of [1, boardWidth]) {
      const aligned = (cell: number) => cell >= 0 && cell < boardSize &&
        (stride !== 1 || Math.floor(cell / boardWidth) === Math.floor(index / boardWidth));
      let start = index;
      let end = index;
      while (aligned(start - stride) && board[start - stride] === board[index]) start -= stride;
      while (aligned(end + stride) && board[end + stride] === board[index]) end += stride;
      if (end - start >= 2 * stride) {
        for (let cell = start; cell <= end; cell += stride) found.add(cell);
      }
    }
  }
  return found;
}

function swap(board: number[], a: number, b: number) {
  [board[a], board[b]] = [board[b], board[a]];
}

function canSwap(board: number[]) {
  return board.some((_, a) => [a + 1, a + boardWidth].some(b => {
    if (b >= boardSize || !neighbors(a, b) || board[a] === board[b]) return false;
    swap(board, a, b);
    const valid = matches(board, [a, b]).size > 0;
    swap(board, a, b);
    return valid;
  }));
}

export function createBoard(seed: number) {
  const board: number[] = [];
  for (let cell = 0; cell < boardSize; cell++) {
    seed = nextSeed(seed);
    let item = (seed >>> 12) % salonItemCount;
    while ((cell % boardWidth >= 2 && board[cell - 1] === item && board[cell - 2] === item) ||
      (cell >= boardWidth * 2 && board[cell - boardWidth] === item && board[cell - boardWidth * 2] === item)) {
      item = (item + 1) % salonItemCount;
    }
    board.push(item);
  }
  if (!canSwap(board)) {
    // Repeat a match-free pattern with a guaranteed neighboring swap.
    for (let cell = 0; cell < boardSize; cell++) board[cell] = (cell % boardWidth + Math.floor(cell / boardWidth)) % salonItemCount;
    board.splice(0, 3, 0, 1, 0);
    board[boardWidth + 1] = 0;
  }
  return board;
}

export function matchSwap(board: number[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= boardSize || to >= boardSize ||
      !neighbors(from, to) || board[from] === board[to]) return new Set<number>();
  swap(board, from, to);
  const matched = matches(board, [from, to]);
  if (!matched.size) swap(board, from, to);
  return matched;
}

export function settleBoard(board: number[], matched: Set<number>, seed: number) {
  let count = 0;
  while (matched.size) {
    count += matched.size;
    if (count >= boardSize) return { board: createBoard(seed), count };
    for (let x = 0; x < boardWidth; x++) {
      let write = boardHeight - 1;
      for (let y = boardHeight - 1; y >= 0; y--) {
        if (!matched.has(y * boardWidth + x)) board[write-- * boardWidth + x] = board[y * boardWidth + x];
      }
      while (write >= 0) {
        seed = nextSeed(seed);
        board[write-- * boardWidth + x] = (seed >>> 12) % salonItemCount;
      }
    }
    matched = matches(board, board.map((_, cell) => cell));
  }
  return { board: canSwap(board) ? board : createBoard(seed), count };
}
