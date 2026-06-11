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
      role: "The die that started the tensor-core era, and at 815 mm² the largest chip TSMC had built at the time, pressed against the reticle limit of the lithography tools. 21.1 billion transistors on 12FFN, a 16 nm process tuned for NVIDIA. The bet was that deep learning justified hardwiring one operation: 640 Tensor Cores that multiply small matrices in fixed function, lifting FP16 training throughput to 125 TFLOPS, 8× the FP32 rate. V100 enables 80 of the 84 physical SMs for yield. GV100 also kept a full graphics pipeline (it sold as a Quadro as well), which its compute-only successors dropped. Floorplan is schematic; proportions approximate.",
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
      programming: "Compile with -arch=sm_70. Volta gave every thread its own program counter (independent thread scheduling), which fixed deadlocks in divergent code and quietly broke a decade of warp-synchronous tricks. The first-generation Tensor Cores multiply FP16 matrices with FP32 accumulation.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "One of six clusters the die's SMs are grouped into, each holding 7 TPCs (14 SMs) plus a raster engine, because GV100 still does graphics. A GPC works like a small GPU inside the GPU: it has its own work distribution that drops incoming thread blocks onto whichever of its SMs currently have room.",
      specs: [
        { label: "Count", value: "6" },
        { label: "TPCs per GPC", value: "6-7 enabled (7 physical)" },
        { label: "SMs per GPC", value: "12-14" },
      ],
      pipeline: "GigaThread Engine balances across GPCs; per-GPC distributor feeds SMs.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "A packaging unit of two SMs sharing texture hardware, front-end plumbing and the PolyMorph geometry engine. Software never sees the TPC, but manufacturing does: when a defect lands in this area of silicon, NVIDIA fuses off the whole TPC, and V100 ships with 2 of its 42 dark. The hatched blocks here are representative; the real fused positions vary chip to chip.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "40 of 42" },
      ],
      pipeline: "Between GPC work distribution and SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "The first SM with Tensor Cores, and the template every later NVIDIA compute die refined. It splits into four partitions, each with its own warp scheduler, a 64 KB register file slice, 16 FP32, 16 INT32 and 8 FP64 lanes, and two first-generation Tensor Cores computing 4×4×4 FP16 multiplies with FP32 accumulation. Volta also separated the INT32 pipe from FP32, so the address arithmetic that precedes every load runs alongside the math instead of stealing its issue slots.",
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
      programming: "sm_70 made warp-synchronous programming unsafe: threads in a warp no longer move in lockstep, so __syncwarp() and the *_sync intrinsics became mandatory. The original WMMA API exposes the Tensor Cores in 16×16×16 tiles.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A single 6 MB pool in the middle of the die where everything meets: misses from all 80 SMs, every global atomic, all traffic to and from HBM. It is tiny by modern standards (A100 grew it 6.7× three years later), so GV100 leaned on the raw HBM2 bandwidth behind it to make up the difference. The ROPs partner with the L2 slices because this die still renders pixels.",
      specs: [
        { label: "Capacity", value: "6 MB" },
        { label: "ROPs", value: "128 (graphics SKUs)" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "Backstop for L1 misses; staging for HBM2 controllers.",
    },
    hbm: {
      name: "HBM2 stack + memory controllers",
      type: "Memory interface",
      role: "Four HBM2 stacks sit beside the die on a silicon interposer (CoWoS), wired up by eight 512-bit controllers into a 4096-bit bus. That width is absurd next to the 384-bit buses of contemporary GDDR cards, and it is how 900 GB/s was possible at sane power in 2017. All four stacks ship enabled; the 16 GB and 32 GB variants differ only in stack height.",
      specs: [
        { label: "Stacks", value: "4 of 4" },
        { label: "Controllers", value: "8 × 512-bit" },
        { label: "Capacity", value: "16 / 32 GB" },
        { label: "Bandwidth", value: "900 GB/s" },
        { label: "ECC", value: "SECDED" },
      ],
      pipeline: "Terminal memory level; L2 misses land here.",
      programming: "Global memory; coalescing across 32-byte sectors required for peak bandwidth.",
    },
    nvlink: {
      name: "NVLink 2",
      type: "Interconnect",
      role: "Six NVLink 2 links at 25 GB/s per direction, 300 GB/s aggregate, NVIDIA's answer to the awkward fact that PCIe Gen3 ran 30× slower than local HBM. In a DGX-1V the six links weave eight GPUs into a hybrid cube mesh. On IBM POWER9 systems the same links connect CPU to GPU with cache coherence, which PCIe of that era could not offer at all.",
      specs: [
        { label: "Links", value: "6 × 50 GB/s bidir" },
        { label: "Aggregate", value: "300 GB/s" },
        { label: "Topology", value: "hybrid cube mesh (DGX-1V)" },
      ],
      pipeline: "Peer traffic bypasses PCIe; CPU-coherent on POWER9.",
      programming: "Peer access and NCCL rings; the cube mesh made ring all-reduce the canonical V100 collective.",
    },
    pcie: {
      name: "PCIe Gen3 host interface",
      type: "Interconnect",
      role: "Sixteen lanes of PCIe Gen3 at 16 GB/s per direction: the host front door, and by 2017 the slowest wire on the board. The gulf between this link and the 900 GB/s of local HBM is the entire reason NVLink exists.",
      specs: [
        { label: "Link", value: "Gen3 ×16" },
        { label: "Bandwidth", value: "~32 GB/s bidir" },
      ],
      pipeline: "Command submission and host copies enter here.",
    },
    front: {
      name: "GigaThread Engine + copy engines",
      type: "Front end",
      role: "The die-level scheduler. Every kernel launch becomes a stream of thread blocks that the GigaThread Engine deals out across the six GPCs as space frees up. Volta taught it to preempt running compute at instruction granularity, so a long kernel can be suspended mid-flight. The copy engines beside it run DMA transfers concurrently with kernels, which is what makes overlapped cudaMemcpyAsync actually overlap.",
      specs: [{ label: "Scheduling unit", value: "thread block" }],
      pipeline: "Every kernel launch passes through it to the GPCs.",
    },
    media: {
      name: "Video engines",
      type: "Fixed function",
      role: "Hardware video encode and decode inherited from the graphics lineage, since GV100 also sold as a Quadro workstation card. On datacenter V100s these engines mostly transcode and decode video streams that inference kernels then consume from memory.",
      specs: [
        { label: "NVENC", value: "yes" },
        { label: "NVDEC", value: "yes" },
      ],
      pipeline: "Decode output lands in HBM2 for SM consumption.",
    },
  },
}
