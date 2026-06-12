import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 330
const H = 248

// 66 of 72 TPCs enabled on SXM5; per-GPC fuse distribution not published; approx
const GPC_TPCS = [9, 8, 8, 8, 8, 8, 8, 9]

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
  const enabled = GPC_TPCS[i]
  const g = blk(`gpc${i}`, "group", x, y, w, h, {
    label: `GPC${i}`,
    labelPos: "tl",
    doc: "gpc",
    children: [],
  })
  for (const c of tile(9, 3, 1.5, 6.5, w - 3, h - 8, 1.2)) {
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

  kids.push(blk("front", "frontend", 22, 3, 148, 11, { label: "GigaThread Engine · copy engines", doc: "front" }))
  kids.push(blk("pcie", "interconnect", 173, 3, 86, 11, { label: "PCIe Gen5 ×16", doc: "pcie" }))
  kids.push(blk("media", "media", 262, 3, 46, 11, { label: "7× NVDEC · 7× NVJPG", doc: "media" }))

  vstack(3, 3, 18, 16, H - 36, 4).forEach((c) => {
    kids.push(blk(`hbm-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "HBM3", doc: "hbm" }))
  })
  vstack(3, W - 19, 18, 16, H - 36, 4).forEach((c) => {
    kids.push(
      blk(`hbm-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, {
        label: "HBM3",
        doc: "hbm",
        disabled: c.i === 2, // 5 of 6 stacks enabled on SXM5; which site is dark varies; approx
      }),
    )
  })

  tile(4, 4, 22, 16, 286, 90, 3).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(4, 4, 22, 142, 286, 90, 3).forEach((c) => kids.push(gpc(c.i + 4, c.x, c.y, c.w, c.h)))

  kids.push(blk("l2-0", "cache", 22, 109, 140.5, 30, { label: "L2 CACHE · 25 MB PARTITION", doc: "l2" }))
  kids.push(blk("l2-1", "cache", 167.5, 109, 140.5, 30, { label: "L2 CACHE · 25 MB PARTITION", doc: "l2" }))

  const nv = blk("nvlink", "interconnect", 22, H - 13, 286, 10, { label: "", doc: "nvlink", children: [] })
  hstack(18, 1, 1, 284, 8, 1).forEach((c) => {
    nv.children!.push(blk(`nvlink/${c.i}`, "interconnect", c.x, c.y, c.w, c.h, { doc: "nvlink" }))
  })
  kids.push(nv)
  kids.push(blk("nvlink-label", "group", 22, H - 13, 286, 10, { label: "NVLINK 4 · 18 LINKS", labelPos: "tl", doc: "nvlink" }))

  return blk("die", "die", 0, 0, W, H, { label: "GH100", doc: "die", children: kids })
}

