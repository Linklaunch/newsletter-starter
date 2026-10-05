import {fileURLToPath} from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {root: fileURLToPath(new URL('.', import.meta.url))},
  // Produces a minimal .next/standalone server (only the deps actually used at
  // runtime) for the Docker/Azure build - Vercel manages its own build output
  // and breaks (ENOENT on next-server.js.nft.json) if this is set for it, so
  // the Dockerfile opts in explicitly via BUILD_STANDALONE rather than this
  // being unconditional.
  ...(process.env.BUILD_STANDALONE === '1' ? {output: 'standalone'} : {})
}

export default nextConfig
