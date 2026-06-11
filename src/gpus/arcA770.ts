import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 276
const H = 224

function xeCore(id: string, x: number, y: number, w: number, h: number): Block {
  const g = blk(id, "group", x, y, w, h, { doc: "xecore", children: [] })
  g.children!.push(blk(`${id}/xve`, "compute", 1, 1, w - 2, 10.5, { label: "16× XVE", doc: "xve" }))
  g.children!.push(blk(`${id}/xmx`, "compute", 1, 12.5, w - 2, 10.5, { label: "16× XMX", doc: "xmx" }))
  g.children!.push(blk(`${id}/l1`, "cache", 1, 24, w - 14, 3.6, { label: "L1/SLM 192K", doc: "l1" }))
  g.children!.push(blk(`${id}/rtu`, "frontend", w - 12.4, 24, 5.6, 3.6, { label: "RTU", doc: "rtu" }))
  g.children!.push(blk(`${id}/smp`, "media", w - 6.2, 24, 5.2, 3.6, { label: "TEX", doc: "smp" }))
  return g
}

function slice(i: number, x: number, y: number, w: number, h: number): Block {
  const g = blk(`slice${i}`, "group", x, y, w, h, {
    label: `SLICE${i}`,
    labelPos: "tl",
    doc: "slice",
    children: [],
  })
  g.children!.push(blk(`slice${i}/geo`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "GEOMETRY · RASTER · HiZ", doc: "raster" }))
  tile(4, 2, 1.5, 11, w - 3, 58, 1.2).forEach((c) => {
    g.children!.push(xeCore(`slice${i}/xc${c.i}`, c.x, c.y, c.w, c.h))
  })
  g.children!.push(blk(`slice${i}/pb`, "frontend", 1.5, 70.5, w - 3, 4.5, { label: "PIXEL BACKEND · 16 ROP", doc: "pixbe" }))
  return g
}

