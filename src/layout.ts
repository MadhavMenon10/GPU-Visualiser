import type { Block, BlockKind } from './types'

export function blk(
  id: string,
  kind: BlockKind,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<Block> = {},
): Block {
  return { id, kind, x, y, w, h, ...extra }
}

export interface Cell {
  i: number
  col: number
  row: number
  x: number
  y: number
  w: number
  h: number
}

export function tile(
  count: number,
  cols: number,
  x: number,
  y: number,
  w: number,
  h: number,
  gap = 0.8,
): Cell[] {
  const rows = Math.ceil(count / cols)
  const cw = (w - gap * (cols - 1)) / cols
  const ch = (h - gap * (rows - 1)) / rows
  const cells: Cell[] = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    cells.push({
      i,
      col,
      row,
      x: x + col * (cw + gap),
      y: y + row * (ch + gap),
      w: cw,
      h: ch,
    })
  }
  return cells
}

export function vstack(count: number, x: number, y: number, w: number, h: number, gap = 0.8): Cell[] {
  return tile(count, 1, x, y, w, h, gap)
}

export function hstack(count: number, x: number, y: number, w: number, h: number, gap = 0.8): Cell[] {
  return tile(count, count, x, y, w, h, gap)
}
