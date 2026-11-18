import type { NextConfig } from "next";

// One id per deployed commit. It is baked into the page and also served by /api/version,
// so an open app can notice that a newer build is live (see useAppUpdate).
// Local builds use a fixed id, which turns the check off.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "local";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
