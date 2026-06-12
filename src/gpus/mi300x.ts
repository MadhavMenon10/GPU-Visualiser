import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 320
const H = 264

function xcd(id: string, label: string, x: number, y: number, w: number, h: number): Block {
  const g = blk(id, "group", x, y, w, h, { label, labelPos: "tl", doc: "xcd", children: [] })
  g.children!.push(blk(`${id}/l2`, "cache", 1.5, 5.5, w - 3, 4, { label: "L2 · 4 MB", doc: "l2" }))
  for (const c of tile(40, 5, 1.5, 10.5, w - 3, h - 12, 0.8)) {
    g.children!.push(
      blk(`${id}/cu${c.i}`, "compute", c.x, c.y, c.w, c.h, {
        label: "CU",
        doc: "cu",
        disabled: c.i >= 38, // 38 of 40 CUs active per XCD; fused positions vary; approx
      }),
    )
  }
  return g
}

function iod(i: number, x: number, y: number, w: number, h: number): Block {
  const g = blk(`iod${i}`, "group", x, y, w, h, { label: `IOD${i}`, labelPos: "tl", doc: "iod", children: [] })
  hstack(2, 1.5, 6, w - 3, h - 32.5, 2).forEach((c) => {
    g.children!.push(xcd(`iod${i}/xcd${c.i}`, `XCD${i * 2 + c.i}`, c.x, c.y, c.w, c.h))
  })
  g.children!.push(
    blk(`iod${i}/ic`, "cache", 1.5, h - 24.5, w - 3, 22, {
      label: "INFINITY CACHE 64 MB · INFINITY FABRIC",
      doc: "ic",
    }),
  )
  return g
}

function floorplan(): Block {
  const kids: Block[] = []

  vstack(4, 3, 12, 26, 220, 4).forEach((c) => {
    kids.push(blk(`hbm-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "HBM3 24 GB", doc: "hbm" }))
  })
  vstack(4, W - 29, 12, 26, 220, 4).forEach((c) => {
    kids.push(blk(`hbm-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "HBM3 24 GB", doc: "hbm" }))
  })

  tile(4, 2, 33, 12, 254, 220, 3).forEach((c) => kids.push(iod(c.i, c.x, c.y, c.w, c.h)))

  kids.push(blk("pcie", "interconnect", 33, 236, 60, 14, { label: "PCIe Gen5 ×16", doc: "pcie" }))
  hstack(7, 96, 236, 191, 14, 2).forEach((c) => {
    kids.push(blk(`if${c.i}`, "interconnect", c.x, c.y, c.w, c.h, { label: "IF ×16", doc: "if" }))
  })

  return blk("die", "die", 0, 0, W, H, { label: "MI300X PACKAGE", doc: "die", children: kids })
}

