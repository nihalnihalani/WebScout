/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    AGENT_WS_URL: process.env.AGENT_WS_URL || 'ws://localhost:8000/ws',
    NOVNC_URL: process.env.NOVNC_URL || 'http://localhost:6080',
  },
}

module.exports = nextConfig
