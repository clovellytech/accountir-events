import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/h3": "src/adapters/h3.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
})
