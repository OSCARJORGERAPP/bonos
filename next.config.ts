import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requerido por el pipeline de la academia (build con buildah + Dockerfile
  // multi-stage): ver AGENTS.md §CI.
  output: "standalone",
};

export default nextConfig;
