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
      role: "The most aggressively packaged GPU of its generation. Rather than one large die, MI300X stacks eight N5 compute chiplets (XCDs) directly on top of four N6 I/O dies with hybrid bonding, then rings the assembly with eight HBM3 stacks on a CoWoS interposer: 153 billion transistors and ~1017 mm² of active silicon in a single socket. The idea behind the stack is separation of concerns. Cache, fabric and memory controllers live in the base layer, so the expensive N5 silicon above is spent almost entirely on compute. The floorplan flattens the 3D arrangement: each XCD pair is drawn beside the IOD it physically sits on. View is schematic; proportions approximate.",
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
      programming: "Target gfx942 with ROCm and HIP; wavefronts are 64 lanes wide, double the width of a CUDA warp. The package can present as one logical GPU (SPX mode) or as eight independent devices, one per XCD (CPX mode), with NPS1/NPS4 memory interleave modes to match.",
    },
    iod: {
      name: "IOD (I/O die)",
      type: "Chiplet",
      role: "The base layer of the stack, doing the unglamorous work. Each of the four N6 dies carries a quarter of the Infinity Fabric network-on-chip, a 64 MB slice of Infinity Cache, the controllers for its two adjacent HBM3 stacks, and PHYs for the external links. Two compute dies sit hybrid-bonded on top at a bond pitch around 9 µm, fine enough that dropping through the TSVs costs far less than a conventional chiplet hop. The four IODs stitch into one coherent fabric, so any CU can reach any byte of HBM; it is simply faster when the byte is local.",
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
      role: "A compute chiplet: 40 physical CUs on N5, 38 of them enabled for yield, fronted by its own command processor, four async compute engines and a hardware scheduler, all sharing a 4 MB L2. The XCD is deliberately self-sufficient. Because it can fetch, schedule and cache on its own, AMD can also expose it as an independent GPU partition (CPX mode), which inference services use to pin one model replica per XCD. Eight of them give the package its 304 CUs.",
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
      role: "The workhorse, 304 of them on the package. Each CDNA 3 CU runs 64-lane wavefronts across four SIMD16 vector pipes, keeps full-rate FP64 for the HPC crowd, and holds 64 KB of local data share for workgroup scratch. Beside the vector pipes sit four matrix cores for the dense multiply-accumulate work that dominates machine learning; this generation taught them FP8, BF8 and TF32, plus 2:4 structured sparsity. Multiply 304 CUs by widths and clocks and you arrive at the headline rates: 163 TFLOPS FP32, 1.3 PFLOPS FP16, 2.6 PFLOPS FP8.",
      specs: [
        { label: "Count", value: "304" },
        { label: "Stream processors", value: "64 per CU" },
        { label: "Matrix cores", value: "4 per CU" },
        { label: "LDS", value: "64 KB" },
        { label: "Vector L1", value: "32 KB" },
        { label: "Wavefront", value: "64 lanes" },
      ],
      pipeline: "Executes wave64s from the XCD scheduler; LDS is on-CU, memory ops go L1 → XCD L2 → IOD fabric.",
      programming: "HIP workgroup → CU; __shared__ → LDS. Matrix cores are reached via rocWMMA / MFMA compiler intrinsics or rocBLAS/hipBLASLt.",
    },
    l2: {
      name: "XCD L2 cache",
      type: "Cache",
      role: "4 MB of cache on each compute die, the last memory level that lives above the stack. It is coherent within its own XCD; anything shared across XCDs gets reconciled one level down in the Infinity Cache. The practical consequence: a working set that fits in one XCD's L2 never pays the trip through the TSVs at all, which is why partition-friendly workloads run cheaper than ones that scatter reads across the whole package.",
      specs: [
        { label: "Per XCD", value: "4 MB" },
        { label: "Total", value: "32 MB" },
      ],
      pipeline: "Collects CU L1 misses; misses descend via TSVs to the IOD.",
    },
    ic: {
      name: "Infinity Cache + fabric",
      type: "Cache (IOD)",
      role: "256 MB of SRAM spread across the base dies, 64 MB per IOD, parked directly in front of the HBM controllers. It is a memory-side cache: it holds whichever HBM lines are hot regardless of which XCD asked for them, so when all eight XCDs stream the same model weights, one HBM fetch serves everybody. Internal bandwidth runs around 17 TB/s, roughly triple what the HBM itself delivers, and that multiplier is what keeps 19 456 stream processors from starving.",
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
      role: "Eight HBM3 stacks surround the compute, each 12 dies high and 24 GB, for 192 GB at 5.3 TB/s. Capacity was the headline feature: in 2024 a single MI300X could hold a 70B-parameter model in FP16 with room left for KV cache, which removed the tensor-parallel plumbing entire model classes used to require. Each stack talks to controllers on its adjacent IOD, so the physical placement of two stacks per IOD edge mirrors the logical NPS4 memory quadrants.",
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
      role: "The scale-out wiring. Seven external x16 Infinity Fabric links per GPU at 128 GB/s each (896 GB/s aggregate) let eight MI300X packages on an OAM baseboard form a full mesh: every GPU exactly one hop from every other, with no switch silicon in between. The all-reduce traffic of training runs and the all-to-all chatter of tensor-parallel inference ride these links through RCCL.",
      specs: [
        { label: "Links", value: "7 × x16" },
        { label: "Per link", value: "128 GB/s" },
        { label: "Topology", value: "full mesh, 8 GPUs" },
      ],
      pipeline: "Peer GPU traffic moves fabric-to-fabric without host involvement.",
      programming: "RCCL collectives and HIP peer access ride these links; the full mesh removes ring-topology constraints.",
    },
    pcie: {
      name: "PCIe Gen5 host interface",
      type: "Interconnect",
      role: "Sixteen lanes of PCIe Gen5 to the host CPU, 64 GB/s in each direction. Command submission, host-side tensors and checkpoint traffic come through here, while anything latency-critical between GPUs takes the Infinity Fabric links instead.",
      specs: [
        { label: "Link", value: "Gen5 ×16" },
        { label: "Bandwidth", value: "~128 GB/s bidir" },
      ],
      pipeline: "Host front door.",
    },
  },
}
