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
      role: "GV100 measures 815 mm² on TSMC 12FFN and carries 21.1 billion transistors. It was the largest die at its launch and the first GPU to include Tensor Cores. V100 ships with 80 of 84 SMs active. Flaws are inevitable when manufacturing a die this large, so NVIDIA sells parts with some units disabled rather than discarding the silicon, and the disabled positions vary from die to die.",
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
      pipeline: "Work arrives over PCIe Gen3 or NVLink, is queued by the GigaThread Engine, and distributed as thread blocks to SMs inside the 6 GPCs. Load and store instructions from warps flow through the SM L1 to the 6 MB L2, then out to the HBM2 controllers on the die edges.",
      programming: "Code is compiled with -arch=sm_70. Volta introduced independent thread scheduling, meaning each thread in a warp has its own program counter rather than all threads sharing one. Before this, threads in a warp were always at the same instruction, which caused deadlocks if different threads tried to synchronize with each other inside the warp. With independent scheduling that is no longer guaranteed, so existing code that relied on warp-synchronous behavior needs __syncwarp() and the _sync intrinsic variants. First-generation Tensor Cores compute FP16 matrix multiplications with FP32 accumulation, using 16×16×16 tiles exposed through WMMA.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "The top-level compute partition contains up to 7 TPCs, which amounts to 14 SMs since each TPC holds two. GV100 retains a full graphics pipeline, so each GPC also includes a raster engine, which converts 3D triangles into 2D pixel fragments that shaders can process, and a local work distributor that assigns thread blocks to SMs with free capacity. Two GPCs run six TPCs each because those positions are disabled for yield, leaving 40 of 42 TPCs active across the six GPCs.",
      specs: [
        { label: "Count", value: "6" },
        { label: "TPCs per GPC", value: "6-7 enabled (7 physical)" },
        { label: "SMs per GPC", value: "12-14" },
      ],
      pipeline: "The GigaThread Engine balances work across GPCs. A per-GPC distributor then assigns thread blocks to individual SMs.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs share texture hardware, instruction fetch and dispatch circuits, and the PolyMorph geometry engine, which handles vertex fetch, tessellation and viewport transform for graphics workloads. Flaws are inevitable at the scale GV100 is manufactured, so NVIDIA sells parts with some TPCs disabled rather than discarding the silicon. 40 of the 42 physical TPCs are active on V100, and the disabled positions vary from die to die.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "40 of 42" },
      ],
      pipeline: "A pass-through level between GPC work distribution and the SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each with a warp scheduler, a 64 KB register file slice, 16 FP32, 16 INT32 and 8 FP64 lanes, and two first-generation Tensor Cores. Previously, integer address arithmetic and floating-point operations shared the same execution lane and could not issue in the same clock cycle. Volta gave INT32 its own separate pipe, so both can issue simultaneously. Each thread also gets its own program counter, removing the divergence-induced deadlock that earlier architectures could produce.",
      specs: [
        { label: "Count", value: "80" },
        { label: "FP32 / INT32 / FP64", value: "64 / 64 / 32 per SM" },
        { label: "Tensor Cores", value: "8 × 1st gen (FP16→FP32)" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤96 KB shared" },
        { label: "Warp schedulers", value: "4" },
        { label: "Max occupancy", value: "64 warps · 2048 threads" },
      ],
      pipeline: "The SM receives thread blocks from the GPC distributor. Each block is divided into 32-thread warps, which the warp schedulers issue onto the execution pipelines. Load and store traffic flows through the L1, then the L2, and out to HBM2.",
      programming: "One thread block executes on exactly one SM. Declaring a variable __shared__ places it in the L1 carveout, where all threads in the block can reach it at on-chip latency. sm_70 requires __syncwarp() after any operation where one thread reads a value another thread wrote, because threads no longer implicitly synchronize at each instruction. WMMA, the Warp Matrix Multiply-Accumulate API, exposes the Tensor Cores in CUDA. The entire 32-thread warp cooperates to compute one 16×16×16 matrix tile, with each thread holding a fragment of the input and output matrices.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A single 6 MB L2 serves all 80 SMs. Every L1 miss, global atomic and HBM transfer passes through it. The capacity is small relative to later generations, and the 900 GB/s HBM2 bandwidth compensates for the higher miss rate. GV100 retains a full graphics pipeline, and the ROPs, the fixed-function units that perform depth testing and pixel blending at the end of the 3D pipeline, are co-located with the L2 slices so that final pixel writes flow directly into the cache.",
      specs: [
        { label: "Capacity", value: "6 MB" },
        { label: "ROPs", value: "128 (graphics SKUs)" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "When an SM's L1 cache cannot satisfy a load or store, the request travels to the L2. Atomic operations issued by multiple SMs on the same address are also arbitrated here rather than going out to HBM2.",
    },
    hbm: {
      name: "HBM2 stack + memory controllers",
      type: "Memory interface",
      role: "HBM2 stacks multiple DRAM dies vertically and connects them with thousands of short vertical wires called through-silicon vias, giving far more parallel data paths than a conventional circuit board allows. The stacks and the GPU die sit together on a CoWoS interposer, a slab of silicon that carries the wiring between them, because silicon can be patterned with much finer wires than an ordinary package. Four stacks are present, each driven by two 512-bit memory controllers. All four are populated, running eight controllers in parallel for a combined 4096-bit path into memory. The four stacks together provide 16 or 32 GB depending on stack height, and the GPU can read and write that memory at up to 900 GB/s. The PHYs, the analog circuits that drive signals off the die, sit at the edges to keep the wires to the stacks short.",
      specs: [
        { label: "Stacks", value: "4 of 4" },
        { label: "Controllers", value: "8 × 512-bit" },
        { label: "Capacity", value: "16 / 32 GB" },
        { label: "Bandwidth", value: "900 GB/s" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "The last level of the memory hierarchy, where L2 misses are serviced. The controllers interleave addresses so contiguous data spreads across all four stacks.",
      programming: "Global memory allocated with cudaMalloc resides here. When the 32 threads of a warp read addresses that fall within the same cache line, the hardware issues one memory transaction for the whole warp, a pattern called coalescing. Scattered addresses each require their own transaction and waste most of the bandwidth they occupy.",
    },
    nvlink: {
      name: "NVLink 2",
      type: "Interconnect",
      role: "Six NVLink 2 links, each carrying 25 GB/s in each direction, which is 50 GB/s of bidirectional bandwidth per link and 300 GB/s summed across all six. DGX-1V arranges eight GPUs in a hybrid cube mesh over these links. On POWER9 systems NVLink also provides a cache-coherent CPU-to-GPU attachment, letting the CPU and GPU share a unified address space.",
      specs: [
        { label: "Links", value: "6 × 50 GB/s bidir" },
        { label: "Aggregate", value: "300 GB/s" },
        { label: "Topology", value: "hybrid cube mesh (DGX-1V)" },
      ],
      pipeline: "Peer traffic bypasses PCIe entirely. Remote loads and stores move directly between GPU HBM regions.",
      programming: "Enabled via cudaDeviceEnablePeerAccess and NCCL. The cube mesh topology made ring all-reduce the standard V100 collective pattern.",
    },
    pcie: {
      name: "PCIe Gen3 host interface",
      type: "Interconnect",
      role: "An x16 PCIe Gen3 link to the host CPU, which moves 16 GB/s in each direction for 32 GB/s of bidirectional bandwidth. It carries command submissions and host memory copies.",
      specs: [
        { label: "Link", value: "Gen3 ×16" },
        { label: "Bandwidth", value: "~32 GB/s bidir" },
      ],
      pipeline: "The entry point for all host-originated work.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "Receives kernel launches from the host and distributes thread blocks across the six GPCs, tracking which SMs have free capacity. Volta introduced compute preemption at instruction granularity, meaning a running kernel can be interrupted between any two instructions rather than only at kernel boundaries, so urgent work does not wait behind a long one. Copy engines handle DMA transfers in parallel with kernels. DMA, Direct Memory Access, lets dedicated hardware copy data between host and device memory without involving the CPU or the SMs, so the GPU can load the next batch while it computes on the current one.",
      specs: [{ label: "Scheduling unit", value: "thread block" }],
      pipeline: "It sits between the host interface and the GPCs, and every kernel launch passes through it.",
    },
    media: {
      name: "Video engines",
      type: "Fixed function",
      role: "NVENC and NVDEC blocks retained from the graphics lineage. On datacenter V100s these fixed-function circuits handle video transcode and decode for inference input pipelines, leaving the SMs free for the model itself. Decoded output is written directly to HBM for SM consumption.",
      specs: [
        { label: "NVENC", value: "yes" },
        { label: "NVDEC", value: "yes" },
      ],
      pipeline: "Decoded output lands in HBM without passing back through the host.",
    },
  },
}
