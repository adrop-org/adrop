/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  experimental: { cpus: 1, workerThreads: false, webpackBuildWorker: false },
  transpilePackages: ["adrop-sdk"],
  webpack: (config) => { config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false }; return config; },
};
