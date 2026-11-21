// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // canonical 基准域名（GEO 要求：每页 canonical/og:url 由 site + pathname 直出）
  site: 'https://www.qingningsoft.cn',
});
