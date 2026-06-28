import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Set the workspace root to avoid lockfile warning when running from monorepo
  outputFileTracingRoot: path.join(__dirname, '../'),
}

export default nextConfig
