import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function gitShortSha(): string | undefined {
  if (process.env.NEXT_PUBLIC_GIT_SHA?.trim()) {
    return process.env.NEXT_PUBLIC_GIT_SHA.trim();
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const gitSha = gitShortSha();
const builtAt =
  process.env.NEXT_PUBLIC_BUILT_AT?.trim() || new Date().toISOString();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha ?? "",
    NEXT_PUBLIC_BUILT_AT: gitSha ? builtAt : "",
  },
  async headers() {
    // HTML must not be long-lived cached so pages cannot mix builds.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/schemas/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
