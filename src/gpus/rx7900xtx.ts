import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 360
const H = 240

function shaderArray(id: string, x: number, y: number, w: number, h: number): Block {
  const sa = blk(id, "group", x, y, w, h, { doc: "sa", children: [] })
  sa.children!.push(blk(`${id}/l1`, "cache", 0.5, 0.5, w - 1, 3.5, { label: "L1 · 256 KB", doc: "l1" }))
  for (const c of tile(4, 2, 0.5, 4.5, w - 1, h - 5, 1)) {
    const wgp = blk(`${id}/wgp${c.i}`, "group", c.x, c.y, c.w, c.h, { doc: "wgp", children: [] })
    for (const s of hstack(2, 0.8, 0.8, c.w - 1.6, c.h - 1.6, 0.7)) {
      wgp.children!.push(blk(`${wgp.id}/cu${s.i}`, "compute", s.x, s.y, s.w, s.h, { label: "CU", doc: "cu" }))
    }
    sa.children!.push(wgp)
  }
  return sa
}

function shaderEngine(i: number, x: number, y: number, w: number, h: number): Block {
  const se = blk(`se${i}`, "group", x, y, w, h, {
    label: `SE${i}`,
    labelPos: "tl",
    doc: "se",
    children: [],
  })
  se.children!.push(blk(`se${i}/raster`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "RASTER · PRIM UNIT · 32 ROP", doc: "raster" }))
  const saW = (w - 4.5) / 2
  se.children!.push(shaderArray(`se${i}/sa0`, 1.5, 11, saW, h - 12.5))
  se.children!.push(shaderArray(`se${i}/sa1`, 3 + saW, 11, saW, h - 12.5))
  return se
}

function mcd(i: number, x: number, y: number, side: "l" | "r"): Block {
  const m = blk(`mcd${i}`, "group", x, y, 52, 68, { label: `MCD${i}`, labelPos: "tl", doc: "mcd", children: [] })
  const phy = blk(`mcd${i}/phy`, "memctl", side === "l" ? 1 : 32, 6, 19, 61, { label: "GDDR6 PHY 64-bit", doc: "gddr" })
  const ic = blk(`mcd${i}/ic`, "cache", side === "l" ? 21 : 7, 6, 24, 61, { label: "INFINITY CACHE 16 MB", doc: "ic" })
  const link = blk(`mcd${i}/link`, "interconnect", side === "l" ? 46 : 1, 6, 5, 61, { doc: "iflink" })
  m.children!.push(phy, ic, link)
  return m
}

function floorplan(): Block {
  const kids: Block[] = []

  vstack(3, 6, 12, 52, 216, 6).forEach((c) => kids.push(mcd(c.i, c.x, c.y, "l")))
  vstack(3, 302, 12, 52, 216, 6).forEach((c) => kids.push(mcd(c.i + 3, c.x, c.y, "r")))

  const gcd = blk("gcd", "group", 64, 8, 232, 224, { label: "GCD · NAVI 31", labelPos: "tl", doc: "die", children: [] })
  const g = gcd.children!

  g.push(blk("gcd/front", "frontend", 1.5, 5.5, 140, 11, { label: "COMMAND PROCESSOR · ACEs · HWS", doc: "front" }))
  g.push(blk("gcd/geo", "frontend", 143.5, 5.5, 87, 11, { label: "GEOMETRY ENGINE", doc: "geo" }))

  vstack(3, 1.5, 18, 103, 190, 2).forEach((c) => g.push(shaderEngine(c.i, c.x, c.y, c.w, c.h)))
  vstack(3, 127.5, 18, 103, 190, 2).forEach((c) => g.push(shaderEngine(c.i + 3, c.x, c.y, c.w, c.h)))

  const l2 = blk("gcd/l2", "cache", 106.5, 18, 19, 190, { label: "L2 6MB", labelPos: "tl", doc: "l2", children: [] })
  vstack(6, 1, 6, 17, 183, 1.5).forEach((c) => {
    l2.children!.push(blk(`gcd/l2/${c.i}`, "cache", c.x, c.y, c.w, c.h, { doc: "l2" }))
  })
  g.push(l2)

  g.push(blk("gcd/media", "media", 1.5, 210, 95, 12, { label: "MEDIA · 2× VCN 4.0 (AV1)", doc: "media" }))
  g.push(blk("gcd/display", "media", 98.5, 210, 85, 12, { label: "RADIANCE DISPLAY · DP 2.1", doc: "display" }))
  g.push(blk("gcd/pcie", "interconnect", 185.5, 210, 45, 12, { label: "PCIe Gen4 ×16", doc: "pcie" }))

  kids.push(gcd)

  return blk("die", "die", 0, 0, W, H, { label: "NAVI 31 PACKAGE", doc: "die", children: kids })
}

