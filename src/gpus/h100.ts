import { blk, tile, vstack, hstack } from "../layout";
import type { Block, Gpu } from "../types";

const W = 330;
const H = 248;

// 66 of 72 TPCs enabled on SXM5; per-GPC fuse distribution not published; approx
const GPC_TPCS = [9, 8, 8, 8, 8, 8, 8, 9];

function gpc(i: number, x: number, y: number, w: number, h: number): Block {
    const enabled = GPC_TPCS[i];
    const g = blk(`gpc${i}`, "group", x, y, w, h, {
        label: `GPC${i}`,
        labelPos: "tl",
        doc: "gpc",
        children: [],
    });
    for (const c of tile(9, 3, 1.5, 6.5, w - 3, h - 8, 1.2)) {
        const t = blk(`gpc${i}/tpc${c.i}`, "group", c.x, c.y, c.w, c.h, {
            doc: "tpc",
            children: [],
        });
        if (c.i >= enabled) {
            t.kind = "compute";
            t.disabled = true;
            t.children = undefined;
        } else {
            for (const s of hstack(2, 0.8, 0.8, c.w - 1.6, c.h - 1.6, 0.7)) {
                t.children!.push(
                    blk(`${t.id}/sm${s.i}`, "compute", s.x, s.y, s.w, s.h, {
                        label: "SM",
                        doc: "sm",
                    })
                );
            }
        }
        g.children!.push(t);
    }
    return g;
}

function floorplan(): Block {
    const kids: Block[] = [];

    kids.push(
        blk("front", "frontend", 22, 3, 148, 11, {
            label: "GigaThread Engine · copy engines",
            doc: "front",
        })
    );
    kids.push(
        blk("pcie", "interconnect", 173, 3, 86, 11, {
            label: "PCIe Gen5 ×16",
            doc: "pcie",
        })
    );
    kids.push(
        blk("media", "media", 262, 3, 46, 11, {
            label: "7× NVDEC · 7× NVJPG",
            doc: "media",
        })
    );

    vstack(3, 3, 18, 16, H - 36, 4).forEach(c => {
        kids.push(
            blk(`hbm-l${c.i}`, "memctl", c.x, c.y, c.w, c.h, {
                label: "HBM3",
                doc: "hbm",
            })
        );
    });
    vstack(3, W - 19, 18, 16, H - 36, 4).forEach(c => {
        kids.push(
            blk(`hbm-r${c.i}`, "memctl", c.x, c.y, c.w, c.h, {
                label: "HBM3",
                doc: "hbm",
                disabled: c.i === 2, // 5 of 6 stacks enabled on SXM5; which site is dark varies; approx
            })
        );
    });

    tile(4, 4, 22, 16, 286, 90, 3).forEach(c =>
        kids.push(gpc(c.i, c.x, c.y, c.w, c.h))
    );
    tile(4, 4, 22, 142, 286, 90, 3).forEach(c =>
        kids.push(gpc(c.i + 4, c.x, c.y, c.w, c.h))
    );

    kids.push(
        blk("l2-0", "cache", 22, 109, 140.5, 30, {
            label: "L2 CACHE · 25 MB PARTITION",
            doc: "l2",
        })
    );
    kids.push(
        blk("l2-1", "cache", 167.5, 109, 140.5, 30, {
            label: "L2 CACHE · 25 MB PARTITION",
            doc: "l2",
        })
    );

    const nv = blk("nvlink", "interconnect", 22, H - 13, 286, 10, {
        label: "",
        doc: "nvlink",
        children: [],
    });
    hstack(18, 1, 1, 284, 8, 1).forEach(c => {
        nv.children!.push(
            blk(`nvlink/${c.i}`, "interconnect", c.x, c.y, c.w, c.h, {
                doc: "nvlink",
            })
        );
    });
    kids.push(nv);
    kids.push(
        blk("nvlink-label", "group", 22, H - 13, 286, 10, {
            label: "NVLINK 4 · 18 LINKS",
            labelPos: "tl",
            doc: "nvlink",
        })
    );

    return blk("die", "die", 0, 0, W, H, {
        label: "GH100",
        doc: "die",
        children: kids,
    });
}

