import { defineConfig, type Plugin } from 'vite';

/**
 * Social cards need absolute URLs. On Vercel the production domain is known
 * at build time; elsewhere VITE_SITE_URL can name it, and without either the
 * tags fall back to site-relative paths.
 */
function siteUrl(): Plugin {
  const raw =
    process.env.VITE_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const url = raw.replace(/\/$/, '');
  return {
    name: 'site-url',
    transformIndexHtml: (html) =>
      (url ? html : html.replace(/\s*<link rel="canonical"[^>]*>/, '').replace(/\s*<meta property="og:url"[^>]*>/, '')).replaceAll(
        '%SITE_URL%',
        url,
      ),
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [siteUrl()],
  define: {
    // Review views (?gallery, ?rig, ?stats) ship in dev and in Vercel preview
    // deployments, so a batch can be checked on a real phone. Never in a
    // production deployment.
    __REVIEW__: JSON.stringify(
      mode === 'development' || process.env.VERCEL_ENV === 'preview' || process.env.VITE_REVIEW === '1',
    ),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap', 'gsap/ScrollTrigger'],
        },
      },
    },
  },
  worker: { format: 'es' },
}));
