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
      role: "The first chiplet gaming GPU: an approximately 304 mm² N5 Graphics Compute Die surrounded by six 37.5 mm² N6 Memory Cache Dies, each pairing a 64-bit GDDR6 PHY with a 16 MB Infinity Cache slice; 57.7 billion transistors in total. The partition follows process economics: logic scales on N5 while SRAM and PHYs do not, so the latter are manufactured on the cheaper node. View shows the package; proportions approximate.",
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
      pipeline: "Command processor dispatches to 6 shader engines; memory requests miss L0 → L1 → L2 on the GCD, then cross Infinity Links to the MCD Infinity Cache slices and GDDR6 controllers.",
      programming: "Target gfx1100 with HIP/ROCm; wavefronts are 32 or 64 lanes. VOPD dual-issue FP32 pairs two instructions per cycle where the compiler finds candidates; the doubled peak TFLOPS figure assumes ideal pairing, which real shaders rarely sustain.",
    },
    front: {
      name: "Command processor + ACEs",
      type: "Front end",
      role: "Decodes command streams and distributes work across the six shader engines. Asynchronous Compute Engines run compute queues concurrently with graphics; a hardware scheduler maps the many queues the OS exposes onto the limited physical queue slots. The front end clocks at 2.5 GHz against the 2.3 GHz shader clock so that setup does not bound the shader array.",
      specs: [
        { label: "Compute queues", value: "ACE-managed, async" },
        { label: "Front-end clock", value: "2.5 GHz (decoupled)" },
      ],
      pipeline: "First stop for all submitted work; feeds the shader engines.",
      programming: "HIP streams map to hardware queues here; graphics-compute overlap is the default.",
    },
    geo: {
      name: "Geometry engine",
      type: "Graphics fixed function",
      role: "Single die-level geometry processor: primitive assembly, tessellation, and culling at up to 12 primitives per clock. RDNA 3 also accelerates multi-draw indirect, in which the GPU consumes a buffer of draw commands without per-draw CPU submission. Centralization keeps the full culling rate available regardless of how load distributes across engines.",
      specs: [{ label: "Primitive rate", value: "up to 12 prims/clk culled" }], // approx
      pipeline: "Distributes assembled primitives to the per-SE rasterizers.",
    },
    se: {
      name: "Shader Engine",
      type: "Compute cluster",
      role: "One of six clusters; the AMD analogue of an NVIDIA GPC. Each pairs a rasterizer, primitive unit and 32 ROPs with two shader arrays of four WGPs, for 16 CUs per engine. Rasterization, shading and blending for a draw complete within one engine; only memory traffic leaves it.",
      specs: [
        { label: "Count", value: "6" },
        { label: "WGPs per SE", value: "8 (2 arrays × 4)" },
        { label: "CUs per SE", value: "16" },
        { label: "ROPs per SE", value: "32" },
      ],
      pipeline: "Receives primitives from the geometry engine, rasterizes, shades on its WGPs, blends in its render backends.",
    },
    sa: {
      name: "Shader Array",
      type: "Compute cluster",
      role: "Half of a shader engine: four WGPs sharing a 256 KB graphics L1 cache. The L1 absorbs texture and buffer misses from the WGP L0 caches, limiting traffic on the die-level interconnect.",
      specs: [
        { label: "Count", value: "12 (2 per SE)" },
        { label: "WGPs per array", value: "4" },
        { label: "L1 per array", value: "256 KB" },
      ],
      pipeline: "L0 misses from its WGPs hit the array L1 before going to L2.",
    },
    raster: {
      name: "Rasterizer + render backends",
      type: "Graphics fixed function",
      role: "Per-engine scan conversion with hierarchical-Z rejection, plus RB+ render backends performing depth test and blending: 32 ROPs per engine, 192 total. ROP count bounds pixels retired per clock.",
      specs: [
        { label: "ROPs total", value: "192" },
        { label: "Rasterizers", value: "6" },
      ],
      pipeline: "Between geometry distribution and fragment shading; pixel writes flow through L2 toward the MCDs.",
    },
    wgp: {
      name: "WGP (Workgroup Processor)",
      type: "Compute unit",
      role: "RDNA's scheduling unit: two CUs sharing 128 KB of LDS and common instruction caches; 48 per die. In WGP mode a workgroup spans all four SIMD32s and the full LDS; CU mode restricts sharing to one CU. The WGP is the appropriate unit of comparison with an NVIDIA SM.",
      specs: [
        { label: "Count", value: "48" },
        { label: "CUs per WGP", value: "2 (4 × SIMD32)" },
        { label: "LDS", value: "128 KB shared" },
      ],
      pipeline: "Receives workgroups from the SE; schedules wave32/wave64 onto its SIMDs.",
      programming: "A HIP workgroup maps to one WGP; LDS is __shared__. Occupancy is counted in waves per SIMD (max 16).",
    },
    cu: {
      name: "CU (Compute Unit)",
      type: "Compute unit",
      role: "Two SIMD32 vector units, each with a 192 KB register file, 1.5× the size of RDNA 2's, plus a scalar unit for wave-uniform values, one second-generation ray accelerator, and two WMMA AI accelerators. Dual-issue FP32 retires two vector operations per clock when the compiler pairs instructions; the sustained gain depends on instruction mix.",
      specs: [
        { label: "Count", value: "96" },
        { label: "SIMD32 per CU", value: "2" },
        { label: "Stream processors", value: "64 (dual-issue)" },
        { label: "VGPR", value: "192 KB per SIMD" },
        { label: "L0 cache", value: "32 KB" },
        { label: "Ray accelerator", value: "1 (box + triangle)" },
        { label: "AI accelerators", value: "2 (WMMA)" },
      ],
      pipeline: "Executes waves issued by the WGP scheduler; memory ops go L0 → array L1 → L2 → Infinity Cache → GDDR6.",
      programming: "rocWMMA targets the AI accelerators with FP16/BF16/INT8 tiles. Ray queries issue from shaders; BVH traversal executes as shader code, with hardware acceleration limited to box and triangle tests.",
    },
    l1: {
      name: "Graphics L1 cache",
      type: "Cache",
      role: "256 KB per shader array, double RDNA 2, between the CU L0 caches and the global L2. Each hit removes traffic from the die-level interconnect and the chiplet links.",
      specs: [
        { label: "Size", value: "256 KB per array" },
        { label: "Arrays", value: "12" },
      ],
      pipeline: "Second cache level; misses go to L2 on the GCD.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "6 MB on the GCD, the device coherence point, collecting misses from all twelve array L1s. Misses leave the die over the Infinity Links, so L2 hit rate directly determines chiplet-link load.",
      specs: [
        { label: "Size", value: "6 MB" },
        { label: "Location", value: "GCD, central spine" },
      ],
      pipeline: "Collects L1 misses; misses forward to the Infinity Cache slice owning the address.",
    },
    ic: {
      name: "Infinity Cache slice",
      type: "Cache (MCD)",
      role: "16 MB of SRAM per MCD, 96 MB total; a memory-side cache fronting each GDDR6 controller. Aggregate hit bandwidth is approximately 5.3 TB/s against 960 GB/s of DRAM bandwidth; this amplification is what allows a 384-bit bus to feed 96 CUs.",
      specs: [
        { label: "Per MCD", value: "16 MB" },
        { label: "Total", value: "96 MB" },
        { label: "Peak bandwidth", value: "~5.3 TB/s aggregate" },
      ],
      pipeline: "Memory-side cache: L2 misses land here before DRAM.",
    },
    gddr: {
      name: "GDDR6 controller + PHY",
      type: "Memory interface",
      role: "One 64-bit GDDR6 controller and PHY per MCD; six MCDs form the 384-bit interface at 20 Gbps, 960 GB/s. PHY area does not scale with process, and relocating it to N6 chiplets is the principal cost saving of the design.",
      specs: [
        { label: "Per MCD", value: "64-bit" },
        { label: "Total bus", value: "384-bit" },
        { label: "Data rate", value: "20 Gbps" },
        { label: "Bandwidth", value: "960 GB/s" },
      ],
      pipeline: "Terminal memory level behind the Infinity Cache slice.",
    },
    iflink: {
      name: "Infinity Link",
      type: "Interconnect",
      role: "Die-to-die fanout link running 9.2 Gb/s per wire over the organic package substrate at approximately 10× conventional package trace density, for approximately 5.3 TB/s aggregate across six links. All GCD L2 misses cross these links.",
      specs: [
        { label: "Signalling", value: "9.2 Gb/s per pin" },
        { label: "Aggregate", value: "~5.3 TB/s (all links)" },
      ],
      pipeline: "Carries all L2-miss traffic between GCD and MCDs.",
    },
    media: {
      name: "Media engine (VCN 4.0)",
      type: "Fixed function",
      role: "Two VCN 4.0 codec engines: AV1 encode and decode, H.264, HEVC. Two engines permit two simultaneous encode streams, independent of the 3D pipeline.",
      specs: [
        { label: "Engines", value: "2 × VCN 4.0" },
        { label: "AV1", value: "encode + decode" },
      ],
      pipeline: "Operates on frames in memory, independent of the 3D pipeline.",
    },
    display: {
      name: "Radiance Display Engine",
      type: "Fixed function",
      role: "First consumer DisplayPort 2.1 implementation (UHBR 13.5, 54 Gbps): 4K at 480 Hz or 8K at 165 Hz with DSC.",
      specs: [
        { label: "DisplayPort", value: "2.1 UHBR 13.5" },
        { label: "HDMI", value: "2.1a" },
      ],
      pipeline: "Scan-out from memory.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "x16 PCIe Gen4 on the GCD for command submission and host copies.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "Entry point for host-originated work.",
    },
    mcd: {
      name: "MCD (Memory Cache Die)",
      type: "Chiplet",
      role: "37.5 mm² N6 chiplet pairing one 16 MB Infinity Cache slice with one 64-bit GDDR6 PHY, attached to the GCD by an Infinity Link. Six populate the XTX; the harvested 7900 XT uses five. Dies this small yield well, which completes the cost argument for the partition.",
      specs: [
        { label: "Count", value: "6" },
        { label: "Die size", value: "37.5 mm² each" },
        { label: "Process", value: "TSMC N6" },
        { label: "Contents", value: "16 MB IC + 64-bit PHY" },
      ],
      pipeline: "Memory-side: receives L2 misses over its Infinity Link.",
    },
  },
}
