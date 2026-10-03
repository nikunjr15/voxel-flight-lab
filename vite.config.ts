import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
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
