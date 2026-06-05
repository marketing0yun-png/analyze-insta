import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // 홈 디렉터리의 떠도는 lockfile 때문에 워크스페이스 루트가 오인되는 것을 방지.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
