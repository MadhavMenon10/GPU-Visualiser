import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 330
const H = 250

// 108 SMs: whitepaper says "7 GPCs, 7 or 8 TPCs/GPC"; exact split approx, 8th GPC fused
const GPC_TPCS = [8, 8, 8, 8, 8, 7, 7, 0]

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
  for (const c of tile(8, 4, 1.5, 6.5, w - 3, h - 8, 1.2)) {
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
  kids.push(blk("pcie", "interconnect", 173, 3, 86, 11, { label: "PCIe Gen4 ×16", doc: "pcie" }))
  kids.push(blk("media", "media", 262, 3, 46, 11, { label: "5× NVDEC · 1× NVJPG", doc: "media" }))

  vstack(3, 3, 18, 16, H - 36, 4).forEach((c) => {
    kids.push(blk(`hbm-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "HBM2e", doc: "hbm" }))
  })
  vstack(3, W - 19, 18, 16, H - 36, 4).forEach((c) => {
    kids.push(
      blk(`hbm-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, {
        label: "HBM2e",
        doc: "hbm",
        disabled: c.i === 2, // 5 of 6 stacks enabled; dark site varies per part; approx
      }),
    )
  })

  tile(4, 4, 22, 16, 286, 91, 3).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(4, 4, 22, 143, 286, 91, 3).forEach((c) => kids.push(gpc(c.i + 4, c.x, c.y, c.w, c.h)))

  kids.push(blk("l2-0", "cache", 22, 110, 140.5, 30, { label: "L2 CACHE · 20 MB PARTITION", doc: "l2" }))
  kids.push(blk("l2-1", "cache", 167.5, 110, 140.5, 30, { label: "L2 CACHE · 20 MB PARTITION", doc: "l2" }))

  const nv = blk("nvlink", "interconnect", 22, H - 13, 286, 10, { doc: "nvlink", children: [] })
  hstack(12, 1, 1, 284, 8, 1).forEach((c) => {
    nv.children!.push(blk(`nvlink/${c.i}`, "interconnect", c.x, c.y, c.w, c.h, { doc: "nvlink" }))
  })
  kids.push(nv)
  kids.push(blk("nvlink-label", "group", 22, H - 13, 286, 10, { label: "NVLINK 3 · 12 LINKS", labelPos: "tl", doc: "nvlink" }))

  return blk("die", "die", 0, 0, W, H, { label: "GA100", doc: "die", children: kids })
}