export const h100: Gpu = {
  id: "h100",
  vendor: "NVIDIA",
  name: "H100 SXM5",
  die: "GH100",
  arch: "Hopper",
  isa: "sm_90",
  process: "TSMC 4N",
  floorplan,
  docs: {
    die: {
      name: "GH100 (H100 SXM5)",
      type: "Die overview",
      role: "GH100: 814 mm² on TSMC 4N, 80 billion transistors. The SXM5 product enables 132 of 144 SMs and 5 of 6 HBM3 stacks; fused positions follow defect locations and vary per die. Die area is dominated by the eight GPC fields, a 50 MB L2 in two central partitions, and the HBM interfaces on both long edges. Floorplan is schematic; proportions approximate.",
      specs: [
        { label: "Process", value: "TSMC 4N (custom 5 nm)" },
        { label: "Transistors", value: "80 B" },
        { label: "Die size", value: "814 mm²" },
        { label: "SMs", value: "132 (144 on full die)" },
        { label: "FP32 cores", value: "16 896" },
        { label: "Tensor Cores", value: "528 (4th gen, FP8)" },
        { label: "L2 cache", value: "50 MB (2 partitions)" },
        { label: "Memory", value: "80 GB HBM3, 5120-bit" },
        { label: "Mem bandwidth", value: "3.35 TB/s" },
        { label: "Boost clock", value: "~1.98 GHz" }, // approx
        { label: "FP32 / FP64", value: "67 / 34 TFLOPS" },
        { label: "FP16 Tensor", value: "989 TFLOPS (1979 sparse)" },
        { label: "FP8 Tensor", value: "1979 TFLOPS (3958 sparse)" },
        { label: "NVLink", value: "Gen4, 18 links, 900 GB/s" },
        { label: "TDP", value: "700 W" },
      ],
      pipeline: "Work arrives over PCIe Gen5 or NVLink, is queued by the GigaThread Engine, and is distributed as thread blocks to SMs inside the 8 GPCs. Memory traffic flows SM → L1 → L2 partition → HBM3 controllers on the die edges.",
      programming: "Compile with -arch=sm_90 (CUDA 12+). Hopper adds thread block clusters, which schedule a group of blocks together on one GPC so they can cooperate; distributed shared memory, which lets those blocks read and write each other's shared memory directly; and the Tensor Memory Accelerator, a per-SM engine that copies tensor tiles while the warps compute. FP8 arrives through the Transformer Engine, which chooses between FP8 and FP16 per layer to hold accuracy while doubling throughput.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "Top-level compute partition: up to 9 TPCs (18 SMs) with local work distribution. Thread block clusters are scoped to one GPC, which guarantees the co-residency required for SM-to-SM distributed shared memory. MIG partitions the device on GPC boundaries.",
      specs: [
        { label: "Count", value: "8" },
        { label: "TPCs per GPC", value: "8-9 enabled (9 physical)" },
        { label: "SMs per GPC", value: "16-18" },
        { label: "MIG", value: "instances partition on GPC boundaries" },
      ],
      pipeline: "The GigaThread Engine load-balances thread blocks across GPCs; within a GPC, a work distribution unit assigns blocks to individual SMs.",
      programming: "CUDA 12 thread block clusters (cluster_dims) map onto a single GPC, enabling distributed shared memory and cluster barriers.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs sharing front-end plumbing. The name is legacy; only two TPCs on GH100 retain graphics pipelines. The TPC is the granularity of yield harvesting: SXM5 enables 66 of 72, with fused positions varying per part.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "66 of 72 (SXM5)" },
      ],
      pipeline: "Pass-through level between GPC work distribution and SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each with a warp scheduler issuing one 32-thread instruction per clock, a 64 KB register file slice, 32 FP32, 16 INT32 and 16 FP64 lanes, and one fourth-generation Tensor Core with FP8 support. The per-SM Tensor Memory Accelerator generates addresses and copies tensor tiles between global and shared memory asynchronously, freeing warp issue slots for arithmetic.",
      specs: [
        { label: "Count", value: "132" },
        { label: "FP32 / INT32 / FP64", value: "128 / 64 / 64 per SM" },
        { label: "Tensor Cores", value: "4 × 4th gen (FP8/FP16/BF16/TF32/FP64/INT8)" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "256 KB combined, ≤228 KB shared" },
        { label: "Warp schedulers", value: "4 (32 threads/clk each)" },
        { label: "Max occupancy", value: "64 warps · 2048 threads" },
        { label: "TMA", value: "1 per SM" },
      ],
      pipeline: "Receives thread blocks from GPC work distribution, schedules warps onto partition pipelines; loads/stores go through the LSU to L1, then L2 and HBM. Tensor Core operands stream from registers and shared memory.",
      programming: "One thread block executes on exactly one SM; warps of 32 threads are the scheduling unit. __shared__ lives in the L1 carveout. sm_90 exposes TMA (cp.async.bulk / cuda::memcpy_async) and DSMEM access within a cluster.",
    },
    l2: {
      name: "L2 cache partition",
      type: "Cache",
      role: "50 MB in two 25 MB partitions joined by a crossbar, each serving the HBM controllers on its half of the die. Capacity converts data reuse into avoided HBM transactions. The cache supports residency windows: software marks an address range as persistent, and the L2 holds it resident while streaming traffic passes through the rest, which benefits weights and lookup tables that are reread constantly. It also applies compute-data compression, compacting zero-heavy data as it is written, which raises effective capacity and bandwidth for sparse tensors.",
      specs: [
        { label: "Capacity", value: "50 MB (60 MB full die)" },
        { label: "Partitions", value: "2 × 25 MB" },
        { label: "ECC", value: "SECDED, enabled by default" },
      ],
      pipeline: "Backstop for all SM L1 misses and the staging point for HBM traffic; atomics across SMs resolve here.",
      programming: "cudaAccessPolicyWindow pins address ranges for persistent L2 residency (introduced sm_80, extended on sm_90).",
    },
    hbm: {
      name: "HBM3 stack + memory controllers",
      type: "Memory interface",
      role: "Each edge site is one HBM3 stack on the CoWoS interposer, driven by two 512-bit controllers. SXM5 populates 5 of 6 sites: 10 controllers, a 5120-bit aggregate bus, 3.35 TB/s to 80 GB. One site is fused for yield; its position varies per part. PHYs occupy the edges to reach the interposer wiring.",
      specs: [
        { label: "Stacks", value: "5 of 6 enabled" },
        { label: "Controllers", value: "10 × 512-bit" },
        { label: "Capacity", value: "80 GB" },
        { label: "Bandwidth", value: "3.35 TB/s" },
        { label: "ECC", value: "on-die + link ECC" },
      ],
      pipeline: "Terminal level of the memory hierarchy; L2 partition misses are serviced here. Controller interleaving spreads contiguous addresses across stacks.",
      programming: "Global memory (cudaMalloc) resides here. Coalesced 32-byte sector access is required to approach peak bandwidth.",
    },
    nvlink: {
      name: "NVLink 4",
      type: "Interconnect",
      role: "Eighteen NVLink 4 ports, 25 GB/s per direction each, 900 GB/s aggregate. Through NVSwitch, remote HBM is load/store-addressable across eight GPUs, and SHARP in-network reduction sums tensors inside the switch as they pass through, so an all-reduce moves each operand once instead of once per participating GPU.",
      specs: [
        { label: "Links", value: "18 × 50 GB/s bidir" },
        { label: "Aggregate", value: "900 GB/s" },
        { label: "Fabric", value: "NVSwitch 3, SHARP" },
      ],
      pipeline: "Peer traffic bypasses PCIe; remote loads/stores and NCCL collectives move L2-to-L2 between GPUs.",
      programming: "Exposed via cudaDeviceEnablePeerAccess, NCCL and NVSHMEM; unified addressing makes remote HBM directly addressable.",
    },
    pcie: {
      name: "PCIe Gen5 host interface",
      type: "Interconnect",
      role: "x16 PCIe Gen5, 64 GB/s per direction: command submission, host copies not routed over NVLink, and GPUDirect RDMA from NICs and storage.",
      specs: [
        { label: "Link", value: "Gen5 ×16" },
        { label: "Bandwidth", value: "~128 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work; kernel launches and DMA descriptors pass to the GigaThread Engine.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "Receives grid launches from host queues and distributes thread blocks across the eight GPCs under occupancy and cluster-residency constraints, with context switching and preemption. Copy engines execute DMA concurrently with kernels. MIG hardware partitions the device into up to seven isolated instances.",
      specs: [
        { label: "Scheduling unit", value: "thread block / cluster" },
        { label: "MIG", value: "up to 7 instances" },
      ],
      pipeline: "Between the host interface and the GPCs; every kernel launch passes through it.",
      programming: "CUDA streams and grid launches are mediated here; concurrent kernels and async memcpy overlap depend on its scheduling.",
    },
    media: {
      name: "Media engines",
      type: "Fixed function",
      role: "Seven NVDEC video decoders and seven NVJPG JPEG decoders; no encoder. The configuration matches inference ingest, where decode demand is continuous and encode demand is absent. Output is written to HBM for direct SM consumption.",
      specs: [
        { label: "NVDEC", value: "7" },
        { label: "NVJPG", value: "7" },
        { label: "NVENC", value: "none" },
      ],
      pipeline: "Decode output lands in HBM without a host round trip.",
    },
  },
}
