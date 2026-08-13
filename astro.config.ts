import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type SiteSettings = { site: string };

const settings = parse(
  readFileSync(new URL('./src/data/site.yml', import.meta.url), 'utf8'),
) as SiteSettings;

export default defineConfig({
  site: settings.site,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: {
    assets: '_assets',
  },
});
