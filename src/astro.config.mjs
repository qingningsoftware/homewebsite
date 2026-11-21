// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // canonical 基准域名（GEO 要求：每页 canonical/og:url 由 site + pathname 直出）
  site: 'https://www.qingningsoft.cn',
  // sitemap（GEO 要求，设计稿 §8）：构建期生成 dist/sitemap-index.xml + dist/sitemap-*.xml
  integrations: [sitemap()],
});
