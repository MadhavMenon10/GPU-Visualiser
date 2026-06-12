import type { Gpu } from "../types"

interface Props {
  gpus: Gpu[]
  currentId: string
  onPick: (id: string) => void
}

export function Sidebar({ gpus, currentId, onPick }: Props) {
  const vendors = [...new Set(gpus.map((g) => g.vendor))]
  return (
    <nav className="sidebar">
      <div className="sidebar-head">
        <h1 className="app-title">GPU VISUALISER</h1>
        <p className="app-sub">architecture floorplans</p>
      </div>
      {vendors.map((v) => (
        <div key={v} className="vendor-group">
          <div className="vendor-head">{v}</div>
          {gpus
            .filter((g) => g.vendor === v)
            .map((g) => (
              <button
                key={g.id}
                className={`gpu-row${g.id === currentId ? " active" : ""}`}
                onClick={() => onPick(g.id)}
              >
                <span className="gpu-name">{g.name}</span>
                <span className="gpu-meta">
                  {g.die} · {g.arch} · {g.isa}
                </span>
              </button>
            ))}
        </div>
      ))}
      <div className="sidebar-foot">
        data: vendor architecture
        <br />
        whitepapers · layouts schematic
      </div>
    </nav>
  )
}
