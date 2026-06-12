import type { Gpu } from "../types"
import { h100 } from "./h100"
import { rtx3090 } from "./rtx3090"
import { v100 } from "./v100"
import { mi300x } from "./mi300x"
import { arcA770 } from "./arcA770"

export const gpus: Gpu[] = [h100, rtx3090, v100, mi300x, arcA770]