export const h100: Gpu = {
    id: "h100",
    vendor: "NVIDIA",
    name: "H100 SXM5",
    die: "GH100",
    arch: "Hopper",
    isa: "sm_90",
    process: "TSMC 4N",
    floorplan,
    docs: {
        die: {
            name: "GH100 (H100 SXM5)",
            type: "Die overview",
            role: "GH100 measures 814 mm² on TSMC 4N and carries 80 billion transistors. The SXM5 product ships with 132 of 144 SMs active and 5 of 6 HBM3 stacks populated, and the positions of the disabled units vary from die to die. Die area is dominated by the eight GPC fields, a 50 MB L2 in two central partitions, and the HBM interfaces on both long edges.",
            specs: [
                { label: "Process", value: "TSMC 4N (custom 5 nm)" },
                { label: "Transistors", value: "80 B" },
                { label: "Die size", value: "814 mm²" },
                { label: "SMs", value: "132 (144 on full die)" },
                { label: "FP32 cores", value: "16 896" },
                { label: "Tensor Cores", value: "528 (4th gen, FP8)" },
                { label: "L2 cache", value: "50 MB (2 partitions)" },
                { label: "Memory", value: "80 GB HBM3, 5120-bit" },
                { label: "Mem bandwidth", value: "3.35 TB/s" },
                { label: "Boost clock", value: "~1.98 GHz" }, // approx
                { label: "FP32 / FP64", value: "67 / 34 TFLOPS" },
                { label: "FP16 Tensor", value: "989 TFLOPS (1979 sparse)" },
                { label: "FP8 Tensor", value: "1979 TFLOPS (3958 sparse)" },
                { label: "NVLink", value: "Gen4, 18 links, 900 GB/s" },
                { label: "TDP", value: "700 W" },
            ],
            pipeline:
                "Work arrives over PCIe Gen5 or NVLink, is queued by the GigaThread Engine, and is distributed as thread blocks to SMs inside the 8 GPCs. Load and store instructions from warps flow through the SM L1 to the L2 partition, then out to the HBM3 controllers on the die edges.",
            programming:
                "Code is compiled with -arch=sm_90 (CUDA 12+). Hopper adds three features aimed at transformer training. Thread block clusters let a group of blocks schedule together on one GPC so they can read and write each other's shared memory directly, a capability called distributed shared memory. Without it, data shared between blocks would have to access global memory. The Tensor Memory Accelerator is a dedicated copy engine in each SM that moves tensor tiles between global memory and shared memory while the warps keep computing, so the next tile arrives before the current one is consumed. FP8 stores each weight or activation in eight bits instead of sixteen. The Transformer Engine decides per layer whether the reduced precision is acceptable, which halves memory use and doubles Tensor Core throughput when it is.",
        },
        gpc: {
            name: "GPC (GPU Processing Cluster)",
            type: "Compute cluster",
            role: "The top-level compute partition contains up to 9 TPCs, which amounts to 18 SMs since each TPC holds two. A local distributor assigns incoming thread blocks to SMs with free capacity. Thread block clusters, Hopper's multi-block cooperative feature, must fit within a single GPC. That physical closeness is what makes distributed shared memory possible, because the SMs can reach each other's on-chip SRAM without crossing the full die. MIG, short for Multi-Instance GPU, divides the device on GPC boundaries and gives each tenant dedicated compute, cache and memory slices with hardware-enforced isolation.",
            specs: [
                { label: "Count", value: "8" },
                { label: "TPCs per GPC", value: "8-9 enabled (9 physical)" },
                { label: "SMs per GPC", value: "16-18" },
                {
                    label: "MIG",
                    value: "instances partition on GPC boundaries",
                },
            ],
            pipeline:
                "The GigaThread Engine load-balances thread blocks across the GPCs. Within a GPC, a work distribution unit assigns blocks to individual SMs.",
            programming:
                "CUDA 12 thread block clusters (cluster_dims) must fit within one GPC. This constraint is what enables distributed shared memory and cluster-wide barriers between the participating SMs.",
        },
        tpc: {
            name: "TPC (Texture Processing Cluster)",
            type: "SM pair",
            role: "Two SMs share a texture unit and the per-TPC instruction fetch and dispatch circuits. GH100 carries the TPC name from earlier GPU families even though only two of the 72 physical TPCs keep a graphics geometry pipeline, and the rest are compute-only. Flaws are inevitable when manufacturing a die this large, so NVIDIA sells parts with a few TPCs disabled rather than discarding the silicon. 66 of the 72 physical TPCs are active on SXM5, and the disabled positions vary from die to die.",
            specs: [
                { label: "SMs per TPC", value: "2" },
                { label: "Enabled", value: "66 of 72 (SXM5)" },
            ],
            pipeline:
                "A pass-through level between GPC work distribution and the SM schedulers.",
        },
        sm: {
            name: "SM (Streaming Multiprocessor)",
            type: "Compute unit",
            role: "Four partitions per SM, each with a warp scheduler issuing one 32-thread instruction per clock, a 64 KB register file slice, 32 FP32, 16 INT32 and 16 FP64 lanes, and one fourth-generation Tensor Core with FP8 support. The per-SM Tensor Memory Accelerator generates addresses and copies tensor tiles between global and shared memory asynchronously, freeing warp issue slots for arithmetic.",
            specs: [
                { label: "Count", value: "132" },
                { label: "FP32 / INT32 / FP64", value: "128 / 64 / 64 per SM" },
                {
                    label: "Tensor Cores",
                    value: "4 × 4th gen (FP8/FP16/BF16/TF32/FP64/INT8)",
                },
                { label: "Register file", value: "256 KB (4 × 64 KB)" },
                {
                    label: "L1 / shared",
                    value: "256 KB combined, ≤228 KB shared",
                },
                { label: "Warp schedulers", value: "4 (32 threads/clk each)" },
                { label: "Max occupancy", value: "64 warps · 2048 threads" },
                { label: "TMA", value: "1 per SM" },
            ],
            pipeline:
                "The SM receives thread blocks from GPC work distribution and schedules warps onto the partition pipelines. Loads and stores pass through the load/store units to the L1, then to the L2 and HBM. Tensor Core operands stream from registers and shared memory.",
            programming:
                "One thread block executes on exactly one SM, and warps of 32 threads are the scheduling unit. Declaring a variable __shared__ places it in the L1 carveout, where every thread in the block can reach it at on-chip latency instead of HBM latency. sm_90 adds the Tensor Memory Accelerator, a copy engine in each SM that moves whole tiles from global memory into shared memory through cp.async.bulk without stalling the warps, and distributed shared memory, which extends __shared__ access to the other SMs in the same thread block cluster.",
        },
        l2: {
            name: "L2 cache partition",
            type: "Cache",
            role: "The 50 MB cache is split into two 25 MB partitions joined by a crossbar, and each partition serves the HBM controllers on its half of the die. Every piece of data the cache holds is a read that did not have to travel to HBM. It supports residency windows, where software marks an address range as persistent and the L2 keeps it resident while streaming traffic passes through the rest. Weights and lookup tables that are reread constantly benefit the most. The cache also compresses zero-heavy data as it is written, which raises its effective capacity and bandwidth on sparse tensors.",
            specs: [
                { label: "Capacity", value: "50 MB (60 MB full die)" },
                { label: "Partitions", value: "2 × 25 MB" },
                { label: "ECC", value: "SECDED, enabled by default" },
            ],
            pipeline:
                "Every SM L1 miss lands here, and all HBM traffic stages through it. Atomic operations shared between SMs also resolve in the L2.",
            programming:
                "cudaAccessPolicyWindow pins address ranges for persistent L2 residency (introduced sm_80, extended on sm_90).",
        },
        hbm: {
            name: "HBM3 stack + memory controllers",
            type: "Memory interface",
            role: "HBM stacks several DRAM dies vertically and connects them with thousands of short vertical wires called through-silicon vias, giving far more parallel data paths than a conventional circuit board allows. The stacks and the GPU die sit together on a CoWoS interposer, a slab of silicon that carries the wiring between them, because silicon can be patterned with much finer wires than an ordinary package. Each edge site holds one HBM3 stack driven by two 512-bit memory controllers. SXM5 populates five of the six sites, so ten controllers run in parallel and their widths sum to a 5120-bit path into memory. The five stacks together provide 80 GB of capacity, and the GPU can read and write that memory at up to 3.35 TB/s. One site is left disabled for yield and its position varies per part. The PHYs, the analog circuits that drive signals off the die, sit at the edges to keep the wires to the stacks short.",
            specs: [
                { label: "Stacks", value: "5 of 6 enabled" },
                { label: "Controllers", value: "10 × 512-bit" },
                { label: "Capacity", value: "80 GB" },
                { label: "Bandwidth", value: "3.35 TB/s" },
                { label: "ECC", value: "on-die + link ECC" },
            ],
            pipeline:
                "The last level of the memory hierarchy, where L2 partition misses are serviced. The controllers interleave addresses so contiguous data spreads across all five stacks.",
            programming:
                "Global memory allocated with cudaMalloc resides here. When the 32 threads of a warp read addresses that fall in the same cache line, the hardware satisfies the whole warp with one memory transaction, a pattern called coalescing. Scattered addresses each cost their own transaction and waste most of the bandwidth they occupy.",
        },
        nvlink: {
            name: "NVLink 4",
            type: "Interconnect",
            role: "Eighteen NVLink 4 ports, each moving 25 GB/s in each direction, which is 50 GB/s of bidirectional bandwidth per port and 900 GB/s summed across all eighteen ports. NVSwitch is a separate switch chip on the server board that connects all eight GPUs, and through it any GPU can read or write any other GPU's HBM with ordinary load and store instructions rather than explicit copy calls. SHARP, the Scalable Hierarchical Aggregation and Reduction Protocol, performs reductions inside the switch itself. As each GPU's partial tensor passes through, the switch accumulates the sum, so an all-reduce completes in one pass and each element crosses the network only once.",
            specs: [
                { label: "Links", value: "18 × 50 GB/s bidir" },
                { label: "Aggregate", value: "900 GB/s" },
                { label: "Fabric", value: "NVSwitch 3, SHARP" },
            ],
            pipeline:
                "Peer traffic bypasses PCIe entirely. Remote loads, stores and NCCL collectives move from one GPU's L2 to another's.",
            programming:
                "Exposed via cudaDeviceEnablePeerAccess, NCCL and NVSHMEM. NVSHMEM is a library that presents the combined HBM of every GPU in the job as one flat address space, so a kernel can load or store remote memory without an explicit communication call.",
        },
        pcie: {
            name: "PCIe Gen5 host interface",
            type: "Interconnect",
            role: "An x16 PCIe Gen5 link to the host CPU, moving 64 GB/s in each direction for 128 GB/s of bidirectional bandwidth. It carries command submission, host memory copies that do not travel over NVLink, and GPUDirect RDMA, which lets network cards and NVMe drives write straight into HBM without staging the data through system memory first.",
            specs: [
                { label: "Link", value: "Gen5 ×16" },
                { label: "Bandwidth", value: "~128 GB/s bidir" },
            ],
            pipeline:
                "The entry point for host-originated work. Kernel launches and DMA descriptors pass through here to the GigaThread Engine.",
        },
        front: {
            name: "GigaThread Engine + copy engines",
            type: "Front end",
            role: "Receives kernel launches from the host and distributes thread blocks across the eight GPCs, tracking which SMs have free capacity. Context switching lets several processes share the GPU, with the engine saving the running kernel's state, executing the new work, then restoring what it saved. Preemption allows a running kernel to be interrupted between any two instructions rather than only at kernel boundaries, so urgent work does not wait behind a long one. Copy engines run DMA transfers at the same time as kernels, letting data for the next iteration move while the current one computes. MIG partitions the device in hardware, and up to seven tenants each receive a fixed slice of SMs, L2 and HBM that no other tenant can touch or observe.",
            specs: [
                { label: "Scheduling unit", value: "thread block / cluster" },
                { label: "MIG", value: "up to 7 instances" },
            ],
            pipeline:
                "It sits between the host interface and the GPCs, and every kernel launch passes through it.",
            programming:
                "CUDA streams and grid launches are mediated here. Whether concurrent kernels and asynchronous copies actually overlap depends on its scheduling.",
        },
        media: {
            name: "Media engines",
            type: "Fixed function",
            role: "Seven NVDEC video decoders and seven NVJPG JPEG decoders. These are fixed-function circuits that decompress video and images far more efficiently than the same work running on SMs, leaving the SMs free for inference. The count reflects the inference ingest pipeline, where encoded frames arrive continuously and must be decoded before a model can consume them. Decoded output is written directly to HBM.",
            specs: [
                { label: "NVDEC", value: "7" },
                { label: "NVJPG", value: "7" },
                { label: "NVENC", value: "none" },
            ],
            pipeline:
                "Decoded output lands in HBM without passing back through the host.",
        },
    },
};
