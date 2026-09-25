// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Some build environments inject `define` entries shaped like
// `(globalThis.process.env.X ?? ("fallback"))`. esbuild rejects any define value that is
// not an entity name or JS literal, which fails the SSR build. Drop those entries so
// `process.env.X` is read at runtime instead (server env is injected per request).
const INVALID_DEFINE = /\?\?/;
function scrub(define: Record<string, unknown> | undefined) {
  if (!define) return;
  for (const [k, v] of Object.entries(define)) {
    if (typeof v === "string" && INVALID_DEFINE.test(v)) delete define[k];
  }
}
const stripInvalidDefines: Plugin = {
  name: "strip-invalid-env-defines",
  enforce: "post",
  configResolved(config) {
    scrub(config.define as Record<string, unknown> | undefined);
    for (const env of Object.values(config.environments ?? {})) {
      scrub((env as { define?: Record<string, unknown> }).define);
    }
    scrub(config.optimizeDeps?.esbuildOptions?.define as Record<string, unknown> | undefined);
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stripInvalidDefines],
  },
});
