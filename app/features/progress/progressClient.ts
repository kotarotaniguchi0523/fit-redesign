import { hc } from "hono/client";
import type { ProgressApp } from "../../routes/progress";

export const progressClient = hc<ProgressApp>("/progress");
