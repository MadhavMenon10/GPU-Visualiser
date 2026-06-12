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
      role: "Intel's first full-size discrete gaming die: 406 mm² on TSMC N6, 21.7 billion transistors. Compute is organized as eight render slices of four Xe-cores each; all 32 Xe-cores ship enabled on the A770. Every Xe-core carries XMX matrix engines, giving the die approximately 138 INT8 TOPS of fixed-function matrix throughput, consumed primarily by XeSS upscaling. Command processing occupies the top edge, the two banks of slices form the body, and all memory traffic passes through the central 16 MB L2 to GDDR6 controllers on the remaining three edges. Floorplan is schematic; proportions approximate.",
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
      programming: "Programmed through oneAPI: SYCL kernels via Level Zero, or OpenCL, Vulkan and DX12. There is no fixed ISA version scheme analogous to sm_xx; kernels ship as SPIR-V and are JIT-compiled by the driver, so driver revisions can change performance on identical hardware.",
    },
    front: {
      name: "Command streamer + global dispatch",
      type: "Front end",
      role: "Reads command buffers written by the driver, decodes them into draw calls and compute dispatches, and passes thread groups to the global dispatcher, which load-balances them across all 32 Xe-cores. Dispatch throughput here bounds utilization of the entire die.",
      specs: [{ label: "Scheduling unit", value: "thread group / draw" }],
      pipeline: "All submitted work enters here before any other block processes it.",
      programming: "SYCL queue submissions and Level Zero command lists are consumed by this block; a single queue can saturate the device.",
    },
    slice: {
      name: "Render slice",
      type: "Compute cluster",
      role: "Intel's mid-level cluster, comparable in scope to an NVIDIA GPC or an AMD shader engine. Each slice contains four Xe-cores plus the shared graphics fixed-function hardware: a geometry pipeline, a rasterizer, hierarchical-Z, and a 16-ROP pixel backend. Compute workloads exercise only the Xe-cores; the remaining hardware serves the 3D pipeline.",
      specs: [
        { label: "Count", value: "8" },
        { label: "Xe-cores per slice", value: "4" },
        { label: "RT units per slice", value: "4" },
        { label: "ROPs per slice", value: "16" },
      ],
      pipeline: "Receives draws and dispatches from the front end; rasterizes, shades and blends within the slice.",
    },
    xecore: {
      name: "Xe-core",
      type: "Compute unit",
      role: "The unit Intel counts cores by, and the residence of a work-group. Each Xe-core contains 16 vector engines (XVE), 16 matrix engines (XMX), a thread dispatcher, and 192 KB of SRAM partitioned between L1 cache and shared local memory. The organization replaced the earlier EU structure; one Xe-core corresponds to 16 former EUs, one per XVE.",
      specs: [
        { label: "Count", value: "32" },
        { label: "XVE per core", value: "16" },
        { label: "XMX per core", value: "16" },
        { label: "L1/SLM", value: "192 KB (configurable split)" },
        { label: "FP32 lanes", value: "128" },
      ],
      pipeline: "Thread groups arrive from global dispatch; vector and matrix instructions issue to the XVE and XMX pipes; memory requests check L1/SLM before L2.",
      programming: "A SYCL work-group maps to one Xe-core. Sub-groups of 8, 16 or 32 map onto XVE SIMD lanes; shared local memory is carved from the 192 KB L1.",
    },
    xve: {
      name: "XVE (Xe Vector Engine)",
      type: "Execution unit",
      role: "256-bit SIMD ALU; sixteen per Xe-core, 512 per die. Each retires 8 FP32 or 16 FP16 operations per clock, or 32 INT8 via DP4A, with a co-issued extended-math pipe. Each XVE keeps several hardware threads resident and switches among them on stalls; this multithreading, not cache capacity, is the primary mechanism for hiding memory latency.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP32 per clock", value: "8 per XVE" },
        { label: "HW threads", value: "8 per XVE" }, // approx
      ],
      pipeline: "Executes the arithmetic of all shaders and SYCL kernels.",
      programming: "A sub-group of 8 issues as one XVE instruction. FP64 is absent on Alchemist; double-precision code emulates slowly or fails at JIT.",
    },
    xmx: {
      name: "XMX (Xe Matrix Extensions engine)",
      type: "Execution unit",
      role: "1024-bit systolic array; sixteen per Xe-core. Each computes 64 FP16/BF16 or 128 INT8 matrix operations per clock, 8× the rate of the XVE DP4A path, for a die total of approximately 138 INT8 TOPS. Dedicated matrix hardware was uncommon in a 2022 mid-range gaming die and is what makes real-time XeSS inference practical.",
      specs: [
        { label: "Count", value: "512" },
        { label: "FP16 throughput", value: "~69 TFLOPS total" },
        { label: "INT8 throughput", value: "~138 TOPS total" },
      ],
      pipeline: "Shares operand bandwidth with the XVEs; matrix tiles stream from registers and shared local memory.",
      programming: "Reached through SYCL joint_matrix, oneDNN, or DirectML metacommands; XeSS invokes it directly on Arc hardware.",
    },
    l1: {
      name: "L1 / shared local memory",
      type: "Cache",
      role: "192 KB of SRAM per Xe-core, partitioned per kernel between L1 cache and shared local memory. The two uses share capacity: a large SLM allocation reduces the cache available to the same kernel.",
      specs: [
        { label: "Size", value: "192 KB per Xe-core" },
        { label: "SLM", value: "carveout, work-group scoped" },
      ],
      pipeline: "First level for all Xe-core memory accesses; misses proceed to the 16 MB L2.",
    },
    rtu: {
      name: "RTU (Ray Tracing Unit)",
      type: "Fixed function",
      role: "One per Xe-core. Performs BVH traversal and ray-triangle intersection in fixed function. A thread-sorting unit regroups divergent ray hits into SIMD-coherent shading batches before they return to the vector engines; without it, rays striking different materials fragment SIMD efficiency.",
      specs: [
        { label: "Count", value: "32" },
        { label: "Traversal", value: "HW BVH + thread sorting" },
      ],
      pipeline: "Receives ray queries from shaders; returns sorted hit results for shading.",
    },
    smp: {
      name: "Sampler (TMU)",
      type: "Fixed function",
      role: "Texture sampling and filtering. Computes texel addresses, fetches through the cache hierarchy, and applies bilinear, trilinear or anisotropic filtering. Eight per Xe-core, 256 per die.",
      specs: [{ label: "Count", value: "256 (8 per Xe-core)" }],
      pipeline: "Between shader texture requests and the cache hierarchy.",
    },
    raster: {
      name: "Geometry + rasterizer",
      type: "Graphics fixed function",
      role: "Slice-level geometry and rasterization. Vertex fetch, tessellation and culling discard non-visible triangles; the rasterizer converts the remainder into pixel work; hierarchical-Z rejects occluded tiles before any shading is performed.",
      specs: [{ label: "Rasterizers", value: "8 (1 per slice)" }],
      pipeline: "Feeds fragments to the slice's four Xe-cores.",
    },
    pixbe: {
      name: "Pixel backend",
      type: "Graphics fixed function",
      role: "Final stage of the 3D pipeline: depth and stencil test, blending, and write-out through the L2. 16 ROPs per slice, 128 per die; ROP count sets the upper bound on pixels retired per clock.",
      specs: [{ label: "ROPs", value: "128 total" }],
      pipeline: "Final pixel stage; writes through the L2.",
    },
    l2: {
      name: "L2 cache + memory fabric",
      type: "Cache",
      role: "16 MB shared by all slices, samplers and ROPs, reached over the GTI memory fabric. All L1 misses are serviced here; remaining misses go to GDDR6. The capacity was large for a 2022 consumer die and substitutes hit rate for external bandwidth.",
      specs: [
        { label: "Capacity", value: "16 MB" },
        { label: "Banks", value: "address-hashed slices" },
      ],
      pipeline: "Backstop for all L1/SLM misses; remaining misses go to DRAM.",
    },
    mem: {
      name: "GDDR6 controller + PHY",
      type: "Memory interface",
      role: "Eight 32-bit GDDR6 controllers and PHYs form a 256-bit bus at 17.5 Gbps, 560 GB/s. PHYs occupy die edges because they drive off-package signals; analog I/O scales poorly with process, making edge area a fixed cost of any memory interface.",
      specs: [
        { label: "Controllers", value: "8 × 32-bit" },
        { label: "Capacity", value: "16 GB" },
        { label: "Data rate", value: "17.5 Gbps" },
        { label: "Bandwidth", value: "560 GB/s" },
      ],
      pipeline: "Terminal memory level behind L2; services L2 misses.",
    },
    media: {
      name: "Xe Media Engine",
      type: "Fixed function",
      role: "Two multi-format codec engines, encoding and decoding independently of the 3D pipeline. Arc shipped the first hardware AV1 encoder in a consumer GPU.",
      specs: [
        { label: "Engines", value: "2 × MFX" },
        { label: "AV1", value: "encode + decode" },
      ],
      pipeline: "Operates frame by frame on surfaces in DRAM.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four independent display pipes scan frames from memory, apply per-display timing and color processing, and drive the DP 2.0 (UHBR 10) and HDMI 2.1 outputs. One pipe per attached display.",
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
      role: "x16 PCIe Gen4 link carrying command submission, data copies and mapped memory. The driver assumes Resizable BAR; without it the CPU cannot address VRAM in full and performance degrades substantially.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "ReBAR", value: "effectively required" },
      ],
      pipeline: "Entry point for host-originated traffic.",
    },
  },
}
