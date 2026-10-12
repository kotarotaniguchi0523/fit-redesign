import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    "name": "fit-redesign",
    "compatibilityDate": "2026-10-06",
    "observability": {
      "enabled": true
    }
  }
});
