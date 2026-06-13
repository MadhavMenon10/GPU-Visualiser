import { blk, tile, vstack, hstack } from "../layout"
import type { Block, Gpu } from "../types"

const W = 300
const H = 232

// 82 of 84 SMs: 41 of 42 TPCs; fused TPC position varies; approx
const GPC_TPCS = [6, 6, 6, 6, 6, 6, 5]

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
  const enabled = GPC_TPCS[i]
  const g = blk(`gpc${i}`, "group", x, y, w, h, {
    label: `GPC${i}`,
    labelPos: "tl",
    doc: "gpc",
    children: [],
  })
  g.children!.push(blk(`gpc${i}/raster`, "frontend", 1.5, 5.5, w - 3, 4.5, { label: "RASTER · 16 ROP", doc: "raster" }))
  for (const c of tile(6, 3, 1.5, 11.5, w - 3, h - 13, 1)) {
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

  kids.push(blk("front", "frontend", 20, 3, 80, 11, { label: "GigaThread · front end", doc: "front" }))
  kids.push(blk("display", "media", 102, 3, 60, 11, { label: "DISPLAY · DP1.4a · HDMI2.1", doc: "display" }))
  kids.push(blk("media", "media", 164, 3, 54, 11, { label: "NVENC · NVDEC", doc: "media" }))
  kids.push(blk("pcie", "interconnect", 220, 3, 60, 11, { label: "PCIe Gen4 ×16", doc: "pcie" }))

  vstack(3, 3, 16, 14, 194, 3).forEach((c) => {
    kids.push(blk(`gddr-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })
  vstack(3, W - 17, 16, 14, 194, 3).forEach((c) => {
    kids.push(blk(`gddr-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "G6X", doc: "mem" }))
  })

  tile(3, 3, 20, 16, 260, 88, 2.5).forEach((c) => kids.push(gpc(c.i, c.x, c.y, c.w, c.h)))
  tile(4, 4, 20, 122, 260, 88, 2.5).forEach((c) => kids.push(gpc(c.i + 3, c.x, c.y, c.w, c.h)))

  kids.push(blk("l2", "cache", 20, 106, 260, 14, { label: "L2 CACHE · 6 MB", doc: "l2" }))

  kids.push(blk("nvlink", "interconnect", 20, 213, 56, 13, { label: "NVLINK 3 · 1 LINK", doc: "nvlink" }))
  hstack(4, 80, 213, 200, 13, 3).forEach((c) => {
    kids.push(blk(`gddr-b${c.i}`, "memctl", c.x, c.y, c.w, c.h, { label: "GDDR6X PHY 32-bit", doc: "mem" }))
  })

  return blk("die", "die", 0, 0, W, H, { label: "GA102", doc: "die", children: kids })
}

