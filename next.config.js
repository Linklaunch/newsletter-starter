import {fileURLToPath} from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {root: fileURLToPath(new URL('.', import.meta.url))},
  // Produces a minimal .next/standalone server (only the deps actually used at
  // runtime) - Vercel doesn't need this, but a plain container does.
  output: 'standalone'
}

export default nextConfig
