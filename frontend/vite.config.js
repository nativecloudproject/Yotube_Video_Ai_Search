import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드 결과는 ../static/app 으로. Flask 가 그대로 서빙한다.
// 개발 중(npm run dev)엔 /api 와 /uploads 를 Flask(5000)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  build: { outDir: '../static/app', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
})
