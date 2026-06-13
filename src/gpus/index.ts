import type { Gpu } from "../types"
import { h100 } from "./h100"
import { a100 } from "./a100"
import { rtx4090 } from "./rtx4090"
import { rtx3090 } from "./rtx3090"
import { v100 } from "./v100"
import { rx7900xtx } from "./rx7900xtx"
import { mi300x } from "./mi300x"
import { arcA770 } from "./arcA770"

export const gpus: Gpu[] = [h100, a100, rtx4090, rtx3090, v100, rx7900xtx, mi300x, arcA770]