export const a100: Gpu = {
  id: "a100",
  vendor: "NVIDIA",
  name: "A100 SXM4 80GB",
  die: "GA100",
  arch: "Ampere",
  isa: "sm_80",
  process: "TSMC N7",
  floorplan,
  docs: {
    die: {
      name: "GA100 (A100 SXM4)",
      type: "Die overview",
      role: "The die that carried deep learning through the GPT-3 era: 826 mm² on TSMC N7 and 54.2 billion transistors, the largest 7 nm chip in production at launch. The A100 product enables 108 of the 128 physical SMs across 7 of 8 GPCs, plus 5 of 6 HBM2e stacks; the dark units are yield fuses whose physical positions vary per die. Ampere's feature list reads like the things ML programmers now take for granted: TF32 so existing FP32 code got tensor speed without edits, structured sparsity, asynchronous copy, and MIG for slicing one GPU into seven. Floorplan is schematic: placement follows the published organization, proportions approximate.",
      specs: [
        { label: "Process", value: "TSMC N7" },
        { label: "Transistors", value: "54.2 B" },
        { label: "Die size", value: "826 mm²" },
        { label: "SMs", value: "108 (128 on full die)" },
        { label: "FP32 cores", value: "6 912" },
        { label: "Tensor Cores", value: "432 (3rd gen)" },
        { label: "L2 cache", value: "40 MB (2 partitions)" },
        { label: "Memory", value: "80 GB HBM2e, 5120-bit" },
        { label: "Mem bandwidth", value: "2 039 GB/s" },
        { label: "Boost clock", value: "1.41 GHz" },
        { label: "FP32 / FP64", value: "19.5 / 9.7 TFLOPS" },
        { label: "TF32 Tensor", value: "156 TFLOPS (312 sparse)" },
        { label: "FP16 Tensor", value: "312 TFLOPS (624 sparse)" },
        { label: "NVLink", value: "Gen3, 12 links, 600 GB/s" },
        { label: "TDP", value: "400 W" },
      ],
      pipeline: "Host work enters over PCIe Gen4, the GigaThread Engine distributes thread blocks to SMs in the 7 active GPCs, and memory traffic drains through the two-partition L2 to the HBM2e controllers on the die edges.",
      programming: "Compile with -arch=sm_80. cp.async copies global memory into shared memory without staging through registers, the primitive modern attention kernels are built on. TF32 runs by default in cuBLAS/cuDNN matmuls, and L2 residency windows first appeared here.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "Top-level compute partition: up to 8 TPCs (16 SMs) with its own work distribution, and no raster hardware anywhere, since GA100 never renders a pixel. A100 ships with one entire GPC fused dark, drawn here as the solid hatched block. The GPC is also the unit MIG thinks in: an isolated instance is assembled from whole GPCs plus dedicated L2 and DRAM slices, which is how seven tenants can share one die without touching each other's bandwidth.",
      specs: [
        { label: "Count", value: "7 enabled (8 physical)" },
        { label: "TPCs per GPC", value: "7-8 enabled (8 physical)" },
        { label: "SMs per GPC", value: "14-16" },
        { label: "MIG", value: "1 GPC ≈ 1/7 instance" },
      ],
      pipeline: "GigaThread Engine load-balances across GPCs; a per-GPC distributor assigns blocks to SMs.",
      programming: "A MIG instance is built from whole GPCs plus dedicated L2/DRAM slices, giving hardware QoS isolation between tenants.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "A pair of SMs sharing front-end plumbing, purely organizational on this die now that the graphics pipeline is gone. It earns its place at manufacturing time: a defect takes out the whole TPC rather than the die, and A100 ships with 54 of 64 alive. Hatching marks fused pairs; the real positions vary chip to chip.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "54 of 64" },
      ],
      pipeline: "Pass-through between GPC work distribution and the SMs.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each holding a warp scheduler, a 64 KB register file slice, 16 FP32, 16 INT32 and 8 FP64 lanes, and one 3rd-gen Tensor Core. This Tensor Core generation is where the format menu widened: TF32 keeps FP32's range with a 10-bit mantissa so legacy float code gets tensor throughput unmodified, BF16 arrives, FP64 matrix math serves the HPC crowd, and 2:4 structured sparsity doubles throughput when half the weights are zero in the right pattern. Asynchronous copy lets data stream from HBM into shared memory while the warps keep computing over the previous tile.",
      specs: [
        { label: "Count", value: "108" },
        { label: "FP32 / INT32 / FP64", value: "64 / 64 / 32 per SM" },
        { label: "Tensor Cores", value: "4 × 3rd gen (TF32/BF16/FP64)" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "192 KB combined, ≤164 KB shared" },
        { label: "Warp schedulers", value: "4" },
        { label: "Max occupancy", value: "64 warps · 2048 threads" },
      ],
      pipeline: "Thread blocks arrive from GPC distribution; warps issue to partition pipelines; LSU traffic flows L1 → L2 partition → HBM2e.",
      programming: "One thread block per SM; TF32 is the default for cuDNN/cuBLAS matmul on sm_80 unless disabled. cp.async enables the shared-memory pipelining patterns that became standard in attention kernels.",
    },
    l2: {
      name: "L2 cache partition",
      type: "Cache",
      role: "Two 20 MB partitions joined by a crossbar, 40 MB in all, a 6.7× jump over V100's 6 MB. The jump changed how kernels get written: entire activation tensors could suddenly stay on-die between layers instead of round-tripping to HBM. Each partition fronts the HBM controllers on its half of the die. Software can pin hot address ranges into residency, the hardware compresses compute data on the way through, and MIG slices this cache along with everything else.",
      specs: [
        { label: "Capacity", value: "40 MB (48 MB full die)" },
        { label: "Partitions", value: "2 × 20 MB" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "Backstop for all SM L1 misses; global atomics resolve here.",
      programming: "cudaAccessPolicyWindow (new in sm_80) pins hot ranges; MIG carves L2 slices per instance.",
    },
    hbm: {
      name: "HBM2e stack + memory controllers",
      type: "Memory interface",
      role: "Six HBM2e sites surround the die on a CoWoS interposer, each stack driven by two 512-bit controllers. The 80 GB A100 enables five stacks and ten controllers, a 5120-bit bus pushing just over 2 TB/s. One site is dark for yield (hatched; its physical position varies per part). That 2 TB/s was the real headline of the product: scaling compute is the easy half of the problem, and feeding it is what the interposer, the stacks and the bus width are all paying for.",
      specs: [
        { label: "Stacks", value: "5 of 6 enabled" },
        { label: "Controllers", value: "10 × 512-bit" },
        { label: "Capacity", value: "80 GB" },
        { label: "Bandwidth", value: "2 039 GB/s" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "Services L2 partition misses; addresses interleave across stacks.",
      programming: "cudaMalloc allocations live here; 32-byte sector coalescing governs achievable bandwidth.",
    },
    nvlink: {
      name: "NVLink 3",
      type: "Interconnect",
      role: "Twelve NVLink 3 links at 25 GB/s per direction, 600 GB/s aggregate, double what V100 carried. In DGX and HGX systems all twelve links run into NVSwitch chips, so all eight GPUs converse at full bandwidth simultaneously instead of sharing a ring. That topology change is a large part of why all-reduce stopped being the bottleneck of large-scale training on this generation.",
      specs: [
        { label: "Links", value: "12 × 50 GB/s bidir" },
        { label: "Aggregate", value: "600 GB/s" },
        { label: "Fabric", value: "NVSwitch 2" },
      ],
      pipeline: "Peer GPU traffic moves L2-to-L2 without touching host memory.",
      programming: "cudaDeviceEnablePeerAccess, NCCL collectives, GPUDirect P2P.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "Sixteen lanes of PCIe Gen4 at 32 GB/s per direction, carrying command submission, host copies, and the GPUDirect paths that let NICs and NVMe drives deposit data into HBM without the CPU ever touching it.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "Entry point for all host-originated work.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "The global scheduler. Grid launches become streams of thread blocks dealt out across the seven active GPCs, with context switching and preemption when something has to yield. This block also hosts the MIG hardware that splits GA100 into up to seven isolated instances, each with its own SMs, L2 slices and DRAM bandwidth, an isolation enforced in silicon rather than by the driver. The copy engines alongside run DMA transfers concurrently with kernels.",
      specs: [
        { label: "Scheduling unit", value: "thread block" },
        { label: "MIG", value: "up to 7 instances" },
      ],
      pipeline: "Between the host interface and GPCs; every launch passes through.",
      programming: "Streams map to hardware queues here; MIG instances appear as separate CUDA devices.",
    },
    media: {
      name: "Media engines",
      type: "Fixed function",
      role: "Five NVDEC decoders and one NVJPG JPEG engine, with no encoder. The silicon follows the traffic: an inference fleet doing video analytics decodes constantly and encodes nearly never. DALI pipelines decode datasets straight into HBM where the SMs consume them.",
      specs: [
        { label: "NVDEC", value: "5" },
        { label: "NVJPG", value: "1" },
        { label: "NVENC", value: "none" },
      ],
      pipeline: "Decodes land in HBM for direct SM consumption.",
    },
  },
}
