const entries = [
  ["compute", "COMPUTE"],
  ["cache", "CACHE / SRAM"],
  ["memctl", "MEMORY PHY"],
  ["interconnect", "INTERCONNECT / IO"],
  ["frontend", "FRONT END"],
  ["media", "FIXED FUNCTION"],
] as const

export function Legend() {
  return (
    <div className="legend">
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
  )
}
