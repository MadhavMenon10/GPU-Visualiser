export type BlockKind =
  | 'die'
  | 'compute'
  | 'cache'
  | 'memctl'
  | 'interconnect'
  | 'media'
  | 'frontend'
  | 'group'

export interface Block {
  id: string
  kind: BlockKind
  x: number
  y: number
  w: number
  h: number
  label?: string
  labelPos?: 'center' | 'tl'
  doc?: string
  disabled?: boolean
  children?: Block[]
}

export interface SpecRow {
  label: string
  value: string
}

export interface ComponentDoc {
  name: string
  type: string
  role: string
  specs: SpecRow[]
  pipeline: string
  programming?: string
}

export interface Gpu {
  id: string
  vendor: 'NVIDIA' | 'AMD' | 'Intel'
  name: string
  die: string
  arch: string
  isa: string
  process: string
  docs: Record<string, ComponentDoc>
  floorplan: () => Block
}
