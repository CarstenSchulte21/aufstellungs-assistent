/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Stil-/Lint-Regeln sollen das Deployment nicht blockieren.
  // Die TypeScript-Typprüfung läuft beim Build weiterhin und bricht bei
  // echten Fehlern ab.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
