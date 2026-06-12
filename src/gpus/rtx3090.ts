import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 300
const H = 232

// 82 of 84 SMs: 41 of 42 TPCs; fused TPC position varies; approx
const GPC_TPCS = [6, 6, 6, 6, 6, 6, 5]

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
  const enabled = GPC_TPCS[i]
  const g = blk(`gpc${i}`, "group", x, y, w, h, {
    label: `GPC${i}`,
    labelPos: "tl",
    doc: "gpc",
    children: [],
  })
  g.children!.push(blk(`gpc${i}/raster`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "RASTER · 16 ROP", doc: "raster" }))
  for (const c of tile(6, 3, 1.5, 11.5, w - 3, h - 13, 1)) {
    const t = blk(`gpc${i}/tpc${c.i}`, "group", c.x, c.y, c.w, c.h, { doc: "tpc", children: [] })
    if (c.i >= enabled) {
      t.kind = "compute"
      t.disabled = true
      t.children = undefined
    } else {
      for (const s of hstack(2, 0.8, 0.8, c.w - 1.6, c.h - 1.6, 0.7)) {
        t.children!.push(blk(`${t.id}/sm${s.i}`, "compute", s.x, s.y, s.w, s.h, { label: "SM", doc: "sm" }))
      }
    }
    g.children!.push(t)
  }
  return g
}

