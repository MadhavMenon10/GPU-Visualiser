import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 276
const H = 224

function xeCore(id: string, x: number, y: number, w: number, h: number): Block {
  const g = blk(id, "group", x, y, w, h, { doc: "xecore", children: [] })
  g.children!.push(blk(`${id}/xve`, "compute", 1, 1, w - 2, 10.5, { label: "16× XVE", doc: "xve" }))
  g.children!.push(blk(`${id}/xmx`, "compute", 1, 12.5, w - 2, 10.5, { label: "16× XMX", doc: "xmx" }))
  g.children!.push(blk(`${id}/l1`, "cache", 1, 24, w - 14, 3.6, { label: "L1/SLM 192K", doc: "l1" }))
  g.children!.push(blk(`${id}/rtu`, "frontend", w - 12.4, 24, 5.6, 3.6, { label: "RTU", doc: "rtu" }))
  g.children!.push(blk(`${id}/smp`, "media", w - 6.2, 24, 5.2, 3.6, { label: "TEX", doc: "smp" }))
  return g
}

function slice(i: number, x: number, y: number, w: number, h: number): Block {
  const g = blk(`slice${i}`, "group", x, y, w, h, {
    label: `SLICE${i}`,
    labelPos: "tl",
    doc: "slice",
    children: [],
  })
  g.children!.push(blk(`slice${i}/geo`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "GEOMETRY · RASTER · HiZ", doc: "raster" }))
  tile(4, 2, 1.5, 11, w - 3, 58, 1.2).forEach((c) => {
    g.children!.push(xeCore(`slice${i}/xc${c.i}`, c.x, c.y, c.w, c.h))
  })
  g.children!.push(blk(`slice${i}/pb`, "frontend", 1.5, 70.5, w - 3, 4.5, { label: "PIXEL BACKEND · 16 ROP", doc: "pixbe" }))
  return g
}

