import { useEffect, useMemo, useRef, useState } from "react"
import { select } from "d3-selection"
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom"
import type { Block, Gpu } from "../types"
import { Legend } from "./Legend"

interface Props {
  gpu: Gpu
  root: Block
  selectedId: string | null
  onSelect: (b: Block | null) => void
  onHover: (b: Block | null) => void
}

function labelPos(b: Block): "center" | "tl" {
  return b.labelPos ?? (b.kind === "die" ? "tl" : "center")
}

function labelFont(b: Block): number {
  if (!b.label) return 0
  if (labelPos(b) === "tl") return Math.min(3, b.h * 0.6)
  const byW = (b.w - 1.2) / (b.label.length * 0.62)
  return Math.min(byW, b.h * 0.45, 7)
}

function buildPaths(root: Block): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (b: Block, prefix: string) => {
    const name = b.label || b.id.split("/").pop()!
    const path = prefix ? `${prefix} › ${name}` : name
    out.set(b.id, path)
    b.children?.forEach((c) => walk(c, path))
  }
  walk(root, "")
  return out
}

function BlockEl({
  b,
  k,
  hoverId,
  selectedId,
  onHover,
  onSelect,
}: {
  b: Block
  k: number
  hoverId: string | null
  selectedId: string | null
  onHover: (b: Block) => void
  onSelect: (b: Block) => void
}) {
  const fs = labelFont(b)
  const showLabel = !!b.label && fs * k >= 6
  const cls = [
    `blk-${b.kind}`,
    hoverId === b.id ? "hovered" : "",
    selectedId === b.id ? "selected" : "",
    b.disabled ? "fused" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <g transform={`translate(${b.x},${b.y})`}>
      <rect
        className={cls}
        width={b.w}
        height={b.h}
        vectorEffect="non-scaling-stroke"
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(b)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(b)
        }}
      />
      {b.disabled && <rect className="hatch" width={b.w} height={b.h} fill="url(#hatch)" />}
      {showLabel &&
        (labelPos(b) === "tl" ? (
          <text className="blk-label tl" x={1.1} y={fs + 1} fontSize={fs}>
            {b.label}
          </text>
        ) : (
          <text
            className="blk-label"
            x={b.w / 2}
            y={b.h / 2}
            fontSize={fs}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {b.label}
          </text>
        ))}
      {b.children?.map((c) => (
        <BlockEl
          key={c.id}
          b={c}
          k={k}
          hoverId={hoverId}
          selectedId={selectedId}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </g>
  )
}

export function DieView({ gpu, root, selectedId, onSelect, onHover }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>()
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const hoverBlock = (b: Block) => {
    setHoverId(b.id)
    onHover(b)
  }

  const hoverClear = () => {
    setHoverId(null)
    onHover(null)
  }

  const paths = useMemo(() => buildPaths(root), [root])

  // quantize zoom for label LOD so the tree only re-renders at thresholds
  const lodK = Math.pow(2, Math.round(Math.log2(transform.k) * 3) / 3)

  const fit = () => {
    const svg = svgRef.current
    const zb = zoomRef.current
    if (!svg || !zb) return
    const { width, height } = svg.getBoundingClientRect()
    const m = 28
    const k = Math.min((width - 2 * m) / root.w, (height - 2 * m) / root.h)
    const t = zoomIdentity.translate((width - root.w * k) / 2, (height - root.h * k) / 2).scale(k)
    select(svg).call(zb.transform, t)
  }

  useEffect(() => {
    const svg = svgRef.current!
    const zb = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 120])
      .clickDistance(5)
      .on("zoom", (e) => setTransform(e.transform))
    zoomRef.current = zb
    select(svg).call(zb)
    return () => {
      select(svg).on(".zoom", null)
    }
  }, [])

  useEffect(() => {
    zoomRef.current
      ?.translateExtent([
        [-root.w * 0.6, -root.h * 0.6],
        [root.w * 1.6, root.h * 1.6],
      ])
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect(null)
      if (e.key === "f" || e.key === "F") fit()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, onSelect])

  const tree = useMemo(
    () => (
      <BlockEl
        b={root}
        k={lodK}
        hoverId={hoverId}
        selectedId={selectedId}
        onHover={hoverBlock}
        onSelect={onSelect}
      />
    ),
    [root, lodK, hoverId, selectedId, onSelect],
  )

  const statusPath = (hoverId && paths.get(hoverId)) || (selectedId && paths.get(selectedId)) || root.label

  return (
    <div className="dieview" onPointerLeave={hoverClear}>
      <svg ref={svgRef} className="die-svg">
        <defs>
          <pattern id="hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="2.4" className="hatch-line" />
          </pattern>
        </defs>
        <g key={gpu.id} className="die-fade" transform={transform.toString()}>
          {tree}
        </g>
      </svg>
      <Legend />
      <div className="statusbar">
        <span className="status-path">{statusPath}</span>
        <span className="status-right">
          zoom {transform.k.toFixed(1)}× · drag pan · wheel zoom · hover read · click pin · F fit · ESC clear
        </span>
      </div>
    </div>
  )
}