export const mi300x: Gpu = {
  id: "mi300x",
  vendor: "AMD",
  name: "Instinct MI300X",
  die: "Aqua Vanjaram",
  arch: "CDNA 3",
  isa: "gfx942",
  process: "TSMC N5 + N6",
  floorplan,
  docs: {
    die: {
      name: "MI300X (CDNA 3 package)",
      type: "Package overview",
      role: "CDNA 3 accelerator built by 3.5D integration: eight N5 compute dies (XCDs) hybrid-bonded onto four N6 I/O dies, surrounded by eight HBM3 stacks on a CoWoS interposer; 153 billion transistors and approximately 1017 mm² of active silicon. Cache, fabric and memory controllers reside in the base dies, so N5 area is spent almost entirely on compute. The floorplan flattens the stack: each XCD pair is drawn beside the IOD it sits on. View is schematic; proportions approximate.",
      specs: [
        { label: "Chiplets", value: "8× XCD (N5) on 4× IOD (N6)" },
        { label: "Transistors", value: "153 B" },
        { label: "Silicon", value: "~1017 mm² active" }, // approx
        { label: "Compute Units", value: "304 (8 × 38)" },
        { label: "Stream processors", value: "19 456" },
        { label: "Matrix cores", value: "1 216" },
        { label: "Infinity Cache", value: "256 MB" },
        { label: "L2 cache", value: "32 MB (4 MB × 8 XCD)" },
        { label: "Memory", value: "192 GB HBM3, 8192-bit" },
        { label: "Mem bandwidth", value: "5.3 TB/s" },
        { label: "Peak clock", value: "2.1 GHz" },
        { label: "FP64 / FP32", value: "81.7 / 163.4 TFLOPS" },
        { label: "FP16 / FP8", value: "1 307 / 2 615 TFLOPS" },
        { label: "Infinity Fabric", value: "7 × x16 links, 128 GB/s each" },
        { label: "TDP", value: "750 W" },
      ],
      pipeline: "Kernels dispatch through per-XCD command processors and ACEs to the CUs; memory requests flow CU → XCD L2 → Infinity Fabric on the IODs → Infinity Cache → HBM3 controllers adjacent to each stack.",
      programming: "Target gfx942 with ROCm/HIP; wavefronts are 64 lanes. The package presents as one logical GPU (SPX) or as eight per-XCD devices (CPX). Memory interleaves across all eight stacks (NPS1) or binds each quadrant of stacks to its local XCDs (NPS4), trading uniformity for locality.",
    },
    iod: {
      name: "IOD (I/O die)",
      type: "Chiplet",
      role: "Base-layer N6 die. Each carries one quarter of the Infinity Fabric network-on-chip, a 64 MB Infinity Cache slice, the controllers for its two adjacent HBM3 stacks, and external link PHYs. Two XCDs are hybrid-bonded on top at a pitch of approximately 9 µm; a TSV crossing costs far less than a package-level chiplet link. The four IODs form one coherent fabric: any CU reaches any byte of HBM, at lower latency when the address is local.",
      specs: [
        { label: "Count", value: "4" },
        { label: "Process", value: "TSMC N6" },
        { label: "Carries", value: "2 XCDs + 64 MB IC + 2 HBM PHY pairs" },
        { label: "Bonding", value: "SoIC hybrid bond, TSVs" },
      ],
      pipeline: "All XCD memory traffic descends through TSVs into the IOD fabric, which routes each request to local or remote cache and HBM.",
    },
    xcd: {
      name: "XCD (Accelerator Complex Die)",
      type: "Compute chiplet",
      role: "N5 compute die: 40 physical CUs with 38 enabled for yield, a command processor, four asynchronous compute engines, a hardware scheduler, and a shared 4 MB L2. Each XCD fetches, schedules and caches independently, which is what permits per-XCD partitioning in CPX mode. Eight XCDs provide the package's 304 CUs.",
      specs: [
        { label: "Count", value: "8" },
        { label: "CUs", value: "38 enabled of 40" },
        { label: "L2", value: "4 MB shared" },
        { label: "Queues", value: "4 ACEs + HWS per XCD" },
      ],
      pipeline: "Workgroups dispatch from the XCD front end to CUs; L2 misses descend to the IOD fabric below.",
      programming: "In SPX mode workgroups spread across all XCDs transparently; in CPX each XCD is a separate HIP device, which matters for inference sharding.",
    },
    cu: {
      name: "CU (Compute Unit, CDNA 3)",
      type: "Compute unit",
      role: "CDNA 3 compute unit: four SIMD16 vector pipes executing 64-lane wavefronts, full-rate FP64, 64 KB of LDS, and four matrix cores for matrix multiply-accumulate work. CDNA 3 adds the FP8/BF8 and TF32 formats to the matrix cores, along with 2:4 structured sparsity, which doubles matrix throughput when two of every four values are zero. 304 CUs at 2.1 GHz produce 163 TFLOPS FP32, 1.3 PFLOPS FP16 and 2.6 PFLOPS FP8.",
      specs: [
        { label: "Count", value: "304" },
        { label: "Stream processors", value: "64 per CU" },
        { label: "Matrix cores", value: "4 per CU" },
        { label: "LDS", value: "64 KB" },
        { label: "Vector L1", value: "32 KB" },
        { label: "Wavefront", value: "64 lanes" },
      ],
      pipeline: "Executes wave64s from the XCD scheduler; LDS is on-CU, memory ops go L1 → XCD L2 → IOD fabric.",
      programming: "HIP workgroup → CU; __shared__ → LDS. Matrix cores are reached via rocWMMA / MFMA intrinsics or rocBLAS/hipBLASLt.",
    },
    l2: {
      name: "XCD L2 cache",
      type: "Cache",
      role: "4 MB per XCD; the last memory level on the compute die. Coherent within its XCD; cross-XCD sharing is resolved in the Infinity Cache below. A working set contained in one XCD's L2 avoids TSV crossings entirely, so partition-local workloads run at lower memory cost.",
      specs: [
        { label: "Per XCD", value: "4 MB" },
        { label: "Total", value: "32 MB" },
      ],
      pipeline: "Collects CU L1 misses; misses descend via TSVs to the IOD.",
    },
    ic: {
      name: "Infinity Cache + fabric",
      type: "Cache (IOD)",
      role: "Memory-side cache: 64 MB per IOD, 256 MB total, placed directly ahead of the HBM controllers. It holds hot HBM lines regardless of which XCD requested them, so data read by all eight XCDs is fetched from DRAM once. Internal bandwidth is approximately 17 TB/s, roughly 3× the HBM bandwidth.",
      specs: [
        { label: "Per IOD", value: "64 MB" },
        { label: "Total", value: "256 MB" },
        { label: "Peak internal BW", value: "~17 TB/s" }, // approx
      ],
      pipeline: "XCD L2 misses route here; hits avoid the HBM round trip.",
    },
    hbm: {
      name: "HBM3 stack",
      type: "Memory interface",
      role: "Eight 12-high 24 GB HBM3 stacks: 192 GB at 5.3 TB/s. The capacity holds a 70B-parameter FP16 model plus KV cache on a single device, removing the tensor-parallel decomposition such models previously required. Each stack is driven by controllers on its adjacent IOD; the two-stacks-per-IOD placement corresponds to the NPS4 memory quadrants.",
      specs: [
        { label: "Stacks", value: "8 × 24 GB" },
        { label: "Bus", value: "8192-bit total" },
        { label: "Capacity", value: "192 GB" },
        { label: "Bandwidth", value: "5.3 TB/s" },
        { label: "ECC", value: "yes" },
      ],
      pipeline: "Terminal memory level behind the Infinity Cache.",
      programming: "hipMalloc allocations interleave across stacks (NPS1) or bind to quadrants (NPS4) for partition-local bandwidth.",
    },
    if: {
      name: "Infinity Fabric link",
      type: "Interconnect",
      role: "Seven external x16 Infinity Fabric links, 128 GB/s each, 896 GB/s aggregate. Eight MI300X packages on an OAM baseboard form a full mesh, every GPU one hop from every other, with no switch hardware. RCCL collectives and peer transfers traverse these links.",
      specs: [
        { label: "Links", value: "7 × x16" },
        { label: "Per link", value: "128 GB/s" },
        { label: "Topology", value: "full mesh, 8 GPUs" },
      ],
      pipeline: "Peer GPU traffic moves fabric-to-fabric without host involvement.",
      programming: "RCCL collectives and HIP peer access use these links; the full mesh removes ring-topology constraints.",
    },
    pcie: {
      name: "PCIe Gen5 host interface",
      type: "Interconnect",
      role: "x16 PCIe Gen5 link, 64 GB/s per direction, carrying command submission and host transfers. Inter-GPU traffic uses the Infinity Fabric links.",
      specs: [
        { label: "Link", value: "Gen5 ×16" },
        { label: "Bandwidth", value: "~128 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
  },
}
