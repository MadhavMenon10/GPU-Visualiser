import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 332
const H = 246

// 80 of 84 SMs: 40 of 42 TPCs; fused TPC positions vary per die; approx
const GPC_TPCS = [7, 7, 7, 7, 6, 6]

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
  const enabled = GPC_TPCS[i]
  const g = blk(`gpc${i}`, "group", x, y, w, h, {
    label: `GPC${i}`,
    labelPos: "tl",
    doc: "gpc",
    children: [],
  })
  for (const c of tile(7, 2, 1.5, 6.5, w - 3, h - 8, 1.2)) {
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

  kids.push(blk("front", "frontend", 22, 3, 150, 11, { label: "GigaThread Engine · copy engines", doc: "front" }))
  kids.push(blk("pcie", "interconnect", 175, 3, 84, 11, { label: "PCIe Gen3 ×16", doc: "pcie" }))
  kids.push(blk("media", "media", 262, 3, 48, 11, { label: "NVENC · NVDEC", doc: "media" }))

  vstack(2, 3, 18, 16, H - 36, 4).forEach((c) => {
    kids.push(blk(`hbm-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "HBM2", doc: "hbm" }))
  })
  vstack(2, W - 19, 18, 16, H - 36, 4).forEach((c) => {
    kids.push(blk(`hbm-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "HBM2", doc: "hbm" }))
  })

  tile(3, 3, 22, 16, 288, 97, 3).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(3, 3, 22, 132, 288, 97, 3).forEach((c) => kids.push(gpc(c.i + 3, c.x, c.y, c.w, c.h)))

  kids.push(blk("l2", "cache", 22, 115, 288, 15, { label: "L2 CACHE · 6 MB", doc: "l2" }))

  const nv = blk("nvlink", "interconnect", 22, H - 13, 288, 10, { doc: "nvlink", children: [] })
  hstack(6, 1, 1, 286, 8, 1).forEach((c) => {
    nv.children!.push(blk(`nvlink/${c.i}`, "interconnect", c.x, c.y, c.w, c.h, { doc: "nvlink" }))
  })
  kids.push(nv)
  kids.push(blk("nvlink-label", "group", 22, H - 13, 288, 10, { label: "NVLINK 2 · 6 LINKS", labelPos: "tl", doc: "nvlink" }))

  return blk("die", "die", 0, 0, W, H, { label: "GV100", doc: "die", children: kids })
}