export const rx7900xtx: Gpu = {
  id: "rx7900xtx",
  vendor: "AMD",
  name: "Radeon RX 7900 XTX",
  die: "Navi 31",
  arch: "RDNA 3",
  isa: "gfx1100",
  process: "TSMC N5 + N6",
  floorplan,
  docs: {
    die: {
      name: "Navi 31 (RX 7900 XTX)",
      type: "Package overview",
      role: "Navi 31 is a chiplet package made up of one Graphics Compute Die, measuring approximately 304 mm² on TSMC N5, and six Memory Cache Dies, each 37.5 mm², on TSMC N6. The two chip types are connected through the organic package substrate. The GCD carries all compute and graphics logic. Each MCD carries a 16 MB Infinity Cache slice and a 64-bit GDDR6 memory controller. The package contains 57.7 billion transistors.",
      specs: [
        { label: "Chiplets", value: "1× GCD (N5) + 6× MCD (N6)" },
        { label: "Transistors", value: "57.7 B total" },
        { label: "Silicon", value: "~304 mm² GCD + 6 × 37.5 mm² MCD" },
        { label: "Compute Units", value: "96 (48 WGPs, 6 shader engines)" },
        { label: "Stream processors", value: "6 144 (dual-issue FP32)" },
        { label: "Ray accelerators", value: "96 (2nd gen)" },
        { label: "AI accelerators", value: "192" },
        { label: "Infinity Cache", value: "96 MB (2nd gen)" },
        { label: "L2 cache", value: "6 MB" },
        { label: "Memory", value: "24 GB GDDR6, 384-bit, 20 Gbps" },
        { label: "Mem bandwidth", value: "960 GB/s" },
        { label: "Game / boost clock", value: "2.3 / 2.5 GHz" },
        { label: "FP32", value: "61.4 TFLOPS (dual-issue)" },
        { label: "ROPs", value: "192" },
        { label: "TBP", value: "355 W" },
      ],
      pipeline: "Draw commands enter the command processor and the geometry engine assembles and culls primitives. The six shader engines rasterize those primitives into pixel fragments, shade them on their CUs, and write final pixels through their ROPs. All memory traffic from the shader arrays passes through the 6 MB L2 on the GCD, then crosses the Infinity Links to the Infinity Cache slices in the MCDs. On a cache miss in the Infinity Cache, the GDDR6 controllers service the request. A compute workload skips the raster stages entirely and is dispatched directly to the shader engines.",
      programming: "AMD's GPU programming model is HIP, which closely mirrors CUDA. Code is compiled targeting gfx1100. Wavefronts, AMD's equivalent of NVIDIA warps, can run as 32 or 64 lanes. RDNA 3 introduced VOPD, a dual-issue mode where the compiler pairs two vector instructions that use different execution resources, retiring two FP32 operations in the same clock cycle.",
    },
    front: {
      name: "Command processor + ACEs",
      type: "Front end",
      role: "Receives kernel launches and draw calls from the host and distributes work across the six shader engines. Asynchronous Compute Engines, or ACEs, allow compute queues to run concurrently with graphics workloads rather than waiting for the 3D pipeline to go idle. A hardware scheduler maps the many queues that the operating system exposes onto the physical queue slots available in hardware. Copy engines handle DMA transfers in parallel with shader work. DMA, Direct Memory Access, lets dedicated hardware copy data between host and device memory without involving the CPU or the CUs, so the GPU can load the next batch while it computes on the current one.",
      specs: [
        { label: "Compute queues", value: "ACE-managed, async" },
        { label: "Front-end clock", value: "2.5 GHz (decoupled)" },
      ],
      pipeline: "It sits between the host interface and the shader engines, and every command stream passes through it.",
      programming: "HIP streams are mapped onto hardware queues here. Whether compute and graphics work actually overlap depends on how the ACEs schedule those queues.",
    },
    geo: {
      name: "Geometry engine",
      type: "Graphics fixed function",
      role: "The geometry engine performs primitive assembly, tessellation and culling for the entire die at up to 12 primitives per clock. Tessellation takes a coarse mesh and subdivides it into many smaller triangles at runtime using a programmable shader, allowing smooth surfaces to be stored compactly and only expanded at draw time. Multi-draw indirect allows the GPU to consume a buffer of draw commands prepared by the CPU in advance, rather than requiring the CPU to submit each draw call one at a time. A single geometry engine on the GCD means the full primitive throughput is always available regardless of how shader workload distributes across engines.",
      specs: [{ label: "Primitive rate", value: "up to 12 prims/clk culled" }], // approx
      pipeline: "Distributes assembled primitives to the rasterizers, the fixed-function units in each shader engine that scan triangles into the 2D grid of pixels they cover.",
    },
    se: {
      name: "Shader Engine",
      type: "Compute cluster",
      role: "One of the six top-level compute clusters and AMD's equivalent of an NVIDIA GPC. Each shader engine holds two shader arrays and a rasterizer with 32 ROPs, for 16 CUs per engine. The ROPs, Render Output Units, run depth and stencil tests at per-pixel precision and blend the new shaded color with the existing framebuffer value.",
      specs: [
        { label: "Count", value: "6" },
        { label: "WGPs per SE", value: "8 (2 arrays × 4)" },
        { label: "CUs per SE", value: "16" },
        { label: "ROPs per SE", value: "32" },
      ],
      pipeline: "Receives primitives from the geometry engine, rasterizes them, shades the resulting fragments on its WGPs, and blends final pixels through its render backends.",
    },
    sa: {
      name: "Shader Array",
      type: "Compute cluster",
      role: "Half of a shader engine, holding four WGPs that share a 256 KB graphics L1 cache. The L1 absorbs texture and buffer misses from the per-CU L0 caches, reducing the amount of traffic that must travel to the L2 across the die interconnect.",
      specs: [
        { label: "Count", value: "12 (2 per SE)" },
        { label: "WGPs per array", value: "4" },
        { label: "L1 per array", value: "256 KB" },
      ],
      pipeline: "L0 misses from its WGPs hit the array L1 before going to the L2.",
    },
    raster: {
      name: "Rasterizer + render backends",
      type: "Graphics fixed function",
      role: "The rasterizer in each shader engine takes primitives from the geometry engine and determines which pixels they cover. Z-cull performs a hierarchical depth test that discards entire pixel tiles which are behind geometry already drawn, preventing the CUs from shading pixels that will never be visible. The ROPs, Render Output Units, run depth and stencil tests at per-pixel precision, blend the new shaded color with the existing framebuffer value, and handle MSAA, a technique that takes multiple depth and color samples per pixel to smooth jagged triangle edges. 192 ROPs are active across the six shader engines on the 7900 XTX.",
      specs: [
        { label: "ROPs total", value: "192" },
        { label: "Rasterizers", value: "6" },
      ],
      pipeline: "Sits between the geometry engine and the CUs. ROPs write final pixels into the L2.",
    },
    wgp: {
      name: "WGP (Workgroup Processor)",
      type: "Compute unit",
      role: "The WGP, or Workgroup Processor, is RDNA's scheduling unit, made up of two CUs that share 128 KB of LDS, which is AMD's name for shared memory, along with common instruction caches. In workgroup mode a workgroup spans both CUs and has access to the full 128 KB LDS. The WGP is the closest AMD equivalent to an NVIDIA SM.",
      specs: [
        { label: "Count", value: "48" },
        { label: "CUs per WGP", value: "2 (4 × SIMD32)" },
        { label: "LDS", value: "128 KB shared" },
      ],
      pipeline: "Receives workgroups from the shader engine distributor and schedules wavefronts onto its SIMD32 units.",
      programming: "A HIP workgroup maps to one WGP. LDS is declared __shared__. Occupancy is counted in waves per SIMD, with a maximum of 16.",
    },
    cu: {
      name: "CU (Compute Unit)",
      type: "Compute unit",
      role: "Two SIMD32 vector units, each with a 192 KB register file, plus a scalar unit for values that are uniform across an entire wavefront. Each CU also has one second-generation ray accelerator and two AI accelerators for matrix multiply operations. Dual-issue FP32 allows two vector operations to retire in the same clock cycle when the compiler can pair instructions that use different execution resources. In ray tracing, a BVH, or Bounding Volume Hierarchy, is a tree of nested bounding boxes used to find which triangles a ray might hit. The ray tests boxes first and only examines the triangles inside a box when it actually intersects it, avoiding tests against most of the scene. The ray accelerator handles BVH intersection tests in hardware.",
      specs: [
        { label: "Count", value: "96" },
        { label: "SIMD32 per CU", value: "2" },
        { label: "Stream processors", value: "64 (dual-issue)" },
        { label: "VGPR", value: "192 KB per SIMD" },
        { label: "L0 cache", value: "32 KB" },
        { label: "Ray accelerator", value: "1 (box + triangle)" },
        { label: "AI accelerators", value: "2 (WMMA)" },
      ],
      pipeline: "Executes wavefronts issued by the WGP scheduler. Memory operations proceed from L0 to array L1 to L2 to Infinity Cache to GDDR6.",
      programming: "rocWMMA exposes the AI accelerators through FP16, BF16 and INT8 matrix operations. Ray queries issued from shaders invoke the hardware ray accelerator for box and triangle intersection.",
    },
    l1: {
      name: "Graphics L1 cache",
      type: "Cache",
      role: "A 256 KB cache per shader array, sitting between the per-CU L0 caches and the global 6 MB L2. Every L0 miss that hits here is served at on-chip latency without crossing the wider die interconnect.",
      specs: [
        { label: "Size", value: "256 KB per array" },
        { label: "Arrays", value: "12" },
      ],
      pipeline: "Second cache level. Misses go to the L2 on the GCD.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A 6 MB L2 on the GCD is the coherence point for all memory traffic on the die. All misses from the twelve shader array L1 caches pass through it. When the L2 misses, the request crosses an Infinity Link to the Infinity Cache slice in the MCD responsible for that address range.",
      specs: [
        { label: "Size", value: "6 MB" },
        { label: "Location", value: "GCD, central spine" },
      ],
      pipeline: "Collects L1 misses and forwards misses to the Infinity Cache slice that owns the address.",
    },
    ic: {
      name: "Infinity Cache slice",
      type: "Cache (MCD)",
      role: "Each MCD carries a 16 MB slice of Infinity Cache, totaling 96 MB across the six MCDs. The Infinity Cache is a large SRAM buffer that acts as a memory-side cache in front of each GDDR6 controller. When a request arrives from the GCD, the Infinity Cache either serves it from SRAM or forwards the miss to GDDR6. SRAM bandwidth is far higher than GDDR6 bandwidth, so requests that hit in the Infinity Cache are returned quickly and consume no GDDR6 bandwidth. The total internal bandwidth across all six slices is approximately 5.3 TB/s, which allows the 384-bit GDDR6 bus to feed 96 active CUs.",
      specs: [
        { label: "Per MCD", value: "16 MB" },
        { label: "Total", value: "96 MB" },
        { label: "Peak bandwidth", value: "~5.3 TB/s aggregate" },
      ],
      pipeline: "Memory-side cache. L2 misses land here before going to GDDR6.",
    },
    gddr: {
      name: "GDDR6 controller + PHY",
      type: "Memory interface",
      role: "One 64-bit GDDR6 controller and PHY per MCD. Six MCDs form a 384-bit total bus running at 20 Gbps per pin for 960 GB/s combined. PHY stands for physical layer which are the analog circuits that drive signals off the chip at high speed.",
      specs: [
        { label: "Per MCD", value: "64-bit" },
        { label: "Total bus", value: "384-bit" },
        { label: "Data rate", value: "20 Gbps" },
        { label: "Bandwidth", value: "960 GB/s" },
      ],
      pipeline: "The terminal memory level which services Infinity Cache misses.",
    },
    iflink: {
      name: "Infinity Link",
      type: "Interconnect",
      role: "The Infinity Link is the die-to-die interconnect running between the GCD and each MCD. It runs at 9.2 Gbps per wire over the organic package substrate, which is patterned at approximately ten times the trace density of a conventional circuit board. All L2 misses from the GCD must cross one of these links to reach the Infinity Cache and GDDR6 on the MCDs. The aggregate bandwidth across all six links is approximately 5.3 TB/s.",
      specs: [
        { label: "Signalling", value: "9.2 Gb/s per pin" },
        { label: "Aggregate", value: "~5.3 TB/s (all links)" },
      ],
      pipeline: "Carries all L2-miss traffic between GCD and MCDs.",
    },
    media: {
      name: "Media engine (VCN 4.0)",
      type: "Fixed function",
      role: "Two VCN 4.0 video codec engines supporting AV1 encode and decode, H.264 and HEVC. These are fixed-function circuits that compress and decompress video far more efficiently than CUs. Two engines allow two simultaneous encode streams independent of 3D work.",
      specs: [
        { label: "Engines", value: "2 × VCN 4.0" },
        { label: "AV1", value: "encode + decode" },
      ],
      pipeline: "Operates on frames in memory, independent of the 3D pipeline.",
    },
    display: {
      name: "Radiance Display Engine",
      type: "Fixed function",
      role: "Four display heads with the first consumer implementation of DisplayPort 2.1 UHBR 13.5, which carries 54 Gbps per link. This is enough bandwidth for 4K at 480 Hz or 8K at 165 Hz with Display Stream Compression. Display Stream Compression, or DSC, is a visually lossless encoding that halves the data rate on the link, allowing higher resolutions or refresh rates than the raw link bandwidth would otherwise permit.",
      specs: [
        { label: "DisplayPort", value: "2.1 UHBR 13.5" },
        { label: "HDMI", value: "2.1a" },
      ],
      pipeline: "Scan-out from memory, independent of the 3D pipeline.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "An x16 PCIe Gen4 link to the host CPU, which moves 32 GB/s in each direction for 64 GB/s of bidirectional bandwidth. It carries command submissions and host memory copies.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
    mcd: {
      name: "MCD (Memory Cache Die)",
      type: "Chiplet",
      role: "Each MCD is a 37.5 mm² chiplet manufactured on TSMC N6, carrying one 16 MB Infinity Cache slice and one 64-bit GDDR6 PHY. It attaches to the GCD by an Infinity Link through the package substrate. Six MCDs are present on the 7900 XTX. The harvested 7900 XT uses five. Because each MCD is small, individual dies yield well and a defective MCD can be replaced without discarding the GCD.",
      specs: [
        { label: "Count", value: "6" },
        { label: "Die size", value: "37.5 mm² each" },
        { label: "Process", value: "TSMC N6" },
        { label: "Contents", value: "16 MB IC + 64-bit PHY" },
      ],
      pipeline: "Memory-side chiplet that receives L2 misses from the GCD over its Infinity Link and either services them from Infinity Cache or forwards them to GDDR6.",
    },
  },
}
