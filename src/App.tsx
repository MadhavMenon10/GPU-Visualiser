import { useMemo, useState } from "react"
import { gpus } from "./gpus"
import type { Block } from "./types"
import { Sidebar } from "./components/Sidebar"
import { DieView } from "./components/DieView"
import { DetailPanel } from "./components/DetailPanel"

export default function App() {
  const [gpuId, setGpuId] = useState(gpus[0].id)
  const [selected, setSelected] = useState<Block | null>(null)
  const [hovered, setHovered] = useState<Block | null>(null)

  const gpu = gpus.find((g) => g.id === gpuId)!
  const root = useMemo(() => gpu.floorplan(), [gpu])

  const pick = (id: string) => {
    setGpuId(id)
    setSelected(null)
    setHovered(null)
  }

  const shown = hovered ?? selected
  const docKey = shown?.doc ?? "die"
  const doc = gpu.docs[docKey] ?? gpu.docs.die

  return (
    <div className="app">
      <Sidebar gpus={gpus} currentId={gpuId} onPick={pick} />
      <DieView
        gpu={gpu}
        root={root}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        onHover={setHovered}
      />
      <DetailPanel gpu={gpu} doc={doc} isOverview={docKey === "die"} onClear={() => setSelected(null)} />
    </div>
  )
}