export const v100: Gpu = {
  id: "v100",
  vendor: "NVIDIA",
  name: "V100 SXM2",
  die: "GV100",
  arch: "Volta",
  isa: "sm_70",
  process: "TSMC 12FFN",
  floorplan,
  docs: {
    die: {
      name: "GV100 (V100 SXM2)",
      type: "Die overview",
      role: "GV100: 815 mm² on TSMC 12FFN, 21.1 billion transistors; the largest die fabricated at its launch and the first GPU with Tensor Cores. Its 640 Tensor Cores raise FP16 training throughput to 125 TFLOPS, 8× the FP32 rate. V100 enables 80 of 84 SMs. GV100 retains a full graphics pipeline and also shipped as a workstation part. Floorplan is schematic; proportions approximate.",
      specs: [
        { label: "Process", value: "TSMC 12FFN" },
        { label: "Transistors", value: "21.1 B" },
        { label: "Die size", value: "815 mm²" },
        { label: "SMs", value: "80 (84 on full die)" },
        { label: "FP32 cores", value: "5 120" },
        { label: "Tensor Cores", value: "640 (1st gen)" },
        { label: "L2 cache", value: "6 MB" },
        { label: "Memory", value: "16/32 GB HBM2, 4096-bit" },
        { label: "Mem bandwidth", value: "900 GB/s" },
        { label: "Boost clock", value: "1.53 GHz" },
        { label: "FP32 / FP64", value: "15.7 / 7.8 TFLOPS" },
        { label: "FP16 Tensor", value: "125 TFLOPS" },
        { label: "NVLink", value: "Gen2, 6 links, 300 GB/s" },
        { label: "TDP", value: "300 W" },
      ],
      pipeline: "PCIe Gen3 or NVLink in, GigaThread Engine distributes blocks across 6 GPCs, memory drains through a single 6 MB L2 to four HBM2 stacks.",
      programming: "Compile with -arch=sm_70. Volta introduced independent thread scheduling (per-thread program counters), which removed intra-warp deadlock and invalidated warp-synchronous programming idioms. First-generation Tensor Cores compute FP16 products with FP32 accumulation.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "One of six clusters: 7 TPCs (14 SMs) plus a raster engine, as GV100 retains graphics capability. Each GPC contains its own work distribution, which places incoming thread blocks on SMs with free capacity.",
      specs: [
        { label: "Count", value: "6" },
        { label: "TPCs per GPC", value: "6-7 enabled (7 physical)" },
        { label: "SMs per GPC", value: "12-14" },
      ],
      pipeline: "GigaThread Engine balances across GPCs; per-GPC distribution feeds SMs.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs sharing texture hardware, front-end plumbing and the PolyMorph geometry engine. The TPC is the granularity of yield harvesting: V100 ships 40 of 42 enabled, with fused positions varying per die; the hatching shown is representative.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "40 of 42" },
      ],
      pipeline: "Between GPC work distribution and SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each with a warp scheduler, a 64 KB register file slice, 16 FP32, 16 INT32 and 8 FP64 lanes, and two first-generation Tensor Cores (4×4×4 FP16 multiply, FP32 accumulate). Volta separated the INT32 pipe from FP32, allowing address arithmetic to issue alongside floating-point work, and gave each thread its own program counter, removing divergence-induced deadlock.",
      specs: [
        { label: "Count", value: "80" },
        { label: "FP32 / INT32 / FP64", value: "64 / 64 / 32 per SM" },
        { label: "Tensor Cores", value: "8 × 1st gen (FP16→FP32)" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤96 KB shared" },
        { label: "Warp schedulers", value: "4" },
        { label: "Max occupancy", value: "64 warps · 2048 threads" },
      ],
      pipeline: "Thread blocks from GPC distribution; warps issue per partition; LSU → L1 → L2 → HBM2.",
      programming: "sm_70 requires __syncwarp() and the *_sync intrinsics; threads in a warp no longer execute in lockstep. WMMA exposes the Tensor Cores as 16×16×16 tiles.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A single 6 MB L2 serving all 80 SMs: every L1 miss, global atomic and HBM transfer passes through it. The capacity is small relative to later parts; A100 increased it 6.7×. The deficit is offset by HBM2 bandwidth. ROPs partner with the L2 slices, as the die renders.",
      specs: [
        { label: "Capacity", value: "6 MB" },
        { label: "ROPs", value: "128 (graphics SKUs)" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "Backstop for L1 misses; staging for the HBM2 controllers.",
    },
    hbm: {
      name: "HBM2 stack + memory controllers",
      type: "Memory interface",
      role: "Four HBM2 stacks on a CoWoS interposer, driven by eight 512-bit controllers: a 4096-bit bus at 900 GB/s. All four stacks are enabled; the 16 GB and 32 GB variants differ only in stack height. The bus width, roughly 10× that of contemporary GDDR interfaces, is what the interposer purchases.",
      specs: [
        { label: "Stacks", value: "4 of 4" },
        { label: "Controllers", value: "8 × 512-bit" },
        { label: "Capacity", value: "16 / 32 GB" },
        { label: "Bandwidth", value: "900 GB/s" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "Terminal memory level; L2 misses are serviced here.",
      programming: "Global memory; coalescing across 32-byte sectors is required for peak bandwidth.",
    },
    nvlink: {
      name: "NVLink 2",
      type: "Interconnect",
      role: "Six NVLink 2 links at 25 GB/s per direction, 300 GB/s aggregate. DGX-1V arranges eight GPUs in a hybrid cube mesh over these links; on POWER9 systems, NVLink also provides cache-coherent CPU-GPU attachment.",
      specs: [
        { label: "Links", value: "6 × 50 GB/s bidir" },
        { label: "Aggregate", value: "300 GB/s" },
        { label: "Topology", value: "hybrid cube mesh (DGX-1V)" },
      ],
      pipeline: "Peer traffic bypasses PCIe; CPU-coherent on POWER9.",
      programming: "Peer access and NCCL rings; the cube mesh made ring all-reduce the standard V100 collective.",
    },
    pcie: {
      name: "PCIe Gen3 host interface",
      type: "Interconnect",
      role: "x16 Gen3, 16 GB/s per direction, carrying command submission and host copies. The disparity against 900 GB/s of local HBM bandwidth is the motivation for NVLink.",
      specs: [
        { label: "Link", value: "Gen3 ×16" },
        { label: "Bandwidth", value: "~32 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "Device-level thread block scheduler with context switching and, new in Volta, compute preemption at instruction granularity. Copy engines execute DMA transfers concurrently with kernels.",
      specs: [{ label: "Scheduling unit", value: "thread block" }],
      pipeline: "Every kernel launch passes through it to the GPCs.",
    },
    media: {
      name: "Video engines",
      type: "Fixed function",
      role: "NVENC and NVDEC blocks retained from the graphics lineage; GV100 also shipped as a workstation part. On datacenter V100s they serve transcode and decode for inference input.",
      specs: [
        { label: "NVENC", value: "yes" },
        { label: "NVDEC", value: "yes" },
      ],
      pipeline: "Decode output lands in HBM2 for SM consumption.",
    },
  },
}