function floorplan(): Block {
  const kids: Block[] = []

  kids.push(blk("front", "frontend", 20, 3, 80, 11, { label: "GigaThread · front end", doc: "front" }))
  kids.push(blk("display", "media", 102, 3, 60, 11, { label: "DISPLAY · DP1.4a · HDMI2.1", doc: "display" }))
  kids.push(blk("media", "media", 164, 3, 54, 11, { label: "NVENC · NVDEC", doc: "media" }))
  kids.push(blk("pcie", "interconnect", 220, 3, 60, 11, { label: "PCIe Gen4 ×16", doc: "pcie" }))

  vstack(3, 3, 16, 14, 194, 3).forEach((c) => {
    kids.push(blk(`gddr-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })
  vstack(3, W - 17, 16, 14, 194, 3).forEach((c) => {
    kids.push(blk(`gddr-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })

  tile(3, 3, 20, 16, 260, 88, 2.5).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(4, 4, 20, 122, 260, 88, 2.5).forEach((c) => kids.push(gpc(c.i + 3, c.x, c.y, c.w, c.h)))

  kids.push(blk("l2", "cache", 20, 106, 260, 14, { label: "L2 CACHE · 6 MB", doc: "l2" }))

  kids.push(blk("nvlink", "interconnect", 20, 213, 56, 13, { label: "NVLINK 3 · 1 LINK", doc: "nvlink" }))
  hstack(4, 80, 213, 200, 13, 3).forEach((c) => {
    kids.push(blk(`gddr-b${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "GDDR6X PHY 32-bit", doc: "mem" }))
  })

  return blk("die", "die", 0, 0, W, H, { label: "GA102", doc: "die", children: kids })
}

export const rtx3090: Gpu = {
  id: "rtx3090",
  vendor: "NVIDIA",
  name: "GeForce RTX 3090",
  die: "GA102",
  arch: "Ampere (GA10x)",
  isa: "sm_86",
  process: "Samsung 8N",
  floorplan,
  docs: {
    die: {
      name: "GA102 (GeForce RTX 3090)",
      type: "Die overview",
      role: "GA102: 628.4 mm² on Samsung 8N, 28.3 billion transistors; 82 of 84 SMs enabled on the 3090. GA10x makes the second 16-lane datapath in each SM partition selectable between FP32 and INT32, doubling peak FP32 throughput and producing the 10 496 CUDA core count. The design pairs a full graphics pipeline with GDDR6X and a 6 MB L2. Floorplan is schematic; proportions approximate.",
      specs: [
        { label: "Process", value: "Samsung 8N" },
        { label: "Transistors", value: "28.3 B" },
        { label: "Die size", value: "628.4 mm²" },
        { label: "SMs", value: "82 (84 on full die)" },
        { label: "CUDA cores", value: "10 496" },
        { label: "Tensor Cores", value: "328 (3rd gen)" },
        { label: "RT Cores", value: "82 (2nd gen)" },
        { label: "ROPs", value: "112" },
        { label: "L2 cache", value: "6 MB" },
        { label: "Memory", value: "24 GB GDDR6X, 384-bit" },
        { label: "Mem bandwidth", value: "936 GB/s" },
        { label: "Boost clock", value: "1.70 GHz" },
        { label: "FP32", value: "35.6 TFLOPS" },
        { label: "NVLink", value: "1 link, 112.5 GB/s" },
        { label: "TGP", value: "350 W" },
      ],
      pipeline: "Front end → GPC raster → SM shading → ROP blend → 6 MB L2 → GDDR6X. The small L2 places most traffic on the 936 GB/s DRAM interface.",
      programming: "Compile with -arch=sm_86. The Ampere compute features are present: cp.async copies global memory directly into shared memory without staging through registers, structured sparsity doubles Tensor Core throughput on weights pruned so that two of every four are zero, and the Tensor Cores match GA100's third generation. Occupancy is capped at 1536 threads per SM and FP64 executes at 1/64 of the FP32 rate.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "Six TPCs (12 SMs) behind a raster engine, with 16 ROPs located in the GPC rather than the memory partition, so pixel rate scales with cluster count. GA102 has seven GPCs in the 3+4 arrangement shown; on the 3090 one GPC runs five TPCs.",
      specs: [
        { label: "Count", value: "7" },
        { label: "TPCs per GPC", value: "6 (5 in one harvested GPC)" },
        { label: "ROPs per GPC", value: "16" },
      ],
      pipeline: "Rasterizes primitives and shades them on local SMs; ROPs blend through L2.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs sharing a PolyMorph geometry engine. One TPC of 42 is fused on the 3090; the position varies per part.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "41 of 42" },
      ],
      pipeline: "Geometry stage feeding the GPC raster engine.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: 'Four partitions per SM, each pairing 16 dedicated FP32 lanes with 16 FP32/INT32 dual-mode lanes; the combined count is marketed as 10 496 "CUDA cores". FP32-dominant shaders approach the doubled rate; integer-heavy code reverts toward single-rate throughput. Each partition has one third-generation Tensor Core, and one second-generation RT Core per SM adds asynchronous ray-triangle intersection and motion-blur acceleration.',
      specs: [
        { label: "Count", value: "82" },
        { label: "FP32 lanes", value: "128 (64 + 64 shared w/ INT32)" },
        { label: "Tensor Cores", value: "4 × 3rd gen" },
        { label: "RT Core", value: "1 × 2nd gen" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤100 KB shared" },
        { label: "Max occupancy", value: "48 warps · 1536 threads" },
      ],
      pipeline: "Fragment and compute shading; the RT Core handles BVH traversal launched from shader warps.",
      programming: "INT32 address arithmetic competes with FP32 for the dual-mode lanes; the FP32/INT32 instruction ratio is the principal sm_86 tuning parameter.",
    },
    raster: {
      name: "Raster engine + ROPs",
      type: "Graphics fixed function",
      role: "Per-GPC triangle setup, coarse rasterization and Z-cull, plus 16 ROPs for depth test and blending: 112 ROPs total. Because ROPs reside in the GPC, harvesting a cluster reduces pixel rate along with shader count.",
      specs: [
        { label: "ROPs total", value: "112" },
        { label: "Rasterizers", value: "7" },
      ],
      pipeline: "Between geometry and fragment shading; final pixel writes go through L2.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A single 6 MB L2 shared by all clients; texture, ROP and compute traffic pass through it, and misses proceed to GDDR6X. The small capacity is compensated by 936 GB/s of DRAM bandwidth.",
      specs: [
        { label: "Capacity", value: "6 MB" },
        { label: "Slices", value: "paired with 32-bit MCs" },
      ],
      pipeline: "Backstop for all on-die clients.",
    },
    mem: {
      name: "GDDR6X memory controller + PHY",
      type: "Memory interface",
      role: "Twelve 32-bit controllers form the 384-bit bus. GDDR6X PAM4 signalling carries two bits per symbol, reaching 19.5 Gbps per pin. The 24 GB capacity uses 8 Gb devices mounted clamshell on both faces of the PCB.",
      specs: [
        { label: "Controllers", value: "12 × 32-bit" },
        { label: "Capacity", value: "24 GB" },
        { label: "Data rate", value: "19.5 Gbps PAM4" },
        { label: "Bandwidth", value: "936 GB/s" },
      ],
      pipeline: "Terminal memory level behind L2.",
    },
    nvlink: {
      name: "NVLink 3 (single link)",
      type: "Interconnect",
      role: "One NVLink 3 link, 112.5 GB/s bidirectional, supporting two-GPU peer access and memory pooling in rendering and ML workloads. The connector was removed in the following consumer generation.",
      specs: [
        { label: "Links", value: "1" },
        { label: "Bandwidth", value: "112.5 GB/s bidir" },
      ],
      pipeline: "Peer-to-peer GPU traffic bypassing PCIe.",
      programming: "cudaDeviceEnablePeerAccess across the bridge; two 24 GB cards form an effective 48 GB pool.",
    },
    front: {
      name: "GigaThread Engine + front end",
      type: "Front end",
      role: "Command processing and global work distribution for graphics and compute, with copy engines for asynchronous DMA.",
      specs: [{ label: "Scheduling unit", value: "thread block / draw" }],
      pipeline: "All command buffers start here.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four display heads: DP 1.4a with DSC and HDMI 2.1, sufficient for 8K60 over a single cable.",
      specs: [
        { label: "DisplayPort", value: "1.4a + DSC" },
        { label: "HDMI", value: "2.1" },
      ],
      pipeline: "Scan-out from memory, independent of the 3D pipeline.",
    },
    media: {
      name: "NVENC / NVDEC",
      type: "Fixed function",
      role: "One seventh-generation NVENC (H.264/HEVC) and one fifth-generation NVDEC with AV1 decode. AV1 encode is absent in this generation.",
      specs: [
        { label: "NVENC", value: "1 × 7th gen" },
        { label: "NVDEC", value: "1 × 5th gen (AV1 decode)" },
      ],
      pipeline: "Frame-level operation on DRAM surfaces.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "x16 Gen4, 32 GB/s per direction, for command submission and host copies.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
  },
}
