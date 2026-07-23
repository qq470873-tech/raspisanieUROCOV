import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Явно фиксируем корень проекта: рядом в домашней папке есть другой lockfile,
  // из-за которого Next неверно определял workspace root.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
