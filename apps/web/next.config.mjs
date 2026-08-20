/** @type {import('next').NextConfig} */

// En mode GitHub Pages : export statique + basePath = nom du dépôt.
const staticExport = process.env.BUILD_STATIC === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  // Le package partagé est du TypeScript source : Next le transpile.
  transpilePackages: ["@jobccq/shared"],
  eslint: { ignoreDuringBuilds: true },
  // Le package partagé importe avec des extensions .js (convention ESM/NodeNext) ;
  // on indique à webpack de les résoudre vers les sources .ts.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  ...(staticExport
    ? {
        output: "export",
        basePath: basePath || undefined,
        assetPrefix: basePath || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        images: {
          remotePatterns: [{ protocol: "https", hostname: "**" }],
        },
      }),
};

export default nextConfig;
