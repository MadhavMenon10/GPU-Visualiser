import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 292
const H = 238

// 128 SMs: 64 of 66 TPCs across 11 GPCs, 12th GPC fused; exact fuse positions vary; approx
const GPC_TPCS = [6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 0]

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
  const enabled = GPC_TPCS[i]
  if (enabled === 0) {
    return blk(`gpc${i}`, "compute", x, y, w, h, {
      label: "GPC · FUSED",
      doc: "gpc",
      disabled: true,
    })
  }
  const g = blk(`gpc${i}`, "group", x, y, w, h, {
    label: `GPC${i}`,
    labelPos: "tl",
    doc: "gpc",
    children: [],
  })
  g.children!.push(blk(`gpc${i}/raster`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "RASTER · 16 ROP", doc: "raster" }))
  for (const c of tile(6, 2, 1.5, 11.5, w - 3, h - 13, 1)) {
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

  kids.push(blk("front", "frontend", 20, 3, 76, 11, { label: "GigaThread · front end", doc: "front" }))
  kids.push(blk("display", "media", 98, 3, 58, 11, { label: "DISPLAY · DP1.4a · HDMI2.1", doc: "display" }))
  kids.push(blk("media", "media", 158, 3, 52, 11, { label: "2× NVENC · 1× NVDEC", doc: "media" }))
  kids.push(blk("ofa", "media", 212, 3, 14, 11, { label: "OFA", doc: "ofa" }))
  kids.push(blk("pcie", "interconnect", 228, 3, 44, 11, { label: "PCIe Gen4 ×16", doc: "pcie" }))

  vstack(3, 3, 16, 14, 203, 3).forEach((c) => {
    kids.push(blk(`gddr-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })
  vstack(3, W - 17, 16, 14, 203, 3).forEach((c) => {
    kids.push(blk(`gddr-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })
  hstack(6, 20, 222, 252, 12, 3).forEach((c) => {
    kids.push(blk(`gddr-b${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "GDDR6X PHY 32-bit", doc: "mem" }))
  })

  tile(6, 6, 20, 16, 252, 86, 2.5).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(6, 6, 20, 133, 252, 86, 2.5).forEach((c) => kids.push(gpc(c.i + 6, c.x, c.y, c.w, c.h)))

  const l2 = blk("l2", "cache", 20, 104.5, 252, 26, {
    label: "L2 CACHE · 72 MB (96 MB PHYSICAL)",
    labelPos: "tl",
    doc: "l2",
    children: [],
  })
  hstack(12, 1.5, 6.5, 249, 18, 1).forEach((c) => {
    l2.children!.push(blk(`l2/${c.i}`, "cache", c.x, c.y, c.w, c.h, { label: "6 MB", doc: "l2" }))
  })
  kids.push(l2)

  return blk("die", "die", 0, 0, W, H, { label: "AD102", doc: "die", children: kids })
}

export const rtx4090: Gpu = {
  id: "rtx4090",
  vendor: "NVIDIA",
  name: "GeForce RTX 4090",
  die: "AD102",
  arch: "Ada Lovelace",
  isa: "sm_89",
  process: "TSMC 4N",
  floorplan,
  docs: {
    die: {
      name: "AD102 (GeForce RTX 4090)",
      type: "Die overview",
      role: "AD102: approximately 608 mm² on TSMC 4N carrying 76.3 billion transistors, 2.7× the transistor count of GA102 in comparable area. The 4090 enables 128 of 144 SMs (11 of 12 GPCs) and 72 of 96 MB of L2. The L2 expansion, 16× the capacity of GA102, is the generation's defining change: it substitutes cache hit rate for DRAM bandwidth on an unchanged 384-bit bus. Floorplan is schematic; proportions approximate.",
      specs: [
        { label: "Process", value: "TSMC 4N" },
        { label: "Transistors", value: "76.3 B" },
        { label: "Die size", value: "~608 mm²" },
        { label: "SMs", value: "128 (144 on full die)" },
        { label: "CUDA cores", value: "16 384" },
        { label: "Tensor Cores", value: "512 (4th gen, FP8)" },
        { label: "RT Cores", value: "128 (3rd gen)" },
        { label: "ROPs", value: "176" },
        { label: "L2 cache", value: "72 MB (96 MB physical)" },
        { label: "Memory", value: "24 GB GDDR6X, 384-bit" },
        { label: "Mem bandwidth", value: "1 008 GB/s" },
        { label: "Boost clock", value: "2.52 GHz" },
        { label: "FP32", value: "82.6 TFLOPS" },
        { label: "FP16 Tensor", value: "330 TFLOPS (661 sparse)" },
        { label: "TGP", value: "450 W" },
      ],
      pipeline: "Graphics work flows front end → GPC raster engines → SM shading → ROPs → L2 → GDDR6X; compute skips the raster stages. The L2 intercepts the majority of traffic that previously reached DRAM.",
      programming: "Compile with -arch=sm_89. Ada adds FP8 tensor arithmetic, halving storage per operand relative to FP16; shader execution reordering (SER), which regroups divergent ray hits so SIMD lanes shade similar materials together; and an optical flow accelerator whose motion fields feed DLSS 3 frame generation.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "Raster engine, 16 ROPs and six TPCs (12 SMs) per cluster; eleven enabled on the 4090, one fused. Setup, rasterization, shading and blending for a draw complete within one GPC, so the architecture scales primarily by cluster count.",
      specs: [
        { label: "Count", value: "11 enabled (12 physical)" },
        { label: "TPCs per GPC", value: "6 (5 in two harvested GPCs)" },
        { label: "ROPs per GPC", value: "16" },
        { label: "Raster engines", value: "1 per GPC" },
      ],
      pipeline: "Receives primitives from the front end, rasterizes, shades on its SMs, blends in its ROP partitions.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs plus a PolyMorph engine performing vertex fetch, tessellation and viewport transform. 64 of 66 TPC slots are enabled across the active GPCs; fused positions vary per part.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "64 of 72 (whole die)" },
      ],
      pipeline: "Geometry stage feeding the GPC raster engine; compute passes directly to SMs.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Arithmetic organization carries over from GA10x: four partitions, each with 16 dedicated FP32 lanes, 16 dual-mode FP32/INT32 lanes, and one fourth-generation Tensor Core with FP8 support. The third-generation RT Core adds opacity micromaps, which resolve alpha-tested geometry without shader round trips, and displaced micro-meshes, which represent dense geometry compactly within the BVH.",
      specs: [
        { label: "Count", value: "128" },
        { label: "FP32 lanes", value: "128 (64 + 64 shared w/ INT32)" },
        { label: "Tensor Cores", value: "4 × 4th gen (FP8)" },
        { label: "RT Core", value: "1 × 3rd gen" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤100 KB shared" },
        { label: "Texture units", value: "4" },
        { label: "Max occupancy", value: "48 warps · 1536 threads" },
      ],
      pipeline: "Shades fragments from the raster engine and runs compute grids; RT Core queries issue from shader warps and return hit results.",
      programming: "One thread block per SM (1536-thread limit on consumer Ada, versus 2048 on GA100/GH100). SER (sm_89) reorders ray-hit shading for coherence via NVAPI/OptiX.",
    },
    raster: {
      name: "Raster engine + ROPs",
      type: "Graphics fixed function",
      role: "Per-GPC triangle setup, coarse rasterization and Z-cull; two ROP partitions (16 ROPs) per cluster perform depth test, blending and MSAA resolve. 176 ROPs are enabled; pixel rate scales with cluster count because the ROPs reside in the GPC.",
      specs: [
        { label: "ROPs total", value: "176 (11 × 16)" },
        { label: "Rasterizers", value: "11" },
      ],
      pipeline: "Between geometry (TPC PolyMorph) and fragment shading (SMs); ROPs write final pixels through L2.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "96 MB physical in twelve 8 MB slices, 72 MB enabled on the 4090, versus 6 MB on GA102. The majority of traffic that previously reached DRAM now hits on-die, raising effective bandwidth several-fold. BVH traversal, which combines high reuse with scattered addressing, benefits most.",
      specs: [
        { label: "Capacity", value: "72 MB enabled / 96 MB physical" },
        { label: "Slices", value: "12 (paired with 32-bit MCs)" },
      ],
      pipeline: "All SM, ROP and texture traffic passes through; slice assignment is hashed by address.",
      programming: "cudaAccessPolicyWindow lets software pin an address range resident in L2 on sm_89; many workloads see DRAM traffic fall to a fraction of Ampere levels.",
    },
    mem: {
      name: "GDDR6X memory controller + PHY",
      type: "Memory interface",
      role: "Twelve 32-bit GDDR6X controllers form the 384-bit bus: 21 Gbps PAM4, 1008 GB/s. The interface carries over nearly unchanged from GA102; the enlarged L2 absorbs the bandwidth demand of the larger SM array.",
      specs: [
        { label: "Controllers", value: "12 × 32-bit" },
        { label: "Capacity", value: "24 GB (12 × 16 Gb)" },
        { label: "Data rate", value: "21 Gbps PAM4" },
        { label: "Bandwidth", value: "1 008 GB/s" },
      ],
      pipeline: "Terminal memory level behind the L2 slices.",
    },
    front: {
      name: "GigaThread Engine + front end",
      type: "Front end",
      role: "Command processing and global work distribution across the eleven GPCs, with copy engines for asynchronous DMA. Graphics, compute and tensor work execute concurrently within a frame.",
      specs: [{ label: "Scheduling unit", value: "thread block / draw" }],
      pipeline: "All command buffer execution starts here.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four display heads: DP 1.4a with DSC and HDMI 2.1a. DP 2.x is absent; uncompressed formats beyond 4K120 exceed the available link rate.",
      specs: [
        { label: "DisplayPort", value: "1.4a + DSC" },
        { label: "HDMI", value: "2.1a" },
      ],
      pipeline: "Scans out final frames from memory, independent of the 3D pipeline.",
    },
    media: {
      name: "NVENC / NVDEC",
      type: "Fixed function",
      role: "Two eighth-generation NVENC encoders with AV1 support and one fifth-generation NVDEC. The encoders can split a single frame between them for approximately double throughput.",
      specs: [
        { label: "NVENC", value: "2 × 8th gen (AV1)" },
        { label: "NVDEC", value: "1 × 5th gen" },
      ],
      pipeline: "Operates on frames in DRAM, independent of the SMs.",
    },
    ofa: {
      name: "OFA (Optical Flow Accelerator)",
      type: "Fixed function",
      role: "Computes dense optical flow between consecutive frames in fixed function. DLSS 3 frame generation combines these flow fields with game motion vectors to synthesize intermediate frames. Ada's implementation runs at approximately twice the Ampere rate.",
      specs: [{ label: "Throughput", value: "~300 TOPS equivalent flow" }], // approx
      pipeline: "Consumes rendered frames; produces motion vectors for the DLSS frame-generation network.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "x16 Gen4 host link; consumer Ada omits Gen5 and NVLink, so peer-to-peer multi-GPU traffic also uses this link.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
  },
}
