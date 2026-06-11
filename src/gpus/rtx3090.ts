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
      role: "Consumer Ampere's flagship: 628.4 mm² on Samsung 8N (NVIDIA's one big-die detour away from TSMC) with 28.3 billion transistors, 82 of 84 SMs enabled. The defining GA10x change was making the second datapath in each SM partition dual-mode, so 16 INT32 lanes became 16 lanes of FP32-or-INT32. On-paper FP32 doubled overnight, which is where the 10 496 CUDA core figure comes from. Same architecture generation as the datacenter GA100, but a different animal: full graphics pipeline, GDDR6X in place of HBM, and a small 6 MB L2 that leans on raw DRAM bandwidth. Floorplan is schematic; proportions approximate.",
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
      pipeline: "Front end → GPC raster → SM shading → ROP blend → 6 MB L2 → GDDR6X. With a small L2, GA102 leans directly on its 936 GB/s of PAM4 DRAM bandwidth.",
      programming: "Compile with -arch=sm_86. The Ampere compute features (cp.async, structured sparsity, 3rd-gen Tensor Cores) all work on consumer silicon; the practical differences are a 1536-thread SM limit instead of GA100's 2048, and FP64 at token rate.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "The graphics cluster: six TPCs (12 SMs) behind a raster engine. GA10x moved the ROPs inside the GPC, where previous designs hung them off the memory controllers, so pixel output now scales with GPC count instead of bus width. GA102 carries seven GPCs, drawn here in the asymmetric 3+4 rows the real die uses; on the 3090 one of them runs a TPC short.",
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
      role: "Two SMs sharing a PolyMorph geometry engine, and the unit that yield harvesting works in. The 3090 is a remarkably complete die: a single TPC of the 42 is fused off (its position varies per part), where the 3080 built from the same silicon cuts eight.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "41 of 42" },
      ],
      pipeline: "Geometry feeding the GPC raster engine.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: 'The GA10x SM: four partitions, each pairing 16 dedicated FP32 lanes with 16 dual-mode lanes that run either FP32 or INT32 on any given clock. That second datapath is the famous doubling. Counted optimistically it yields 10 496 "CUDA cores", and shaders dominated by pure float math get close to the doubled rate, while integer-heavy ones drift back toward Turing-style throughput. Each partition adds a 3rd-gen Tensor Core, and the one 2nd-gen RT Core per SM brings asynchronous ray-triangle intersection plus motion-blur acceleration over Turing.',
      specs: [
        { label: "Count", value: "82" },
        { label: "FP32 lanes", value: "128 (64 + 64 shared w/ INT32)" },
        { label: "Tensor Cores", value: "4 × 3rd gen" },
        { label: "RT Core", value: "1 × 2nd gen" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤100 KB shared" },
        { label: "Max occupancy", value: "48 warps · 1536 threads" },
      ],
      pipeline: "Fragment and compute shading; RT Core handles BVH traversal launched from warps.",
      programming: "FP32-heavy shaders see most of the dual-mode benefit; address arithmetic and other INT32 work compete for the shared lanes, the central sm_86 tuning consideration.",
    },
    raster: {
      name: "Raster engine + ROPs",
      type: "Graphics fixed function",
      role: "Per-GPC triangle setup, coarse rasterization and Z-cull, plus the 16 ROPs that depth-test and blend finished pixels: seven GPCs make 112 ROPs. Because GA10x houses ROPs in the GPC, harvesting a cluster costs pixel rate along with shaders, which is why ROP counts wobble down the product stack.",
      specs: [
        { label: "ROPs total", value: "112" },
        { label: "Rasterizers", value: "7" },
      ],
      pipeline: "Between geometry and fragment shading; final pixel writes go through L2.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A single 6 MB L2 shared by every client on the die, the last of the small-cache GeForce designs. Texture, ROP and compute traffic all squeeze through it, and whatever misses goes straight to GDDR6X. That is why GA102 carries nearly 1 TB/s of DRAM bandwidth, and why Ada's answer two years later was 12× more cache rather than a wider bus.",
      specs: [
        { label: "Capacity", value: "6 MB" },
        { label: "Slices", value: "paired with 32-bit MCs" },
      ],
      pipeline: "Backstop for all on-die clients.",
    },
    mem: {
      name: "GDDR6X memory controller + PHY",
      type: "Memory interface",
      role: "Twelve 32-bit controllers form the 384-bit bus. The 3090 debuted GDDR6X, which signals with PAM4: four voltage levels per symbol carry two bits where ordinary GDDR6 carries one, reaching 19.5 Gbps. The 24 GB comes from 8 Gb devices mounted clamshell on both faces of the PCB, which is also why early 3090s ran their memory hot; half the chips sit on the far side from the cooler.",
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
      role: "The last GeForce with NVLink: one Gen3 link at 112.5 GB/s for two-card setups. SLI gaming was already fading when this shipped; the link's real constituency was rendering and deep-learning rigs pooling two 24 GB cards into an effective 48 GB working set. Ada dropped the connector entirely, ending the era.",
      specs: [
        { label: "Links", value: "1" },
        { label: "Bandwidth", value: "112.5 GB/s bidir" },
      ],
      pipeline: "Peer-to-peer GPU traffic bypassing PCIe.",
      programming: "cudaDeviceEnablePeerAccess across the bridge; popular for 48 GB effective pools in Blender/ML before being dropped on Ada.",
    },
    front: {
      name: "GigaThread Engine + front end",
      type: "Front end",
      role: "Command processing and global work distribution for graphics and compute. Draw calls and kernel launches are decoded here and dealt out across the seven GPCs, with copy engines running DMA alongside the work. It is the same GigaThread machinery as the datacenter dies, pointed at frames instead of training grids.",
      specs: [{ label: "Scheduling unit", value: "thread block / draw" }],
      pipeline: "All command buffers start here.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four display heads driving DP 1.4a (with DSC) and HDMI 2.1. The HDMI 2.1 port was the launch headline: the 3090 was among the first cards able to feed an 8K60 or 4K120 screen over a single cable.",
      specs: [
        { label: "DisplayPort", value: "1.4a + DSC" },
        { label: "HDMI", value: "2.1" },
      ],
      pipeline: "Scan-out from memory, independent of 3D.",
    },
    media: {
      name: "NVENC / NVDEC",
      type: "Fixed function",
      role: "One 7th-gen NVENC encoder (H.264/HEVC) and one 5th-gen NVDEC decoder that added AV1 decode. Streamers got hardware encode good enough to retire x264 fast presets without costing any shader time. AV1 encode stayed a generation away, arriving with Ada.",
      specs: [
        { label: "NVENC", value: "1 × 7th gen" },
        { label: "NVDEC", value: "1 × 5th gen (AV1 decode)" },
      ],
      pipeline: "Frame-level operation on DRAM surfaces.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "Sixteen lanes of PCIe Gen4 at 32 GB/s per direction for command submission and host copies. A single gaming card rarely saturates this; it mattered more in the compute rigs that the 3090's 24 GB attracted.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "Host front door.",
    },
  },
}
