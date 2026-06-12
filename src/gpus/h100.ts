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
      role: "The GPU of the LLM boom: 814 mm² of TSMC 4N silicon and 80 billion transistors, organized to spend nearly all of it on tensor math. The SXM5 part enables 132 of 144 SMs and 5 of 6 HBM3 stacks; which physical units go dark varies die to die, because fusing follows wherever the defects landed. The proportions tell the story of modern compute: a thin strip of front end along the top, two large fields of GPCs, 50 MB of L2 splitting the middle, and the entire left and right edges handed to memory. Floorplan is schematic: block placement follows the published die organization, proportions are approximate.",
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
      programming: "Compile with -arch=sm_90 (CUDA 12+). Hopper's additions mostly exist to keep the Tensor Cores fed: thread block clusters let blocks cooperate across SMs, distributed shared memory lets them read each other's scratchpads, and the TMA streams tensor tiles in bulk while the warps compute. FP8 arrives through the Transformer Engine.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "Top-level compute partition holding up to 9 TPCs (18 SMs) and its own work distribution unit. Two things give the GPC meaning beyond bookkeeping. Hopper's thread block clusters are scoped to it, so every block of a cluster is guaranteed to be resident on SMs of the same GPC, which is what makes SM-to-SM shared memory access practical. And MIG carves the die into isolated instances along GPC boundaries, making the GPC the quantum of multi-tenancy as well.",
      specs: [
        { label: "Count", value: "8" },
        { label: "TPCs per GPC", value: "8-9 enabled (9 physical)" },
        { label: "SMs per GPC", value: "16-18" },
        { label: "MIG", value: "instances partition on GPC boundaries" },
      ],
      pipeline: "The GigaThread Engine load-balances thread blocks across GPCs; within a GPC, a work distribution unit assigns blocks to individual SMs.",
      programming: "CUDA 12 thread block clusters (cluster_dims) map onto a single GPC, enabling SM-to-SM distributed shared memory and cluster barriers.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "A pair of SMs sharing front-end plumbing. The name is a fossil from graphics dies; GH100 keeps texture units, but only two TPCs on the whole die retain full graphics pipelines and everything else is pure compute. The TPC's real job today is yield management: when a defect lands here, the whole TPC is fused off, and the SXM5 part ships with 66 of 72 alive. Hatched blocks mark the fused ones; the true positions vary per chip.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "66 of 72 (SXM5)" },
      ],
      pipeline: "Pass-through level between GPC work distribution and SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "The unit your CUDA code actually lands on, 132 of them here. Each SM splits into four partitions, and each partition owns a warp scheduler issuing one 32-thread instruction per clock, a 64 KB register file slice, 32 FP32, 16 INT32 and 16 FP64 lanes, and one 4th-gen Tensor Core that now speaks FP8. Hopper's quiet addition is the per-SM Tensor Memory Accelerator, an address-generation engine that copies whole tensor tiles between global and shared memory by itself, so the warps that used to spend issue slots on copying spend them on math.",
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
      programming: "One CUDA thread block executes on exactly one SM; warps of 32 threads are the scheduling unit. __shared__ lives in the L1 carveout. sm_90 exposes TMA (cp.async.bulk / cuda::memcpy_async) and DSMEM access to other SMs in the cluster.",
    },
    l2: {
      name: "L2 cache partition",
      type: "Cache",
      role: "50 MB of cache standing between the SMs and HBM, split into two 25 MB partitions joined by a crossbar, each serving the memory controllers on its own half of the die. The intuition is simple: every reuse caught here is an HBM trip avoided, and when the machine is built to stream terabytes per second, small changes in hit rate move real training throughput. Software can pin hot working sets into residency, and the hardware compresses sparse data losslessly on the way through.",
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
      role: "Each site along the edge is one HBM3 stack sitting beside the die on the CoWoS interposer, driven by two 512-bit controllers. The SXM5 card runs 5 of 6 sites: 10 controllers forming a 5120-bit aggregate bus that moves 3.35 TB/s to 80 GB. One site stays dark for yield (hatched; the physical site varies per part). The edge placement is forced, because PHYs have to reach the interposer wiring and the shortest way off the die is its boundary.",
      specs: [
        { label: "Stacks", value: "5 of 6 enabled" },
        { label: "Controllers", value: "10 × 512-bit" },
        { label: "Capacity", value: "80 GB" },
        { label: "Bandwidth", value: "3.35 TB/s" },
        { label: "ECC", value: "on-die + link ECC" },
      ],
      pipeline: "Terminal level of the memory hierarchy: L2 partition misses are serviced here. Controller interleaving spreads contiguous addresses across stacks.",
      programming: "Global memory (cudaMalloc) resides here. Coalesced 32-byte sector access patterns are required to approach peak bandwidth.",
    },
    nvlink: {
      name: "NVLink 4",
      type: "Interconnect",
      role: "Eighteen NVLink 4 ports along the die edge, 25 GB/s in each direction, 900 GB/s aggregate, roughly seven times what the PCIe link manages. Through NVSwitch these links make eight H100s behave like one large memory machine: remote HBM is directly load/store addressable, and the switch can reduce tensors in flight (SHARP), shrinking all-reduce traffic before it even reaches the wires.",
      specs: [
        { label: "Links", value: "18 × 50 GB/s bidir" },
        { label: "Aggregate", value: "900 GB/s" },
        { label: "Fabric", value: "NVSwitch 3, SHARP" },
      ],
      pipeline: "Peer traffic bypasses PCIe entirely: remote loads/stores and NCCL collectives move L2-to-L2 between GPUs.",
      programming: "Exposed via cudaDeviceEnablePeerAccess, NCCL and NVSHMEM; unified addressing makes remote HBM directly load/store-addressable.",
    },
    pcie: {
      name: "PCIe Gen5 host interface",
      type: "Interconnect",
      role: "Sixteen lanes of PCIe Gen5 at 64 GB/s per direction. It carries kernel launches, the host copies that NVLink does not handle, and GPUDirect RDMA traffic from NICs and storage. On an SXM board this is the management and ingest path; the heavy GPU-to-GPU lifting belongs to NVLink.",
      specs: [
        { label: "Link", value: "Gen5 ×16" },
        { label: "Bandwidth", value: "~128 GB/s bidir" },
      ],
      pipeline: "Front door from the host: kernel launches and DMA descriptors enter here before the GigaThread Engine schedules them.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "The die's dispatcher. The GigaThread Engine takes grid launches off the host queues and deals thread blocks out across the eight GPCs, respecting occupancy limits and cluster co-residency; it also handles context switching and preemption. The copy engines beside it are DMA units moving data between host and device memory while kernels run. The same front-end hardware enforces MIG, splitting the die into as many as seven isolated GPUs for multi-tenant serving.",
      specs: [
        { label: "Scheduling unit", value: "thread block / cluster" },
        { label: "MIG", value: "up to 7 instances" },
      ],
      pipeline: "Sits between the host interface and the GPCs; every kernel launch passes through it.",
      programming: "CUDA streams and grid launches are mediated here; concurrent kernels and async memcpy overlap depend on its scheduling.",
    },
    media: {
      name: "Media engines",
      type: "Fixed function",
      role: "Seven NVDEC video decoders and seven NVJPG JPEG engines, with no encoder at all. The asymmetry describes the customer: inference farms ingest oceans of video and images, so decode gets silicon, while output is tokens and tensors, so encode gets none. DALI-style pipelines decode straight into HBM where the SMs pick frames up without a host round trip.",
      specs: [
        { label: "NVDEC", value: "7" },
        { label: "NVJPG", value: "7" },
        { label: "NVENC", value: "none" },
      ],
      pipeline: "Decode output lands in HBM for consumption by SMs without round-tripping to the host.",
    },
  },
}
