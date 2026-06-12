import type { ComponentDoc, Gpu } from "../types"

interface Props {
  gpu: Gpu
  doc: ComponentDoc
  isOverview: boolean
  onClear: () => void
}

export function DetailPanel({ gpu, doc, isOverview, onClear }: Props) {
  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="panel-crumb">
          <span>{gpu.name}</span>
          <span className="crumb-sep">/</span>
          <span>{doc.type.toUpperCase()}</span>
        </div>
        <h2 className="panel-title">{doc.name}</h2>
        {!isOverview && (
          <button className="panel-clear" onClick={onClear}>
            ← die overview
          </button>
        )}
      </div>

      <section className="panel-sec">
        <h3 className="sec-head">FUNCTION</h3>
        <p className="sec-prose">{doc.role}</p>
      </section>

      <section className="panel-sec">
        <h3 className="sec-head">SPECIFICATIONS</h3>
        <table className="spec-table">
          <tbody>
            {doc.specs.map((s) => (
              <tr key={s.label}>
                <td className="spec-label">{s.label}</td>
                <td className="spec-value">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel-sec">
        <h3 className="sec-head">PIPELINE POSITION</h3>
        <p className="sec-prose">{doc.pipeline}</p>
      </section>

      {doc.programming && (
        <section className="panel-sec">
          <h3 className="sec-head">PROGRAMMING MODEL</h3>
          <p className="sec-prose prog">{doc.programming}</p>
        </section>
      )}
    </aside>
  )
}
