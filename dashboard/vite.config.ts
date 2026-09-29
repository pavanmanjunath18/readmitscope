import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5181 },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors so the dashboard can render before the decorative 3D scene loads.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](three|@react-three|react-reconciler|its-fine|suspend-react|zustand|react-use-measure)[\\/]/.test(id)) return 'three'
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'charts'
          if (/[\\/](gsap|@gsap|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion'
          return 'vendor'
        },
      },
    },
  },
})
