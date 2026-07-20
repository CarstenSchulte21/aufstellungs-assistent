// Build-Kennung: wird beim Bauen eingesetzt und im Kopf (nur Admin) angezeigt,
// damit man sofort sieht, ob der Browser schon die neue Version hat.
const buildZeit = new Date().toISOString();
const buildSha = (process.env.VERCEL_GIT_COMMIT_SHA || "lokal").slice(0, 7);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ZEIT: buildZeit,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  // Stil-/Lint-Regeln sollen das Deployment nicht blockieren.
  // Die TypeScript-Typprüfung läuft beim Build weiterhin und bricht bei
  // echten Fehlern ab.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