function floorplan(): Block {
  const kids: Block[] = []

  kids.push(blk("front", "frontend", 20, 3, 84, 11, { label: "COMMAND STREAMER · DISPATCH", doc: "front" }))
  kids.push(blk("media", "media", 106, 3, 60, 11, { label: "MEDIA · 2× MFX (AV1)", doc: "media" }))
  kids.push(blk("display", "media", 168, 3, 60, 11, { label: "DISPLAY · 4 PIPES", doc: "display" }))
  kids.push(blk("pcie", "interconnect", 230, 3, 26, 11, { label: "PCIe ×16", doc: "pcie" }))

  vstack(2, 3, 16, 14, 190, 3).forEach((c) => {
    kids.push(blk(`gddr-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6", doc: "mem" }))
  })
  vstack(2, W - 17, 16, 14, 190, 3).forEach((c) => {
    kids.push(blk(`gddr-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6", doc: "mem" }))
  })

  tile(4, 4, 20, 16, 236, 80, 2).forEach((c) => kids.push(slice(c.i, c.x, c.y, c.w, c.h)))
  tile(4, 4, 20, 126, 236, 80, 2).forEach((c) => kids.push(slice(c.i + 4, c.x, c.y, c.w, c.h)))

  const l2 = blk("l2", "cache", 20, 98.5, 236, 25, {
    label: "L2 CACHE · 16 MB · MEMORY FABRIC",
    labelPos: "tl",
    doc: "l2",
    children: [],
  })
  hstack(8, 1.5, 6.5, 233, 17, 1).forEach((c) => {
    l2.children!.push(blk(`l2/${c.i}`, "cache", c.x, c.y, c.w, c.h, { doc: "l2" }))
  })
  kids.push(l2)

  hstack(4, 20, 209, 236, 12, 3).forEach((c) => {
    kids.push(blk(`gddr-b${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "GDDR6 PHY 32-bit", doc: "mem" }))
  })

  return blk("die", "die", 0, 0, W, H, { label: "ACM-G10", doc: "die", children: kids })
}

export const arcA770: Gpu = {
  id: "a770",
  vendor: "Intel",
  name: "Arc A770 16GB",
  die: "ACM-G10",
  arch: "Xe-HPG (Alchemist)",
  isa: "Xe-HPG / DG2-512",
  process: "TSMC N6",
  floorplan,
  docs: {
    die: {
      name: "ACM-G10 (Arc A770)",
      type: "Die overview",
      role: "Intel's first full-size discrete gaming die: 406 mm² of TSMC N6 silicon carrying 21.7 billion transistors. The compute is organized as eight render slices of four Xe-cores each, 32 Xe-cores in total, and unusually for a die this large every unit ships enabled on the A770. Each Xe-core also carries XMX matrix engines, the hardware behind XeSS upscaling, so a meaningful share of the die area is spent on AI throughput in what was sold as a mid-range gaming part. Reading the floorplan: work enters through the command streamer along the top edge, spreads across the two banks of slices, and every byte the cores touch funnels through the 16 MB L2 strip in the middle before reaching the GDDR6 controllers on the other three edges. Floorplan is schematic; proportions approximate.",
      specs: [
        { label: "Process", value: "TSMC N6" },
        { label: "Transistors", value: "21.7 B" },
        { label: "Die size", value: "406 mm²" },
        { label: "Render slices", value: "8" },
        { label: "Xe-cores", value: "32" },
        { label: "XVE (vector)", value: "512 · 4096 FP32 lanes" },
        { label: "XMX (matrix)", value: "512" },
        { label: "Ray tracing units", value: "32" },
        { label: "L2 cache", value: "16 MB" },
        { label: "Memory", value: "16 GB GDDR6, 256-bit, 17.5 Gbps" },
        { label: "Mem bandwidth", value: "560 GB/s" },
        { label: "Graphics clock", value: "2.1 GHz" },
        { label: "FP32", value: "17.2 TFLOPS" },
        { label: "XMX INT8", value: "~138 TOPS" },
        { label: "ROPs", value: "128" },
        { label: "TBP", value: "225 W" },
      ],
      pipeline: "Command streamer dispatches to render slices; Xe-core memory traffic flows L1/SLM → 16 MB L2 via the memory fabric → GDDR6 controllers on three die edges.",
      programming: "Programmed through oneAPI: SYCL kernels arrive via Level Zero, or through OpenCL, Vulkan and DX12. There is no fixed ISA version scheme like NVIDIA's sm_xx; kernels ship as SPIR-V and the driver JIT-compiles them for the hardware at load time, which is why driver updates can change performance on the same chip.",
    },
    front: {
      name: "Command streamer + global dispatch",
      type: "Front end",
      role: "The die's front door for work. The command streamer reads command buffers that the driver wrote into memory, decodes them into draw calls and compute dispatches, and hands the resulting thread groups to the global dispatcher, which load-balances them across all 32 Xe-cores. Everything downstream starves if this block stalls, so it sits beside the PCIe interface where commands arrive.",
      specs: [{ label: "Scheduling unit", value: "thread group / draw" }],
      pipeline: "All submitted work enters here before any other block on the die sees it.",
      programming: "Every SYCL queue submission and Level Zero command list lands in this block; a single queue can keep the entire die fed.",
    },
    slice: {
      name: "Render slice",
      type: "Compute cluster",
      role: "Intel's mid-level cluster, the rough equivalent of an NVIDIA GPC or an AMD shader engine. Each slice bundles four Xe-cores with the graphics plumbing they share: a geometry pipeline that fetches and culls triangles, a rasterizer that turns surviving triangles into pixel work, hierarchical-Z hardware that throws away hidden pixels early, and a pixel backend with 16 ROPs that writes finished colors to memory. A pure compute workload only exercises the Xe-cores inside; the rest of the slice exists for 3D.",
      specs: [
        { label: "Count", value: "8" },
        { label: "Xe-cores per slice", value: "4" },
        { label: "RT units per slice", value: "4" },
        { label: "ROPs per slice", value: "16" },
      ],
      pipeline: "Receives draws and dispatches from the front end, rasterizes and shades them locally, then blends final pixels in its own backend.",
    },
    xecore: {
      name: "Xe-core",
      type: "Compute unit",
      role: "The unit Intel counts cores by, and the place your code actually runs. Each Xe-core packs 16 vector engines (XVE) for ordinary shader math, 16 matrix engines (XMX) for AI work, and 192 KB of fast SRAM that splits between L1 cache and shared local memory. Alchemist introduced this organization: one Xe-core absorbs what used to be 16 separate EUs, one per XVE, with the shared memory and thread dispatch pulled into the same block. When sizing a kernel, think in Xe-cores, because a work-group lives its whole life on exactly one.",
      specs: [
        { label: "Count", value: "32" },
        { label: "XVE per core", value: "16" },
        { label: "XMX per core", value: "16" },
        { label: "L1/SLM", value: "192 KB (configurable split)" },
        { label: "FP32 lanes", value: "128" },
      ],
      pipeline: "Thread groups arrive from global dispatch; vector and matrix instructions issue to the XVE and XMX pipes, and memory requests check L1/SLM before travelling to L2.",
      programming: "A SYCL work-group maps to one Xe-core. Sub-groups of 8, 16 or 32 map onto XVE SIMD lanes, and shared local memory is carved out of the 192 KB L1.",
    },
    xve: {
      name: "XVE (Xe Vector Engine)",
      type: "Execution unit",
      role: "The ordinary math unit: sixteen per Xe-core, 512 on the die. Each one is a 256-bit SIMD ALU that retires 8 FP32 operations per clock, 16 at FP16, or 32 INT8 using the DP4A dot-product instruction, with an extended-math pipe for transcendentals issuing alongside. A single XVE keeps several hardware threads resident and switches among them whenever one stalls on memory. That thread juggling, multiplied across 512 engines, is how the GPU hides hundreds of cycles of DRAM latency without the big per-core caches a CPU needs.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP32 per clock", value: "8 per XVE" },
        { label: "HW threads", value: "8 per XVE" }, // approx
      ],
      pipeline: "Executes the bulk of every shader and SYCL kernel; nearly every instruction that touches your data passes through an XVE.",
      programming: "A sub-group of 8 issues as one XVE instruction. FP64 is absent on Alchemist, so double-precision code either emulates slowly or fails at JIT.",
    },
    xmx: {
      name: "XMX (Xe Matrix Extensions engine)",
      type: "Execution unit",
      role: "The AI unit. Each XMX engine is a 1024-bit systolic array, a small grid of multipliers that computes matrix dot products in bulk: 64 FP16/BF16 or 128 INT8 operations per clock, 8× what the XVE's DP4A path manages. Add up all 512 engines and the die reaches roughly 138 INT8 TOPS, which is the budget XeSS spends to upscale frames. Dedicated matrix hardware was unusual in a mid-range gaming die in 2022; the same generation's Radeons had no equivalent at all.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP16 throughput", value: "~69 TFLOPS total" },
        { label: "INT8 throughput", value: "~138 TOPS total" },
      ],
      pipeline: "Sits beside the XVEs and shares their operand bandwidth; matrix tiles stream in from registers and shared local memory.",
      programming: "Reached through SYCL joint_matrix, oneDNN, or DirectML metacommands; XeSS uses it directly on Arc hardware.",
    },
    l1: {
      name: "L1 / shared local memory",
      type: "Cache",
      role: "192 KB of SRAM inside each Xe-core doing double duty. Per kernel, the hardware splits it between ordinary L1 cache and shared local memory, the scratchpad a work-group uses to exchange data between its threads. The two uses compete for the same capacity, so a kernel that requests a large SLM allocation is also shrinking its own cache.",
      specs: [
        { label: "Size", value: "192 KB per Xe-core" },
        { label: "SLM", value: "carveout, work-group scoped" },
      ],
      pipeline: "First stop for every memory access an Xe-core makes; misses travel the fabric to the 16 MB L2.",
    },
    rtu: {
      name: "RTU (Ray Tracing Unit)",
      type: "Fixed function",
      role: "One per Xe-core. It walks BVH acceleration structures and runs ray-triangle intersection tests in fixed-function hardware, the expensive inner loop of ray tracing that would crawl if it ran on the vector engines. Alchemist adds a thread-sorting unit on top: rays that hit different materials want different shaders, which shreds SIMD efficiency, so the RTU regroups ray hits into coherent bundles before shading starts. NVIDIA attacks the same divergence problem with SER on Ada.",
      specs: [
        { label: "Count", value: "32" },
        { label: "Traversal", value: "HW BVH + thread sorting" },
      ],
      pipeline: "Shaders dispatch ray queries to it and receive sorted hit results back for shading.",
    },
    smp: {
      name: "Sampler (TMU)",
      type: "Fixed function",
      role: "Texture hardware. When a shader reads a texture, the sampler computes which texels the request touches, fetches them through the cache hierarchy, and filters them (bilinear, trilinear, anisotropic) down to the single value the shader receives. Eight sit with each Xe-core, 256 across the die, so filtering throughput grows in step with the shader power it has to feed.",
      specs: [{ label: "Count", value: "256 (8 per Xe-core)" }],
      pipeline: "Between shader texture requests and the cache hierarchy.",
    },
    raster: {
      name: "Geometry + rasterizer",
      type: "Graphics fixed function",
      role: "The slice's 3D front half. The geometry pipeline fetches vertices, runs tessellation and culls triangles that face away from the camera or fall outside the screen. The rasterizer converts each surviving triangle into pixel-shader work, and hierarchical-Z rejects whole tiles of pixels that are already hidden behind closer geometry, before any shading effort is spent on them.",
      specs: [{ label: "Rasterizers", value: "8 (1 per slice)" }],
      pipeline: "Feeds fragments to the slice's four Xe-cores.",
    },
    pixbe: {
      name: "Pixel backend",
      type: "Graphics fixed function",
      role: "The last stage of the 3D pipeline. Its ROPs take shaded pixel colors, apply depth and stencil tests, blend transparent surfaces against what the framebuffer already holds, and write the results out through the L2. There are 16 per slice and 128 die-wide, and that count caps fill rate: how many finished pixels per clock the die can produce no matter how much shader power sits idle behind it.",
      specs: [{ label: "ROPs", value: "128 total" }],
      pipeline: "Final pixel stage; writes through the L2.",
    },
    l2: {
      name: "L2 cache + memory fabric",
      type: "Cache",
      role: "The die-wide safety net: 16 MB of cache shared by every slice, sampler and ROP, reached over Intel's GTI memory fabric. Every L1 miss on the die lands here, and only what misses here pays the full-latency trip to GDDR6. 16 MB was generous for the generation; NVIDIA shipped 6 MB on GA102 the same year. Capacity buys hit rate, and hit rate behaves like free memory bandwidth.",
      specs: [
        { label: "Capacity", value: "16 MB" },
        { label: "Banks", value: "address-hashed slices" },
      ],
      pipeline: "Backstop for all L1/SLM misses; what misses here becomes a DRAM transaction.",
    },
    mem: {
      name: "GDDR6 controller + PHY",
      type: "Memory interface",
      role: "Eight 32-bit GDDR6 controllers and their PHYs form a 256-bit bus wrapped around three die edges; the 16 GB A770 runs the devices at 17.5 Gbps for 560 GB/s. PHYs are the analog circuits that drive signals off-package, and they sit on the edges because that is where the package balls are. Analog I/O barely shrinks from one process node to the next, which is why edge real estate is precious on every GPU die.",
      specs: [
        { label: "Controllers", value: "8 × 32-bit" },
        { label: "Capacity", value: "16 GB" },
        { label: "Data rate", value: "17.5 Gbps" },
        { label: "Bandwidth", value: "560 GB/s" },
      ],
      pipeline: "Terminal memory level behind L2; an L2 miss becomes a DRAM transaction here.",
    },
    media: {
      name: "Xe Media Engine",
      type: "Fixed function",
      role: "Two multi-format codec engines that encode and decode video without touching the 3D pipeline. Arc shipped the first hardware AV1 encoder in a consumer GPU, months before Ada and RDNA 3 matched it, which briefly made the A770 the cheapest serious streaming and transcode card you could buy.",
      specs: [
        { label: "Engines", value: "2 × MFX" },
        { label: "AV1", value: "encode + decode" },
      ],
      pipeline: "Operates frame by frame on surfaces in DRAM, independent of the 3D pipeline.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Drives the monitors. Four independent pipes scan finished frames out of memory, apply per-display timing and color processing, and feed the DP 2.0 (UHBR 10) and HDMI 2.1 outputs. One pipe per display, so four pipes means four monitors.",
      specs: [
        { label: "Pipes", value: "4" },
        { label: "DisplayPort", value: "2.0 UHBR10" },
        { label: "HDMI", value: "2.1" },
      ],
      pipeline: "Scan-out from memory.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "The host link: 16 lanes of PCIe Gen4 carrying command submission, data copies and mapped memory between CPU and GPU. Arc leans on Resizable BAR harder than its rivals because the driver assumes the CPU can address all of VRAM at once; on systems with ReBAR disabled, performance drops sharply rather than degrading gracefully.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "ReBAR", value: "effectively required" },
      ],
      pipeline: "Host front door.",
    },
  },
}
