import { createClient } from "honox/client";
import { initializeClientTelemetry } from "./features/telemetry/client";

initializeClientTelemetry();
// islands の自動ハイドレーション
createClient();
