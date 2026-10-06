/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  transpilePackages: ["adrop-sdk"],
  webpack: (config) => { config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false }; return config; },
};
