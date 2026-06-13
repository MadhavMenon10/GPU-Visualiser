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
      role: "ACM-G10 is Intel's first full-size discrete gaming die, measuring 406 mm² on TSMC N6 and carrying 21.7 billion transistors. Its compute is organized as eight render slices of four Xe-cores each, and all 32 Xe-cores are active on the A770. Every Xe-core carries XMX matrix engines, which are Intel's equivalent of NVIDIA's Tensor Cores, giving the die roughly 138 trillion 8-bit integer operations per second of matrix throughput, used mainly by XeSS, Intel's machine-learning image upscaler. Command processing sits along the top edge, the two banks of slices form the body of the die, and all memory traffic passes through the central 16 MB L2 on its way to the GDDR6 controllers on the other three edges.",
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
      pipeline: "The command streamer reads the command buffers the driver has written and dispatches draw calls and compute work to the render slices. Within a slice, the geometry and raster hardware turns triangles into pixel fragments, the Xe-cores shade them, and the pixel backend writes finished pixels out. All memory traffic from the Xe-cores passes through the per-core L1 to the central 16 MB L2 over the memory fabric, and any L2 miss is served by the GDDR6 controllers on the die edges. A compute workload uses only the Xe-cores and the cache path and skips the graphics stages.",
      programming: "The A770 is programmed through Intel's oneAPI stack, most directly with SYCL kernels running on the Level Zero driver, and also through OpenCL, Vulkan and DirectX 12. Unlike NVIDIA's sm_xx scheme, there is no fixed hardware ISA version. Kernels are shipped as SPIR-V, a portable intermediate representation, and the driver compiles them to machine code at load time. This is called JIT, or just-in-time, compilation, and it means a driver update can change performance on the same hardware.",
    },
    front: {
      name: "Command streamer + global dispatch",
      type: "Front end",
      role: "Reads the command buffers written by the driver, decodes them into draw calls and compute dispatches, and hands the resulting thread groups to the global dispatcher, which spreads them across all 32 Xe-cores. A compute dispatch is a request to run a compute kernel over a grid of thread groups. The rate at which this block dispatches work determines how busy the rest of the die can be kept.",
      specs: [{ label: "Scheduling unit", value: "thread group / draw" }],
      pipeline: "All submitted work enters here before any other block sees it.",
      programming: "SYCL queue submissions and Level Zero command lists are consumed here, and a single queue can keep the whole device busy.",
    },
    slice: {
      name: "Render slice",
      type: "Compute cluster",
      role: "Intel's mid-level cluster which is comparable to an NVIDIA GPC or an AMD shader engine. Each slice holds four Xe-cores together with the graphics fixed-function hardware they share, namely a geometry pipeline, a rasterizer, hierarchical-Z, and a pixel backend holding 16 ROPs, the Render Output Units that handle depth testing and pixel blending. Compute workloads use only the Xe-cores, while the fixed-function hardware serves the 3D pipeline.",
      specs: [
        { label: "Count", value: "8" },
        { label: "Xe-cores per slice", value: "4" },
        { label: "RT units per slice", value: "4" },
        { label: "ROPs per slice", value: "16" },
      ],
      pipeline: "Receives draw calls and dispatches from the front end, then rasterizes, shades and blends within the slice.",
    },
    xecore: {
      name: "Xe-core",
      type: "Compute unit",
      role: "The Xe-core is the unit Intel counts cores by and the level a work-group runs on, making it the closest Intel equivalent to an NVIDIA SM or an AMD CU. Each Xe-core holds 16 vector engines, called XVEs, 16 matrix engines, called XMX, a thread dispatcher, and 192 KB of SRAM split between L1 cache and shared local memory. This organization replaced Intel's earlier execution unit structure, and one Xe-core corresponds to 16 of the former execution units, one per XVE.",
      specs: [
        { label: "Count", value: "32" },
        { label: "XVE per core", value: "16" },
        { label: "XMX per core", value: "16" },
        { label: "L1/SLM", value: "192 KB (configurable split)" },
        { label: "FP32 lanes", value: "128" },
      ],
      pipeline: "Thread groups arrive from the global dispatcher. Vector and matrix instructions are issued to the XVE and XMX pipes, and memory requests check the L1 and shared local memory before going to the L2.",
      programming: "A SYCL work-group runs on one Xe-core. Sub-groups of 8, 16 or 32 work-items map onto the XVE SIMD lanes, where a sub-group is Intel's equivalent of an NVIDIA warp. Shared local memory is carved out of the same 192 KB block as the L1.",
    },
    xve: {
      name: "XVE (Xe Vector Engine)",
      type: "Execution unit",
      role: "A 256-bit SIMD arithmetic unit, with sixteen in each Xe-core and 512 across the die. Each XVE performs 8 FP32 or 16 FP16 operations per clock, or 32 INT8 operations through DP4A, an instruction that computes a four-element dot product in one step. A separate extended-math pipe handles transcendental functions alongside the main unit. Each XVE keeps several hardware threads resident at once and switches between them whenever one stalls, which is the main way the design hides memory latency.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP32 per clock", value: "8 per XVE" },
        { label: "HW threads", value: "8 per XVE" }, // approx
      ],
      pipeline: "Executes the arithmetic of every shader and SYCL kernel.",
      programming: "A sub-group of 8 work-items issues as a single XVE instruction. There is no FP64 hardware on Alchemist, so double-precision code either emulates slowly or fails when the driver compiles it.",
    },
    xmx: {
      name: "XMX (Xe Matrix Extensions engine)",
      type: "Execution unit",
      role: "The XMX engines are Intel's equivalent of NVIDIA's Tensor Cores. Each is a 1024-bit systolic array, a grid of multiply-accumulate units that matrix tiles flow through in lockstep, with sixteen in each Xe-core. Each XMX computes 64 FP16 or BF16 matrix operations per clock, or 128 INT8, about eight times the rate of the XVE's DP4A path, for a die total near 138 trillion INT8 operations per second. BF16, Brain Float 16, is a 16-bit format that keeps the same 8-bit exponent as FP32, so it covers the same range of values while using half the storage.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP16 throughput", value: "~69 TFLOPS total" },
        { label: "INT8 throughput", value: "~138 TOPS total" },
      ],
      pipeline: "Shares operand bandwidth with the XVEs. Matrix tiles stream in from registers and shared local memory.",
      programming: "Reached through the SYCL joint_matrix API, the oneDNN library, or DirectML metacommands. XeSS calls it directly on Arc hardware.",
    },
    l1: {
      name: "L1 / shared local memory",
      type: "Cache",
      role: "192 KB of SRAM in each Xe-core, split per kernel between L1 cache and shared local memory, which is Intel's name for the on-chip scratchpad that a work-group shares. The two uses draw from the same capacity, so a kernel that asks for a large shared-local-memory allocation leaves less room for the cache.",
      specs: [
        { label: "Size", value: "192 KB per Xe-core" },
        { label: "SLM", value: "carveout, work-group scoped" },
      ],
      pipeline: "The first level for every Xe-core memory access. Misses access the 16 MB L2.",
    },
    rtu: {
      name: "RTU (Ray Tracing Unit)",
      type: "Fixed function",
      role: "One ray tracing unit per Xe-core. In ray tracing, a BVH, or Bounding Volume Hierarchy, is a tree of nested bounding boxes used to find which triangles a ray might hit. The ray tests boxes first and only examines the triangles inside a box when it actually intersects it, avoiding tests against most of the scene. The RTU performs this BVH traversal and the ray-triangle intersection tests in fixed-function hardware. A thread-sorting unit then regroups rays that hit different materials into batches that shade together, because without it rays diverging across a SIMD group would leave many lanes idle.",
      specs: [
        { label: "Count", value: "32" },
        { label: "Traversal", value: "HW BVH + thread sorting" },
      ],
      pipeline: "Receives ray queries from shaders and returns sorted hit results for shading.",
    },
    smp: {
      name: "Sampler (TMU)",
      type: "Fixed function",
      role: "The sampler, also called the texture mapping unit, fetches and filters textures. It computes the addresses of the texels a shader asks for, where a texel is a single pixel of a texture, fetches them through the cache hierarchy, and applies bilinear, trilinear or anisotropic filtering to smooth the result. There are eight per Xe-core and 256 across the die.",
      specs: [{ label: "Count", value: "256 (8 per Xe-core)" }],
      pipeline: "Sits between shader texture requests and the cache hierarchy.",
    },
    raster: {
      name: "Geometry + rasterizer",
      type: "Graphics fixed function",
      role: "Each render slice carries its own geometry and rasterization hardware. The geometry stage fetches the triangle vertices, applies tessellation, and culls the triangles that face away from the camera or lie outside the view so that no later stage has to process them. The rasterizer then takes each surviving triangle and works out which pixels it covers, producing the pixel fragments that the Xe-cores shade. Hierarchical-Z runs a depth test over whole tiles of pixels at once and rejects the tiles that sit behind geometry already drawn, which stops the Xe-cores from shading pixels that would never be visible.",
      specs: [{ label: "Rasterizers", value: "8 (1 per slice)" }],
      pipeline: "Feeds pixel fragments to the slice's four Xe-cores.",
    },
    pixbe: {
      name: "Pixel backend",
      type: "Graphics fixed function",
      role: "The final stage of the 3D pipeline. The ROPs, Render Output Units, run the depth and stencil tests at per-pixel precision, blend the new shaded color with the value already in the framebuffer, and handle MSAA, a technique that takes multiple depth and color samples per pixel to smooth jagged triangle edges. There are 16 ROPs per slice and 128 across the die.",
      specs: [{ label: "ROPs", value: "128 total" }],
      pipeline: "The last pixel stage, where finished pixels are written out through the L2.",
    },
    l2: {
      name: "L2 cache + memory fabric",
      type: "Cache",
      role: "A single 16 MB L2 is shared by every slice, sampler and ROP, and is reached over the GTI memory fabric, the on-die network that connects the cores to the cache and the memory controllers. Every L1 miss is served from the L2, and any request the L2 cannot satisfy goes out to GDDR6. The 16 MB capacity was large for a 2022 consumer die, and it raises the on-die hit rate so that fewer requests reach external memory.",
      specs: [
        { label: "Capacity", value: "16 MB" },
        { label: "Banks", value: "address-hashed slices" },
      ],
      pipeline: "Accessed by all L1 and shared-local-memory misses, and all remaining misses access the DRAM.",
    },
    mem: {
      name: "GDDR6 controller + PHY",
      type: "Memory interface",
      role: "Eight 32-bit GDDR6 controllers and PHYs form a 256-bit bus running at 17.5 Gbps per pin for 560 GB/s. PHY stands for physical layer which are the analog circuits that drive signals off the chip at high speed. They sit along the die edges because they drive signals off the package, and because analog circuits shrink poorly with each process node, that edge area is a fixed cost of any memory interface.",
      specs: [
        { label: "Controllers", value: "8 × 32-bit" },
        { label: "Capacity", value: "16 GB" },
        { label: "Data rate", value: "17.5 Gbps" },
        { label: "Bandwidth", value: "560 GB/s" },
      ],
      pipeline: "The terminal memory level which services L2 misses.",
    },
    media: {
      name: "Xe Media Engine",
      type: "Fixed function",
      role: "Two multi-format codec engines that encode and decode video independently of the 3D pipeline. These are fixed-function circuits that compress and decompress video far more efficiently than the Xe-cores. Arc shipped the first hardware AV1 encoder in a consumer GPU.",
      specs: [
        { label: "Engines", value: "2 × MFX" },
        { label: "AV1", value: "encode + decode" },
      ],
      pipeline: "Operates frame by frame on surfaces in DRAM.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four independent display pipes, each able to scan a frame out of memory, apply that display's timing and color processing, and drive the DisplayPort 2.0 UHBR 10 and HDMI 2.1 outputs. UHBR 10 is a DisplayPort 2.0 signalling mode that runs each lane at 10 Gbps. One pipe drives each attached display.",
      specs: [
        { label: "Pipes", value: "4" },
        { label: "DisplayPort", value: "2.0 UHBR10" },
        { label: "HDMI", value: "2.1" },
      ],
      pipeline: "Each pipe continuously reads its display's finished frame from memory and sends it to the monitor. The rendered image lives in the framebuffer in memory, and the screen has to be redrawn from it dozens of times every second to stay lit, so this scan-out runs constantly and independently of the 3D pipeline.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "An x16 PCIe Gen4 link to the host that carries command submission, data copies and mapped memory. The driver assumes Resizable BAR is enabled. Resizable BAR lets the CPU map all of the GPU's VRAM into its address space at once rather than through a small window, and without it the A770 loses a substantial amount of performance.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "ReBAR", value: "effectively required" },
      ],
      pipeline: "Entry point for host-originated traffic.",
    },
  },
}
