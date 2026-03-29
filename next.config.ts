import type { NextConfig } from "next";

// Disable TLS verification for OpenGradient TEE nodes (self-signed certs on testnet)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