export const rtx3090: Gpu = {
  id: "rtx3090",
  vendor: "NVIDIA",
  name: "GeForce RTX 3090",
  die: "GA102",
  arch: "Ampere (GA10x)",
  isa: "sm_86",
  process: "Samsung 8N",
  floorplan,
  docs: {
    die: {
      name: "GA102 (GeForce RTX 3090)",
      type: "Die overview",
      role: "GA102 measures 628.4 mm² on Samsung 8N and carries 28.3 billion transistors. The RTX 3090 ships with 82 of 84 SMs active across 7 GPCs. Flaws are inevitable when manufacturing a die this large, so NVIDIA sells parts with some units disabled rather than discarding the silicon, and the disabled positions vary from die to die.",
      specs: [
        { label: "Process", value: "Samsung 8N" },
        { label: "Transistors", value: "28.3 B" },
        { label: "Die size", value: "628.4 mm²" },
        { label: "SMs", value: "82 (84 on full die)" },
        { label: "CUDA cores", value: "10 496" },
        { label: "Tensor Cores", value: "328 (3rd gen)" },
        { label: "RT Cores", value: "82 (2nd gen)" },
        { label: "ROPs", value: "112" },
        { label: "L2 cache", value: "6 MB" },
        { label: "Memory", value: "24 GB GDDR6X, 384-bit" },
        { label: "Mem bandwidth", value: "936 GB/s" },
        { label: "Boost clock", value: "1.70 GHz" },
        { label: "FP32", value: "35.6 TFLOPS" },
        { label: "NVLink", value: "1 link, 112.5 GB/s" },
        { label: "TGP", value: "350 W" },
      ],
      pipeline: "In a graphics workload, draw commands enter the front end and geometry is converted into pixel fragments by the raster engines, the fixed-function units in each GPC that scan triangles into the 2D grid of pixels they cover. Those fragments are shaded on the SMs, then the ROPs run depth tests and blend the new pixel color with whatever is already in the framebuffer, and the final result flows from the 6 MB L2 out to GDDR6X. A compute workload skips the raster stages entirely and goes directly from the front end to the SMs. The small L2 places most traffic on the GDDR6X interface.",
      programming: "Code is compiled with -arch=sm_86. cp.async copies global memory directly into shared memory without staging through registers, allowing the next data tile to transfer while the current one is being processed. Structured sparsity, also called 2:4 sparsity, takes advantage of a common pattern in trained neural networks where many weights are close to zero. If a model is pruned so that at least two of every four weights in each group are exactly zero, the Tensor Cores can skip those multiplications entirely and double matrix throughput. The Tensor Cores match GA100's third generation. FP64 executes at 1/64 of the FP32 rate, and occupancy is capped at 1536 threads per SM.",
    },
    gpc: {
      name: "GPC (GPU Processing Cluster)",
      type: "Compute cluster",
      role: "The top-level compute partition contains up to 6 TPCs, which amounts to 12 SMs since each TPC holds two. Each GPC also includes a raster engine, which converts 3D triangles into 2D pixel fragments that shaders can process, and 16 ROPs for depth testing and pixel blending. All seven GPCs are active on the 3090, though one runs five TPCs rather than six because one TPC is disabled for yield.",
      specs: [
        { label: "Count", value: "7" },
        { label: "TPCs per GPC", value: "6 (5 in one harvested GPC)" },
        { label: "ROPs per GPC", value: "16" },
      ],
      pipeline: "The GigaThread Engine balances work across GPCs. A per-GPC distributor then assigns thread blocks to individual SMs.",
    },
    tpc: {
      name: "TPC (Texture Processing Cluster)",
      type: "SM pair",
      role: "Two SMs plus a PolyMorph engine performing vertex fetch, tessellation and viewport transform. Flaws are inevitable at the scale GA102 is manufactured, so NVIDIA sells parts with some TPCs disabled rather than discarding the silicon. 41 of the 42 physical TPCs are active on the 3090, and the disabled position varies from die to die.",
      specs: [
        { label: "SMs per TPC", value: "2" },
        { label: "Enabled", value: "41 of 42" },
      ],
      pipeline: "Geometry stage feeding the GPC raster engine.",
    },
    sm: {
      name: "SM (Streaming Multiprocessor)",
      type: "Compute unit",
      role: "Four partitions per SM, each with 16 dedicated FP32 lanes and 16 dual-mode FP32/INT32 lanes. The dual-mode lanes can switch between FP32 and INT32 each cycle. FP32-heavy code approaches double the throughput of integer-heavy code. Each partition also has one third-generation Tensor Core, and one second-generation RT Core per SM accelerates ray tracing. In ray tracing, a BVH, or Bounding Volume Hierarchy, is a tree of nested bounding boxes used to find which triangles a ray might hit. The ray tests boxes first and only examines the triangles inside a box when it actually intersects it, avoiding tests against most of the scene.",
      specs: [
        { label: "Count", value: "82" },
        { label: "FP32 lanes", value: "128 (64 + 64 shared w/ INT32)" },
        { label: "Tensor Cores", value: "4 × 3rd gen" },
        { label: "RT Core", value: "1 × 2nd gen" },
        { label: "Register file", value: "256 KB (4 × 64 KB)" },
        { label: "L1 / shared", value: "128 KB combined, ≤100 KB shared" },
        { label: "Max occupancy", value: "48 warps · 1536 threads" },
      ],
      pipeline: "The SM receives thread blocks from the GPC distributor. Each block is divided into 32-thread warps, which the warp schedulers issue onto the execution pipelines. Load and store traffic flows through the L1, then the L2, and out to GDDR6X.",
      programming: "One thread block executes on exactly one SM. The FP32/INT32 instruction ratio is the principal tuning parameter on sm_86. Integer address arithmetic competes with FP32 for the dual-mode lanes, so workloads heavy in address calculations see lower effective FP32 throughput.",
    },
    raster: {
      name: "Raster engine + ROPs",
      type: "Graphics fixed function",
      role: "The raster engine in each GPC takes triangles from the geometry pipeline and determines which pixels they cover. Triangle setup computes the edge equations for each triangle; the rasterizer scans those equations across the pixel grid to find covered pixels. Z-cull performs a hierarchical depth test that discards entire pixel tiles which are behind geometry already drawn, preventing the SMs from shading pixels that will never be visible. The ROPs, Render Output Units, run depth and stencil tests at per-pixel precision, blend the new shaded color with the existing framebuffer value, and handle MSAA, a technique that takes multiple depth and color samples per pixel to smooth jagged triangle edges. Because the ROPs are inside the GPC, pixel throughput scales with the number of active GPCs. 112 ROPs are active across the seven GPCs on the 3090.",
      specs: [
        { label: "ROPs total", value: "112" },
        { label: "Rasterizers", value: "7" },
      ],
      pipeline: "Sits between the geometry pipeline and the SMs. ROPs write final pixels into the L2.",
    },
    l2: {
      name: "L2 cache",
      type: "Cache",
      role: "A single 6 MB L2 shared by all SMs, ROPs and texture units. Every cache miss proceeds to GDDR6X, and the relatively small capacity means most texture and framebuffer traffic does reach DRAM. The 936 GB/s GDDR6X interface is sized to compensate.",
      specs: [
        { label: "Capacity", value: "6 MB" },
        { label: "Slices", value: "paired with 32-bit MCs" },
      ],
      pipeline: "When an SM's L1 cache cannot satisfy a load or store, the request travels to the L2. Atomic operations issued by multiple SMs on the same address are also arbitrated here rather than going out to GDDR6X.",
    },
    mem: {
      name: "GDDR6X memory controller + PHY",
      type: "Memory interface",
      role: "Twelve 32-bit GDDR6X controllers form the 384-bit bus. GDDR6X uses PAM4 signalling, which encodes two bits per symbol rather than one, reaching 19.5 Gbps per pin for 936 GB/s total. The 24 GB of capacity uses 8 Gb devices mounted on both faces of the PCB.",
      specs: [
        { label: "Controllers", value: "12 × 32-bit" },
        { label: "Capacity", value: "24 GB" },
        { label: "Data rate", value: "19.5 Gbps PAM4" },
        { label: "Bandwidth", value: "936 GB/s" },
      ],
      pipeline: "The terminal memory level which services L2 misses.",
    },
    nvlink: {
      name: "NVLink 3 (single link)",
      type: "Interconnect",
      role: "One NVLink 3 link with 112.5 GB/s of bidirectional bandwidth. It supports two-GPU peer access and memory pooling for rendering and ML workloads.",
      specs: [
        { label: "Links", value: "1" },
        { label: "Bandwidth", value: "112.5 GB/s bidir" },
      ],
      pipeline: "Peer-to-peer GPU traffic bypassing PCIe.",
      programming: "Enabled via cudaDeviceEnablePeerAccess. Two 3090s connected by the bridge form an effective 48 GB memory pool addressable from either GPU.",
    },
    front: {
      name: "GigaThread Engine + front end",
      type: "Front end",
      role: "Receives kernel launches and draw calls from the host and distributes work across the seven GPCs. Context switching lets multiple processes share the GPU by saving and restoring state. Copy engines handle DMA transfers in parallel with kernels. DMA, Direct Memory Access, lets dedicated hardware copy data between host and device memory without involving the CPU or the SMs, so the GPU can load the next batch while it computes on the current one.",
      specs: [{ label: "Scheduling unit", value: "thread block / draw" }],
      pipeline: "All command buffers start here.",
    },
    display: {
      name: "Display engine",
      type: "Fixed function",
      role: "Four display heads driving DP 1.4a with Display Stream Compression and HDMI 2.1. Display Stream Compression, or DSC, is a visually lossless encoding that halves the data rate on the link, allowing higher resolutions or refresh rates than the raw link bandwidth would otherwise permit.",
      specs: [
        { label: "DisplayPort", value: "1.4a + DSC" },
        { label: "HDMI", value: "2.1" },
      ],
      pipeline: "Scan-out from memory, independent of the 3D pipeline.",
    },
    media: {
      name: "NVENC / NVDEC",
      type: "Fixed function",
      role: "One seventh-generation NVENC encoder and one fifth-generation NVDEC decoder. These are fixed-function circuits that compress and decompress video far more efficiently than SMs. The NVDEC supports AV1 decode.",
      specs: [
        { label: "NVENC", value: "1 × 7th gen" },
        { label: "NVDEC", value: "1 × 5th gen (AV1 decode)" },
      ],
      pipeline: "Frame-level operation on DRAM surfaces.",
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
  },
}
