import { useState } from "react"

const entries = [
  ["compute", "COMPUTE"],
  ["cache", "CACHE / SRAM"],
  ["memctl", "MEMORY PHY"],
  ["interconnect", "INTERCONNECT / IO"],
  ["frontend", "FRONT END"],
  ["media", "FIXED FUNCTION"],
] as const

export function Legend() {
  const [open, setOpen] = useState(true)
  return (
    <div className="legend">
      <button className="legend-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="legend-caret">{open ? "▾" : "▸"}</span>
        <span>LEGEND</span>
      </button>
      {open && (
        <div className="legend-body">
          {entries.map(([kind, label]) => (
            <div key={kind} className="legend-row">
              <span className={`legend-swatch sw-${kind}`} />
              <span>{label}</span>
            </div>
          ))}
          <div className="legend-row">
            <span className="legend-swatch sw-fused" />
            <span>FUSED OFF</span>
          </div>
        </div>
      )}
    </div>
  )
}
