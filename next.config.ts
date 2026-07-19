import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 横断技術ノート: Anthropic SDK はバンドル対象外にする（Node前提SDK）
  serverExternalPackages: ["@anthropic-ai/sdk", "postgres"],
};

export default nextConfig;
