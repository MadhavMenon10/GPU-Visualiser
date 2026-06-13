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
      role: "GA100 measures 826 mm² on TSMC N7 and carries 54.2 billion transistors, making it the largest 7 nm die in production at launch. A100 ships with 108 of 128 SMs active across 7 of 8 GPCs, and 5 of 6 HBM2e stacks populated. Flaws are inevitable when manufacturing a die this large, so NVIDIA sells parts with some units disabled rather than discarding the silicon, and the disabled positions vary from die to die.",
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
      programming: "Code is compiled with -arch=sm_80. TF32, short for TensorFloat-32, keeps FP32's numeric range but reduces the mantissa from 23 bits to 10. The narrower mantissa lets the Tensor Cores run faster, and cuBLAS and cuDNN use it as the default matrix format without any code changes required. BF16, Brain Float 16, is a 16-bit format that keeps the same 8-bit exponent as FP32, meaning it represents values across the same range as FP32 while using only half the storage. That preserved range boosts training stability, making BF16 a common alternative to FP16 for gradient accumulation. The cp.async instruction is used in the double-buffered shared memory pattern, where one tile is being processed while the next is already transferring from global memory into shared memory in parallel. L2 residency windows, which let software pin a frequently accessed address range so streaming traffic cannot displace it, appear for the first time in this generation.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "The top-level compute partition contains up to 8 TPCs, which amounts to 16 SMs since each TPC holds two. GA100 has no graphics pipeline, so each GPC contains only compute resources and a local distributor that assigns incoming thread blocks to SMs with free capacity. One full GPC is disabled on A100, shown as the hatched block in the floorplan. MIG, Multi-Instance GPU, divides the device along GPC boundaries and gives each tenant dedicated compute, L2 and DRAM slices with hardware-enforced isolation, so one tenant's workload cannot slow or observe another.",
      specs: [
        { label: "Count", value: "7 enabled (8 physical)" },
        { label: "TPCs per GPC", value: "7-8 enabled (8 physical)" },
        { label: "SMs per GPC", value: "14-16" },
        { label: "MIG", value: "1 GPC ≈ 1/7 instance" },
      ],
      pipeline: "The GigaThread Engine balances work across GPCs. A per-GPC distributor then assigns thread blocks to individual SMs.",
      programming: "A MIG instance is assembled from one or more whole GPCs with matching L2 and DRAM slices. Each instance appears as a separate CUDA device to the application.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs share a texture unit and the per-TPC instruction fetch and dispatch circuits. Flaws are inevitable at the scale GA100 is manufactured, so NVIDIA sells parts with some TPCs disabled rather than discarding the silicon. 54 of the 64 physical TPCs are active on A100, and the disabled positions vary from die to die.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "54 of 64" },
      ],
      pipeline: "A pass-through level between GPC work distribution and the SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each with a warp scheduler, a 64 KB register file slice, 16 FP32, 16 INT32 and 8 FP64 lanes, and one third-generation Tensor Core. This generation added TF32 (FP32 range, 10-bit mantissa, usable by unmodified FP32 code), BF16, FP64 matrix arithmetic, and 2:4 structured sparsity, which doubles Tensor Core throughput when weights are pruned so that two of every four are zero. Asynchronous copy overlaps HBM-to-shared-memory transfers with computation.",
      specs: [
        { label: "Count", value: "108" },
        { label: "FP32 / INT32 / FP64", value: "64 / 64 / 32 per SM" },
        { label: "Tensor Cores", value: "4 × 3rd gen (TF32/BF16/FP64)" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "192 KB combined, ≤164 KB shared" },
        { label: "Warp schedulers", value: "4" },
        { label: "Max occupancy", value: "64 warps · 2048 threads" },
      ],
      pipeline: "The SM receives thread blocks from the GPC distributor. Each block is divided into 32-thread warps, which the warp schedulers issue onto the execution pipelines. Load and store traffic flows through the L1, then the L2 partition, and out to HBM2e.",
      programming: "One thread block executes on exactly one SM. TF32 is the default for cuDNN and cuBLAS matrix operations on sm_80 and can be disabled with CUBLAS_MATH_DISALLOW_TF32 if full FP32 precision is required. The cp.async instruction is used in the double-buffered shared memory pattern, where one tile is being processed while the next is already transferring from global memory into shared memory in parallel.",
    },
    l2: {
      name: "L2 cache partition",
      type: "Cache",
      role: "The cache is split into two 20 MB partitions joined by a crossbar, with each partition serving the HBM controllers on its half of the die. At 40 MB total it is 6.7 times the size of V100's L2, large enough to keep the activation tensors of typical layer sizes on-die between consecutive kernels rather than sending them back to HBM. Residency control lets software mark a hot address range as persistent so streaming traffic cannot evict it, which benefits weights that are reread every iteration. The cache also compresses zero-heavy data on writes, increasing effective capacity and bandwidth for sparse models. Under MIG each instance receives a dedicated slice.",
      specs: [
        { label: "Capacity", value: "40 MB (48 MB full die)" },
        { label: "Partitions", value: "2 × 20 MB" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "When an SM's L1 cache cannot satisfy a load or store, the request travels to the L2 partition that owns the target address. Atomic operations issued by multiple SMs on the same address are also arbitrated here rather than going out to HBM.",
      programming: "cudaAccessPolicyWindow, introduced in sm_80, pins a specified address range as persistent in the L2. Data in that range will not be evicted by streaming traffic, which makes it useful for model weights that are reread every kernel launch. Each MIG instance gets a dedicated L2 slice, so one tenant's cache pressure cannot affect another's.",
    },
    hbm: {
      name: "HBM2e stack + memory controllers",
      type: "Memory interface",
      role: "HBM2e stacks multiple DRAM dies vertically and connects them with thousands of short vertical wires called through-silicon vias, giving far more parallel data paths than a conventional circuit board allows. The stacks and the GPU die sit together on a CoWoS interposer, a slab of silicon that carries the wiring between them, because silicon can be patterned with much finer wires than an ordinary package. Each edge site holds one HBM2e stack driven by two 512-bit memory controllers. The 80 GB product populates five of the six sites, so ten controllers run in parallel and their widths sum to a 5120-bit path into memory. The five stacks together provide 80 GB of capacity, and the GPU can read and write that memory at up to 2039 GB/s. One site is left disabled for yield and its position varies per part. The PHYs, the analog circuits that drive signals off the die, sit at the edges to keep the wires to the stacks short.",
      specs: [
        { label: "Stacks", value: "5 of 6 enabled" },
        { label: "Controllers", value: "10 × 512-bit" },
        { label: "Capacity", value: "80 GB" },
        { label: "Bandwidth", value: "2 039 GB/s" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "The last level of the memory hierarchy, where L2 partition misses are serviced. The controllers interleave addresses so contiguous data spreads across all five stacks.",
      programming: "Global memory allocated with cudaMalloc resides here. When the 32 threads of a warp read addresses that fall within the same cache line, the hardware issues one memory transaction for the whole warp, a pattern called coalescing. Scattered addresses each require their own transaction and waste most of the bandwidth they occupy.",
    },
    nvlink: {
      name: "NVLink 3",
      type: "Interconnect",
      role: "Twelve NVLink 3 links, each carrying 25 GB/s in each direction, which is 50 GB/s of bidirectional bandwidth per link and 600 GB/s summed across all twelve. In DGX and HGX systems all twelve links connect to NVSwitch, a separate switch chip on the server board that connects all eight GPUs. Through it any GPU can read or write any other GPU's HBM with ordinary load and store instructions rather than explicit copy calls.",
      specs: [
        { label: "Links", value: "12 × 50 GB/s bidir" },
        { label: "Aggregate", value: "600 GB/s" },
        { label: "Fabric", value: "NVSwitch 2" },
      ],
      pipeline: "Peer traffic bypasses PCIe entirely. Remote loads, stores and NCCL collectives move from one GPU's L2 to another's.",
      programming: "Enabled via cudaDeviceEnablePeerAccess and NCCL. GPUDirect P2P lets two A100s transfer data between their HBM allocations without a CPU copy.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "An x16 PCIe Gen4 link to the host CPU, moving 32 GB/s in each direction for 64 GB/s of bidirectional bandwidth. It carries command submissions, host memory copies, GPUDirect RDMA which lets network adapters write straight into HBM, and GPUDirect Storage which lets NVMe drives do the same, all without the CPU staging data through system memory.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "The entry point for all host-originated work.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "Receives kernel launches from the host and distributes thread blocks across the seven active GPCs, tracking which SMs have free capacity. Context switching lets multiple processes share the GPU by saving and restoring kernel state. Preemption allows a running kernel to be interrupted at instruction boundaries rather than only at completion, so urgent work does not wait behind a long one. Copy engines run DMA transfers in parallel with kernels. MIG partitions the device in hardware, and up to seven tenants each receive a fixed allocation of SMs, L2 and HBM that no other tenant can access or observe.",
      specs: [
        { label: "Scheduling unit", value: "thread block" },
        { label: "MIG", value: "up to 7 instances" },
      ],
      pipeline: "It sits between the host interface and the GPCs, and every kernel launch passes through it.",
      programming: "CUDA streams map to hardware queues here. MIG instances appear as separate CUDA devices to the driver and runtime.",
    },
    media: {
      name: "Media engines",
      type: "Fixed function",
      role: "Five NVDEC video decoders and one NVJPG JPEG decoder. These fixed-function circuits decompress data far more efficiently than the same work running on SMs, leaving the SMs free for inference. The count reflects inference ingest workloads, where images and video arrive encoded and must be decoded before the model processes them. Decoded output is written directly to HBM.",
      specs: [
        { label: "NVDEC", value: "5" },
        { label: "NVJPG", value: "1" },
        { label: "NVENC", value: "none" },
      ],
      pipeline: "Decoded output lands in HBM without passing back through the host.",
    },
  },
}
