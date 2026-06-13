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
      role: "The MI300X is a CDNA 3 accelerator assembled by stacking chiplets in three dimensions. Eight compute dies, called XCDs and manufactured on TSMC N5, are bonded on top of four I/O dies, called IODs and manufactured on TSMC N6, and eight HBM3 memory stacks surround them. The whole assembly sits on a CoWoS interposer, a slab of silicon that carries the wiring between the dies, because silicon can be patterned with much finer wires than an ordinary package. The XCDs are joined to the IODs by hybrid bonding, where the two dies are pressed together so that copper pads on each face fuse directly, giving a far shorter and denser connection than solder bumps. The cache, the memory controllers and the on-package network all live in the IODs, so the N5 compute dies spend almost all of their area on compute. The package holds 153 billion transistors across roughly 1017 mm² of active silicon.",
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
      pipeline: "A kernel launch is distributed by the command processor on each XCD to that die's CUs. A memory request from a CU first checks the XCD's 4 MB L2. On a miss it descends through the I/O die beneath into the Infinity Fabric, the on-package network that ties the four IODs into one coherent memory system. The fabric checks the Infinity Cache, and if the line is not held there, the HBM3 controllers beside the relevant stack service the request. Because every IOD can reach every stack, any CU can address any byte of the 192 GB of HBM, at lower latency when the data sits in its local quadrant.",
      programming: "Code is compiled with ROCm and HIP, AMD's CUDA-like programming model, targeting gfx942. Wavefronts, AMD's 64-lane equivalent of NVIDIA warps, are the unit of scheduling. The package can present itself to software as one logical GPU, a mode AMD calls SPX, or as eight separate per-XCD devices, a mode called CPX that suits serving several smaller inference models at once. HBM can be interleaved across all eight stacks so that any allocation spreads evenly, called NPS1, or split so each quadrant of stacks binds to its local XCDs, called NPS4, which trades uniform access for lower local latency.",
    },
    iod: {
      name: "IOD (I/O die)",
      type: "Chiplet",
      role: "Each I/O die is a base-layer chiplet on TSMC N6. It carries one quarter of the Infinity Fabric, the on-package network that links all four IODs into one coherent system, a 64 MB slice of Infinity Cache, the memory controllers for its two neighbouring HBM3 stacks, and the PHYs that drive the external links. PHY stands for physical layer which are the analog circuits that drive signals off the chip at high speed. Two XCDs are hybrid-bonded on top of each IOD at a pitch of roughly 9 µm, so a signal crossing from an XCD down into the IOD travels through a short vertical wire rather than a costlier package-level link. The four IODs together form one coherent fabric, so any CU can reach any byte of HBM, at lower latency when the address is local.",
      specs: [
        { label: "Count", value: "4" },
        { label: "Process", value: "TSMC N6" },
        { label: "Carries", value: "2 XCDs + 64 MB IC + 2 HBM PHY pairs" },
        { label: "Bonding", value: "SoIC hybrid bond, TSVs" },
      ],
      pipeline: "All memory traffic from the XCDs descends through through-silicon vias, the short vertical wires that connect stacked dies, into the IOD fabric, which routes each request to local or remote cache and HBM.",
    },
    xcd: {
      name: "XCD (Accelerator Complex Die)",
      type: "Compute chiplet",
      role: "Each XCD is a compute die on TSMC N5 holding 40 physical CUs, of which 38 are active. Flaws are inevitable when manufacturing a die, so AMD sells parts with some CUs disabled rather than discarding the silicon, and the disabled positions vary from die to die. Each XCD also has its own command processor, four Asynchronous Compute Engines that let multiple compute queues run concurrently, a hardware scheduler, and a shared 4 MB L2. Because each XCD fetches, schedules and caches independently, the package can be partitioned one XCD at a time in CPX mode. Eight XCDs provide the package's 304 active CUs.",
      specs: [
        { label: "Count", value: "8" },
        { label: "CUs", value: "38 enabled of 40" },
        { label: "L2", value: "4 MB shared" },
        { label: "Queues", value: "4 ACEs + HWS per XCD" },
      ],
      pipeline: "The command processor on the XCD assigns workgroups to its CUs. A memory request that misses the shared 4 MB L2 leaves the compute die and goes to the IOD fabric below.",
      programming: "In SPX mode the eight XCDs act as a single device and one workload spreads across all of them. In CPX mode each XCD becomes a separate HIP device with its own slice of HBM. A model small enough to fit in one XCD's memory can then run on its own partition, letting the package serve up to eight independent jobs at once. A single small model would leave most of the 304 CUs idle, so partitioning the package this way keeps all of the hardware busy and isolates each job so that one cannot slow down or interfere with another.",
    },
    cu: {
      name: "CU (Compute Unit, CDNA 3)",
      type: "Compute unit",
      role: "Each CU has four SIMD16 vector pipes that execute 64-lane wavefronts, full-rate FP64, 64 KB of LDS, which is AMD's name for shared memory, and four matrix cores. The matrix cores are AMD's equivalent of NVIDIA's Tensor Cores and perform matrix multiply-accumulate operations. CDNA 3 adds the FP8 and BF8 formats, which store each value in eight bits instead of the usual sixteen, along with the TF32 format. TF32, short for TensorFloat-32, keeps FP32's numeric range but reduces the mantissa from 23 bits to 10. The matrix cores also support 2:4 structured sparsity, which takes advantage of a common pattern in trained neural networks where many weights are close to zero. If a model is pruned so that at least two of every four weights in each group are exactly zero, the matrix cores can skip those multiplications entirely and double matrix throughput.",
      specs: [
        { label: "Count", value: "304" },
        { label: "Stream processors", value: "64 per CU" },
        { label: "Matrix cores", value: "4 per CU" },
        { label: "LDS", value: "64 KB" },
        { label: "Vector L1", value: "32 KB" },
        { label: "Wavefront", value: "64 lanes" },
      ],
      pipeline: "Executes wavefronts issued by the XCD scheduler. The LDS is on the CU, and memory operations proceed from the L1 to the XCD L2 to the IOD fabric below.",
      programming: "A HIP workgroup runs on one CU, and memory declared __shared__ is placed in that CU's LDS. The matrix cores are programmed through the MFMA instructions directly, through the rocWMMA wrapper, or through libraries such as rocBLAS and hipBLASLt that call them internally.",
    },
    l2: {
      name: "XCD L2 cache",
      type: "Cache",
      role: "Each XCD has its own 4 MB L2 shared by all of that die's CUs, and it is the last level of cache before a request leaves the compute die. The L2 keeps data coherent for the CUs on its own XCD, while data shared between different XCDs is kept consistent further down in the Infinity Cache. A working set that fits within one XCD's L2 is served without ever crossing down into the I/O die, so a workload confined to a single partition has more efficient memory access.",
      specs: [
        { label: "Per XCD", value: "4 MB" },
        { label: "Total", value: "32 MB" },
      ],
      pipeline: "Collects CU L1 misses. Misses descend through the through-silicon vias into the IOD.",
    },
    ic: {
      name: "Infinity Cache + fabric",
      type: "Cache (IOD)",
      role: "Each IOD carries a 64 MB slice of Infinity Cache, totaling 256 MB across the four IODs. The Infinity Cache is a memory-side cache placed directly in front of the HBM3 controllers. It retains the HBM cache lines that are accessed most often, where a line is the fixed-size block of bytes the memory system moves as a unit and a hot line is one that is read or written repeatedly. Because the cache sits in front of memory rather than inside any one XCD, it holds those lines no matter which XCD requested them, so a line read by all eight XCDs is fetched from DRAM only once. The internal bandwidth is approximately 17 TB/s, roughly three times the HBM bandwidth, so requests that hit here are returned far faster and consume no HBM bandwidth.",
      specs: [
        { label: "Per IOD", value: "64 MB" },
        { label: "Total", value: "256 MB" },
        { label: "Peak internal BW", value: "~17 TB/s" }, // approx
      ],
      pipeline: "XCD L2 misses route here. A request served from the Infinity Cache never reaches the HBM controllers.",
    },
    hbm: {
      name: "HBM3 stack",
      type: "Memory interface",
      role: "HBM3 stacks multiple DRAM dies vertically and connects them with thousands of short vertical wires called through-silicon vias, giving far more parallel data paths than a conventional circuit board allows. The stacks sit beside the logic dies on the same CoWoS interposer. Eight stacks are present, each twelve dies high and holding 24 GB, for 192 GB of capacity across an 8192-bit bus, and the package can read and write that memory at up to 5.3 TB/s. That 192 GB is large enough to hold a 70-billion-parameter model in FP16 on a single device, together with its KV cache. The KV cache is the set of attention keys and values a language model stores and reuses as it generates each token. Holding both on one device removes the need to split such a model across several GPUs. Each stack is driven by controllers on the IOD beside it, and the two-stacks-per-IOD arrangement is what the NPS4 memory quadrants correspond to.",
      specs: [
        { label: "Stacks", value: "8 × 24 GB" },
        { label: "Bus", value: "8192-bit total" },
        { label: "Capacity", value: "192 GB" },
        { label: "Bandwidth", value: "5.3 TB/s" },
        { label: "ECC", value: "yes" },
      ],
      pipeline: "The terminal memory level which services Infinity Cache misses. The controllers interleave addresses so contiguous data spreads across the stacks.",
      programming: "Global memory allocated with hipMalloc resides here. When the 64 threads of a wavefront read addresses that fall within the same cache line, the hardware issues one memory transaction for the whole wavefront, a pattern called coalescing. Scattered addresses each require their own transaction and waste most of the bandwidth they occupy. Allocations interleave across all eight stacks under NPS1 or bind to one quadrant under NPS4 for partition-local bandwidth.",
    },
    if: {
      name: "Infinity Fabric link",
      type: "Interconnect",
      role: "Seven external Infinity Fabric links, each x16 and carrying 128 GB/s, for 896 GB/s in total. Eight MI300X packages on an OAM baseboard connect through these links in a full mesh, meaning every GPU has a direct link to every other GPU with no separate switch chip in between. Multi-GPU collective operations and peer-to-peer transfers travel over these links.",
      specs: [
        { label: "Links", value: "7 × x16" },
        { label: "Per link", value: "128 GB/s" },
        { label: "Topology", value: "full mesh, 8 GPUs" },
      ],
      pipeline: "Peer GPU traffic moves fabric-to-fabric without involving the host.",
      programming: "Peer access between GPUs and RCCL collectives use these links. RCCL is AMD's equivalent of NVIDIA's NCCL, which is a library of multi-GPU collective operations such as all-reduce. The full mesh means any GPU reaches any other in a single hop.",
    },
    pcie: {
      name: "PCIe Gen5 host interface",
      type: "Interconnect",
      role: "An x16 PCIe Gen5 link to the host CPU, which moves 64 GB/s in each direction for 128 GB/s of bidirectional bandwidth. It carries command submission and host transfers. Traffic between GPUs uses the Infinity Fabric links instead.",
      specs: [
        { label: "Link", value: "Gen5 ×16" },
        { label: "Bandwidth", value: "~128 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
  },
}
