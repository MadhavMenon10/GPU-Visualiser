import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 292
const H = 238

// 128 SMs: 64 of 66 TPCs across 11 GPCs, 12th GPC fused; exact fuse positions vary; approx
const GPC_TPCS = [6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 0]

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
  const enabled = GPC_TPCS[i]
  if (enabled === 0) {
    return blk(`gpc${i}`, "compute", x, y, w, h, {
      label: "GPC · FUSED",
      doc: "gpc",
      disabled: true,
    })
  }
  const g = blk(`gpc${i}`, "group", x, y, w, h, {
    label: `GPC${i}`,
    labelPos: "tl",
    doc: "gpc",
    children: [],
  })
  g.children!.push(blk(`gpc${i}/raster`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "RASTER · 16 ROP", doc: "raster" }))
  for (const c of tile(6, 2, 1.5, 11.5, w - 3, h - 13, 1)) {
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

  kids.push(blk("front", "frontend", 20, 3, 76, 11, { label: "GigaThread · front end", doc: "front" }))
  kids.push(blk("display", "media", 98, 3, 58, 11, { label: "DISPLAY · DP1.4a · HDMI2.1", doc: "display" }))
  kids.push(blk("media", "media", 158, 3, 52, 11, { label: "2× NVENC · 1× NVDEC", doc: "media" }))
  kids.push(blk("ofa", "media", 212, 3, 14, 11, { label: "OFA", doc: "ofa" }))
  kids.push(blk("pcie", "interconnect", 228, 3, 44, 11, { label: "PCIe Gen4 ×16", doc: "pcie" }))

  vstack(3, 3, 16, 14, 203, 3).forEach((c) => {
    kids.push(blk(`gddr-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })
  vstack(3, W - 17, 16, 14, 203, 3).forEach((c) => {
    kids.push(blk(`gddr-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })
  hstack(6, 20, 222, 252, 12, 3).forEach((c) => {
    kids.push(blk(`gddr-b${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "GDDR6X PHY 32-bit", doc: "mem" }))
  })

  tile(6, 6, 20, 16, 252, 86, 2.5).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(6, 6, 20, 133, 252, 86, 2.5).forEach((c) => kids.push(gpc(c.i + 6, c.x, c.y, c.w, c.h)))

  const l2 = blk("l2", "cache", 20, 104.5, 252, 26, {
    label: "L2 CACHE · 72 MB (96 MB PHYSICAL)",
    labelPos: "tl",
    doc: "l2",
    children: [],
  })
  hstack(12, 1.5, 6.5, 249, 18, 1).forEach((c) => {
    l2.children!.push(blk(`l2/${c.i}`, "cache", c.x, c.y, c.w, c.h, { label: "6 MB", doc: "l2" }))
  })
  kids.push(l2)

  return blk("die", "die", 0, 0, W, H, { label: "AD102", doc: "die", children: kids })
}

export const rtx4090: Gpu = {
  id: "rtx4090",
  vendor: "NVIDIA",
  name: "GeForce RTX 4090",
  die: "AD102",
  arch: "Ada Lovelace",
  isa: "sm_89",
  process: "TSMC 4N",
  floorplan,
  docs: {
    die: {
      name: "AD102 (GeForce RTX 4090)",
      type: "Die overview",
      role: "AD102 measures approximately 608 mm² on TSMC 4N and carries 76.3 billion transistors. The RTX 4090 ships with 128 of 144 SMs active across 11 of 12 GPCs, and 72 of the 96 MB physical L2 turned on. Flaws are inevitable when manufacturing a die this large, so NVIDIA sells parts with some units disabled rather than discarding the silicon, and the disabled positions vary from die to die.",
      specs: [
        { label: "Process", value: "TSMC 4N" },
        { label: "Transistors", value: "76.3 B" },
        { label: "Die size", value: "~608 mm²" },
        { label: "SMs", value: "128 (144 on full die)" },
        { label: "CUDA cores", value: "16 384" },
        { label: "Tensor Cores", value: "512 (4th gen, FP8)" },
        { label: "RT Cores", value: "128 (3rd gen)" },
        { label: "ROPs", value: "176" },
        { label: "L2 cache", value: "72 MB (96 MB physical)" },
        { label: "Memory", value: "24 GB GDDR6X, 384-bit" },
        { label: "Mem bandwidth", value: "1 008 GB/s" },
        { label: "Boost clock", value: "2.52 GHz" },
        { label: "FP32", value: "82.6 TFLOPS" },
        { label: "FP16 Tensor", value: "330 TFLOPS (661 sparse)" },
        { label: "TGP", value: "450 W" },
      ],
      pipeline: "In a graphics workload, draw commands enter the front end and geometry is converted into pixel fragments by the raster engines, the fixed-function units in each GPC that scan triangles into the 2D grid of pixels they cover. Those fragments are shaded on the SMs, then the ROPs, fixed-function units that run depth tests and blend the new pixel color with whatever is already in the framebuffer, write the final result into the L2. Completed frames then flow from the L2 out to GDDR6X. A compute workload, meaning a CUDA kernel with no graphics pipeline involved, skips the raster stages entirely and goes directly from the front end to the SMs. The large L2 intercepts most repeated traffic that would otherwise reach GDDR6X.",
      programming: "Code is compiled with -arch=sm_89. FP8 halves the storage per operand compared to FP16, doubling Tensor Core throughput on models that tolerate the reduced precision. Shader Execution Reordering, or SER, addresses a problem specific to ray tracing: when rays from different pixels strike different materials, each warp ends up running a different shader, wasting most of its SIMD lanes. SER collects divergent ray hits and regroups them into batches of similar materials before shading, so each warp runs one shader at full width. The Optical Flow Accelerator computes dense per-pixel motion vectors between consecutive frames in fixed function, and DLSS 3 combines these vectors with the game's own motion data to synthesize intermediate frames entirely on the GPU.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "The top-level compute partition contains up to 6 TPCs, which amounts to 12 SMs since each TPC holds two. Each GPC also includes a raster engine, which converts 3D triangles into 2D pixel fragments that shaders can process, and 16 ROPs for depth testing and pixel blending. Eleven of the twelve physical GPCs are active on the 4090, with the twelfth disabled for yield.",
      specs: [
        { label: "Count", value: "11 enabled (12 physical)" },
        { label: "TPCs per GPC", value: "6 (5 in two harvested GPCs)" },
        { label: "ROPs per GPC", value: "16" },
        { label: "Raster engines", value: "1 per GPC" },
      ],
      pipeline: "The GigaThread Engine balances work across GPCs. A per-GPC distributor then assigns thread blocks to individual SMs.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs plus a PolyMorph engine performing vertex fetch, tessellation and viewport transform. Flaws are inevitable at the scale AD102 is manufactured, so NVIDIA sells parts with some TPCs disabled rather than discarding the silicon. 64 of the 66 physical TPCs are active across the eleven GPCs, and the disabled positions vary from die to die.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "64 of 72 (whole die)" },
      ],
      pipeline: "A pass-through level between GPC work distribution and the SM schedulers.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each with 16 dedicated FP32 lanes, 16 dual-mode FP32/INT32 lanes, and one fourth-generation Tensor Core with FP8 support. The dual-mode lanes can switch between FP32 and INT32 each cycle, so FP32-heavy workloads approach double the throughput. The third-generation RT Core accelerates ray tracing. In ray tracing, a BVH, or Bounding Volume Hierarchy, is a tree of nested bounding boxes used to find which triangles a ray might hit. The ray tests boxes first and only examines the triangles inside a box when it actually intersects it, avoiding tests against most of the scene. Opacity micromaps pre-encode transparency for alpha-tested geometry, which is geometry like foliage or fences where some pixels are transparent based on a texture value. Without them, the GPU must execute a shader on each potential hit just to learn whether the surface is opaque. Opacity micromaps let the RT Core answer that without a shader invocation. Displaced micro-meshes allow highly detailed surfaces like rocks to be represented compactly inside the BVH, reducing both memory use and the time needed to build the acceleration structure.",
      specs: [
        { label: "Count", value: "128" },
        { label: "FP32 lanes", value: "128 (64 + 64 shared w/ INT32)" },
        { label: "Tensor Cores", value: "4 × 4th gen (FP8)" },
        { label: "RT Core", value: "1 × 3rd gen" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤100 KB shared" },
        { label: "Texture units", value: "4" },
        { label: "Max occupancy", value: "48 warps · 1536 threads" },
      ],
      pipeline: "The SM receives thread blocks from the GPC distributor. Each block is divided into 32-thread warps, which the warp schedulers issue onto the execution pipelines. Load and store traffic flows through the L1, then the L2, and out to GDDR6X.",
      programming: "One thread block executes on exactly one SM, with a maximum of 1536 threads per block on consumer Ada. Declaring a variable __shared__ places it in the L1 carveout, where all threads in the block can reach it at on-chip latency. SER on sm_89 is available through NVAPI and OptiX and is most effective for path-traced workloads with high material diversity.",
    },
    raster: {
      name: "Raster engine + ROPs",
      type: "Graphics fixed function",
      role: "The raster engine in each GPC takes triangles from the geometry pipeline and determines which pixels they cover, a process called rasterization. Triangle setup computes the edge equations for each triangle; the rasterizer scans those equations across the pixel grid to find covered pixels. Z-cull performs a hierarchical depth test that discards entire pixel tiles which are behind geometry already drawn, preventing the SMs from shading pixels that will never be visible. The ROPs, Render Output Units, sit at the end of the pipeline. Each ROP partition runs depth and stencil tests at per-pixel precision, blends the new shaded color with the existing framebuffer value, and handles MSAA, a technique that takes multiple depth and color samples per pixel to smooth jagged triangle edges. Because the ROPs are inside the GPC rather than a shared central block, pixel throughput scales with the number of active GPCs. 176 ROPs are active across the eleven GPCs on the 4090.",
      specs: [
        { label: "ROPs total", value: "176 (11 × 16)" },
        { label: "Rasterizers", value: "11" },
      ],
      pipeline: "Sits between the geometry pipeline and the SMs. ROPs write final pixels into the L2.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "The L2 is split into twelve 8 MB physical slices, of which 72 MB are active on the 4090. At that size it holds the working sets of most rendering and inference tasks entirely on-die, so the majority of traffic never reaches GDDR6X. BVH traversal for ray tracing benefits most, combining high data reuse with scattered memory access patterns that would otherwise thrash a smaller cache.",
      specs: [
        { label: "Capacity", value: "72 MB enabled / 96 MB physical" },
        { label: "Slices", value: "12 (paired with 32-bit MCs)" },
      ],
      pipeline: "When an SM's L1 cache cannot satisfy a load or store, the request travels to the L2 slice that owns the target address. Atomic operations issued by multiple SMs on the same address are also arbitrated here rather than going out to GDDR6X.",
      programming: "cudaAccessPolicyWindow pins a specified address range as persistent in the L2. Data in that range will not be evicted by streaming traffic, which is useful for model weights reread every kernel launch.",
    },
    mem: {
      name: "GDDR6X memory controller + PHY",
      type: "Memory interface",
      role: "Twelve 32-bit GDDR6X controllers form the 384-bit bus. GDDR6X uses PAM4 signalling, which encodes two bits per symbol rather than one, reaching 21 Gbps per pin for 1008 GB/s total. The large L2 absorbs most repeated reads, so the GDDR6X interface mainly carries first-time fetches and write-backs.",
      specs: [
        { label: "Controllers", value: "12 × 32-bit" },
        { label: "Capacity", value: "24 GB (12 × 16 Gb)" },
        { label: "Data rate", value: "21 Gbps PAM4" },
        { label: "Bandwidth", value: "1 008 GB/s" },
      ],
      pipeline: "The terminal memory level, servicing L2 misses.",
    },
    front: {
      name: "GigaThread Engine + front end",
      type: "Front end",
      role: "Receives kernel launches and draw calls from the host and distributes work across the eleven active GPCs. Context switching lets multiple processes share the GPU by saving and restoring state. Copy engines handle DMA transfers in parallel with kernels. DMA, Direct Memory Access, lets dedicated hardware copy data between host and device memory without involving the CPU or the SMs, so the GPU can load the next batch while it computes on the current one.",
      specs: [{ label: "Scheduling unit", value: "thread block / draw" }],
      pipeline: "It sits between the host interface and the GPCs, and every kernel launch and draw call passes through it.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four display heads driving DP 1.4a with Display Stream Compression and HDMI 2.1a. Display Stream Compression, or DSC, is a visually lossless encoding that halves the data rate on the link, allowing higher resolutions or refresh rates than the raw link bandwidth would otherwise permit. DisplayPort 2.x is absent, and uncompressed formats above 4K120 would exceed the available link rate.",
      specs: [
        { label: "DisplayPort", value: "1.4a + DSC" },
        { label: "HDMI", value: "2.1a" },
      ],
      pipeline: "Reads completed frames from memory and drives the display outputs, independent of the 3D pipeline.",
    },
    media: {
      name: "NVENC / NVDEC",
      type: "Fixed function",
      role: "Two eighth-generation NVENC encoders and one fifth-generation NVDEC decoder. These are fixed-function circuits that compress and decompress video far more efficiently than the same work running on SMs. The two encoders can split a single high-resolution frame between them, roughly doubling encode throughput for 4K and 8K streams. Both support AV1, the royalty-free codec that achieves better quality than H.264 at comparable bitrates.",
      specs: [
        { label: "NVENC", value: "2 × 8th gen (AV1)" },
        { label: "NVDEC", value: "1 × 5th gen" },
      ],
      pipeline: "Operates on frames in memory, independent of the SMs.",
    },
    ofa: {
      name: "OFA (Optical Flow Accelerator)",
      type: "Fixed function",
      role: "A fixed-function engine that computes dense optical flow between consecutive frames. Optical flow assigns each pixel a motion vector describing where it moved from one frame to the next. DLSS 3 frame generation uses these vectors alongside the game's own motion data to synthesize an entirely new intermediate frame on the GPU, inserting it between rendered frames to increase perceived frame rate.",
      specs: [{ label: "Throughput", value: "~300 TOPS equivalent flow" }], // approx
      pipeline: "Reads rendered frames from memory and writes motion vector fields back to memory for DLSS consumption.",
    },
    pcie: {
      name: "PCIe Gen4 host interface",
      type: "Interconnect",
      role: "An x16 PCIe Gen4 link to the host CPU, which moves 32 GB/s in each direction for 64 GB/s of bidirectional bandwidth. It carries command submissions and host memory copies. Consumer Ada omits NVLink, so this link also handles any peer-to-peer multi-GPU traffic.",
      specs: [
        { label: "Link", value: "Gen4 ×16" },
        { label: "Bandwidth", value: "~64 GB/s bidir" },
      ],
      pipeline: "The entry point for all host-originated work.",
    },
  },
}
