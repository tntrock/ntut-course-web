/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // 必須排在 react 之前,產生的路由樹才會被 react plugin 處理到
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      /*
       * `prompt` 而不是 `autoUpdate`:使用者可能正在排課,更新會重新載入頁面。
       * 排到一半被換掉是很糟的體驗,所以顯示提示讓他自己決定什麼時候更新。
       */
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '北科課程',
        short_name: '北科課程',
        description: '臺北科技大學課程查詢:搜尋、教學大綱、我的課表。非官方網站。',
        lang: 'zh-Hant-TW',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0c0e12',
        theme_color: '#0b66d6',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            // 被裁成圓形時主體仍在安全區內
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        /*
         * Service worker **只管 app shell**(HTML / JS / CSS / 圖示)。
         *
         * API 資料不進來 —— 它由 `lib/api.ts` 那層版本化的 Cache Storage 管,
         * 兩套快取管同一份資料只會互相打架,而且那一層知道版本號,Workbox 不知道。
         */
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // 資料來源是另一個網域,交給 API 快取層處理
        navigateFallbackDenylist: [/^\/assets\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