function floorplan(): Block {
  const kids: Block[] = []

  kids.push(blk("front", "frontend", 20, 3, 84, 11, { label: "COMMAND STREAMER · DISPATCH", doc: "front" }))
  kids.push(blk("media", "media", 106, 3, 60, 11, { label: "MEDIA · 2× MFX (AV1)", doc: "media" }))
  kids.push(blk("display", "media", 168, 3, 60, 11, { label: "DISPLAY · 4 PIPES", doc: "display" }))
  kids.push(blk("pcie", "interconnect", 230, 3, 26, 11, { label: "PCIe ×16", doc: "pcie" }))

  vstack(2, 3, 16, 14, 190, 3).forEach((c) => {
    kids.push(blk(`gddr-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6", doc: "mem" }))
  })
  vstack(2, W - 17, 16, 14, 190, 3).forEach((c) => {
    kids.push(blk(`gddr-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6", doc: "mem" }))
  })

  tile(4, 4, 20, 16, 236, 80, 2).forEach((c) => kids.push(slice(c.i, c.x, c.y, c.w, c.h)))
  tile(4, 4, 20, 126, 236, 80, 2).forEach((c) => kids.push(slice(c.i + 4, c.x, c.y, c.w, c.h)))

  const l2 = blk("l2", "cache", 20, 98.5, 236, 25, {
    label: "L2 CACHE · 16 MB · MEMORY FABRIC",
    labelPos: "tl",
    doc: "l2",
    children: [],
  })
  hstack(8, 1.5, 6.5, 233, 17, 1).forEach((c) => {
    l2.children!.push(blk(`l2/${c.i}`, "cache", c.x, c.y, c.w, c.h, { doc: "l2" }))
  })
  kids.push(l2)

  hstack(4, 20, 209, 236, 12, 3).forEach((c) => {
    kids.push(blk(`gddr-b${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "GDDR6 PHY 32-bit", doc: "mem" }))
  })

  return blk("die", "die", 0, 0, W, H, { label: "ACM-G10", doc: "die", children: kids })
}

export const arcA770: Gpu = {
  id: "a770",
  vendor: "Intel",
  name: "Arc A770 16GB",
  die: "ACM-G10",
  arch: "Xe-HPG (Alchemist)",
  isa: "Xe-HPG / DG2-512",
  process: "TSMC N6",
  floorplan,
  docs: {
    die: {
      name: "ACM-G10 (Arc A770)",
      type: "Die overview",
      role: "Intel's first full-size discrete gaming die: 406 mm² on TSMC N6 with 21.7 billion transistors. Eight render slices of four Xe-cores each give 32 Xe-cores, and unusually for the class every unit ships enabled on the A770. Matrix engines (XMX) in every Xe-core power XeSS upscaling. Floorplan is schematic; proportions approximate.",
      specs: [
        { label: "Process", value: "TSMC N6" },
        { label: "Transistors", value: "21.7 B" },
        { label: "Die size", value: "406 mm²" },
        { label: "Render slices", value: "8" },
        { label: "Xe-cores", value: "32" },
        { label: "XVE (vector)", value: "512 · 4096 FP32 lanes" },
        { label: "XMX (matrix)", value: "512" },
        { label: "Ray tracing units", value: "32" },
        { label: "L2 cache", value: "16 MB" },
        { label: "Memory", value: "16 GB GDDR6, 256-bit, 17.5 Gbps" },
        { label: "Mem bandwidth", value: "560 GB/s" },
        { label: "Graphics clock", value: "2.1 GHz" },
        { label: "FP32", value: "17.2 TFLOPS" },
        { label: "XMX INT8", value: "~138 TOPS" },
        { label: "ROPs", value: "128" },
        { label: "TBP", value: "225 W" },
      ],
      pipeline: "Command streamer dispatches to render slices; Xe-core memory traffic flows L1/SLM → 16 MB L2 via the memory fabric → GDDR6 controllers on three die edges.",
      programming: "Programmed through oneAPI: SYCL kernels via Level Zero, or OpenCL/Vulkan/DX12. There is no fixed ISA version scheme like sm_xx; code JITs from SPIR-V per driver.",
    },
    front: {
      name: "Command streamer + global dispatch",
      type: "Front end",
      role: "Decodes command buffers and dispatches 3D and compute work to the render slices; the global thread dispatcher load-balances thread groups across Xe-cores.",
      specs: [{ label: "Scheduling unit", value: "thread group / draw" }],
      pipeline: "All submitted work enters here.",
      programming: "SYCL queues and Level Zero command lists are consumed by this block.",
    },
    slice: {
      name: "Render slice",
      type: "Compute cluster",
      role: "Intel's cluster unit: four Xe-cores plus the slice-level graphics hardware (geometry pipeline, rasterizer, HiZ and a 16-ROP pixel backend). Analogous to an NVIDIA GPC or AMD shader engine.",
      specs: [
        { label: "Count", value: "8" },
        { label: "Xe-cores per slice", value: "4" },
        { label: "RT units per slice", value: "4" },
        { label: "ROPs per slice", value: "16" },
      ],
      pipeline: "Receives draws/dispatches from the front end; rasterizes and shades locally, blends in its pixel backend.",
    },
    xecore: {
      name: "Xe-core",
      type: "Compute unit",
      role: 'The Xe-HPG compute building block: 16 vector engines and 16 matrix engines sharing a 192 KB L1/SLM and a thread dispatcher. Replaced the old "EU" organization (one Xe-core = 16 former EUs, one per XVE) and is the unit Intel counts cores by.',
      specs: [
        { label: "Count", value: "32" },
        { label: "XVE per core", value: "16" },
        { label: "XMX per core", value: "16" },
        { label: "L1/SLM", value: "192 KB (configurable split)" },
        { label: "FP32 lanes", value: "128" },
      ],
      pipeline: "Thread groups land here from global dispatch; vector and matrix instructions issue to XVE/XMX pipes, memory ops hit L1/SLM then L2.",
      programming: "A SYCL work-group maps to one Xe-core; sub-groups of 8/16/32 map to XVE SIMD lanes. SLM (work-group local memory) lives in the L1 carveout.",
    },
    xve: {
      name: "XVE (Xe Vector Engine)",
      type: "Execution unit",
      role: "256-bit vector ALU executing 8 FP32 or 16 FP16 operations per clock (32 INT8 with DP4A), with co-issued extended-math and INT pipes. Sixteen per Xe-core; each XVE keeps multiple hardware threads in flight to hide latency.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP32 per clock", value: "8 per XVE" },
        { label: "HW threads", value: "8 per XVE" }, // approx
      ],
      pipeline: "The scalar/vector math workhorse for shaders and SYCL kernels.",
      programming: "A sub-group of 8 maps to one XVE issue; FP64 is absent on Alchemist, so doubles emulate slowly or fail at JIT.",
    },
    xmx: {
      name: "XMX (Xe Matrix Extensions engine)",
      type: "Execution unit",
      role: "1024-bit systolic array per engine computing matrix dot products: 64 FP16/BF16 or 128 INT8 ops per clock, 8× the DP4A path. The inference muscle behind XeSS upscaling, and unusual hardware to find in a mid-range gaming die in 2022.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP16 throughput", value: "~69 TFLOPS total" },
        { label: "INT8 throughput", value: "~138 TOPS total" },
      ],
      pipeline: "Shares operand bandwidth with the XVEs; fed from registers/SLM.",
      programming: "Reached via SYCL joint_matrix, oneDNN, or DirectML metacommands; XeSS uses it directly on Arc.",
    },
    l1: {
      name: "L1 / shared local memory",
      type: "Cache",
      role: "192 KB per Xe-core, software-configurable between L1 cache and shared local memory for thread groups on that core.",
      specs: [
        { label: "Size", value: "192 KB per Xe-core" },
        { label: "SLM", value: "carveout, work-group scoped" },
      ],
      pipeline: "First memory level; misses go to the 16 MB L2.",
    },
    rtu: {
      name: "RTU (Ray Tracing Unit)",
      type: "Fixed function",
      role: "One per Xe-core: fixed-function BVH traversal and triangle intersection, plus a thread-sorting unit that regroups divergent ray-hit shading for SIMD coherence, the same problem NVIDIA's SER attacks on Ada.",
      specs: [
        { label: "Count", value: "32" },
        { label: "Traversal", value: "HW BVH + thread sorting" },
      ],
      pipeline: "Ray queries dispatched from shaders; returns hits to (re-sorted) shading threads.",
    },
    smp: {
      name: "Sampler (TMU)",
      type: "Fixed function",
      role: "Texture sampling and filtering co-located with each Xe-core; 256 texture units across the die.",
      specs: [{ label: "Count", value: "256 (8 per Xe-core)" }],
      pipeline: "Between shader texture requests and the cache hierarchy.",
    },
    raster: {
      name: "Geometry + rasterizer",
      type: "Graphics fixed function",
      role: "Per-slice geometry pipeline (vertex fetch, tessellation, culling) and rasterizer with hierarchical-Z rejection.",
      specs: [{ label: "Rasterizers", value: "8 (1 per slice)" }],
      pipeline: "Feeds fragments to the slice's Xe-cores.",
    },
    pixbe: {
      name: "Pixel backend",
      type: "Graphics fixed function",
      role: "Depth test, blend and write-out for the slice: 16 ROPs each, 128 die-wide.",
      specs: [{ label: "ROPs", value: "128 total" }],
      pipeline: "Final pixel stage; writes through L2.",
    },
    l2: {
      name: "L2 cache + memory fabric",
      type: "Cache",
      role: "Die-wide 16 MB L2 behind all slices, connected to clients over Intel's memory fabric (GTI). Large for its generation; the same year NVIDIA shipped 6 MB on GA102.",
      specs: [
        { label: "Capacity", value: "16 MB" },
        { label: "Banks", value: "address-hashed slices" },
      ],
      pipeline: "Backstop for all L1/SLM misses; misses go to GDDR6.",
    },
    mem: {
      name: "GDDR6 controller + PHY",
      type: "Memory interface",
      role: "Eight 32-bit GDDR6 controllers form the 256-bit bus; the 16 GB A770 runs 17.5 Gbps for 560 GB/s.",
      specs: [
        { label: "Controllers", value: "8 × 32-bit" },
        { label: "Capacity", value: "16 GB" },
        { label: "Data rate", value: "17.5 Gbps" },
        { label: "Bandwidth", value: "560 GB/s" },
      ],
      pipeline: "Terminal memory level behind L2.",
    },
    media: {
      name: "Xe Media Engine",
      type: "Fixed function",
      role: "Two multi-format codec engines, the first consumer GPU with hardware AV1 encode, shipping months before Ada and RDNA 3.",
      specs: [
        { label: "Engines", value: "2 × MFX" },
        { label: "AV1", value: "encode + decode" },
      ],
      pipeline: "Frame-level operation on DRAM surfaces.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four display pipes with DP 2.0 (UHBR 10) and HDMI 2.1 output.",
      specs: [
        { label: "Pipes", value: "4" },
        { label: "DisplayPort", value: "2.0 UHBR10" },
        { label: "HDMI", value: "2.1" },
      ],
      pipeline: "Scan-out from memory.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "x16 Gen4 host link. Arc performance depends heavily on Resizable BAR, since the driver assumes full-aperture host access to VRAM.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "ReBAR", value: "effectively required" },
      ],
      pipeline: "Host front door.",
    },
  },
}
