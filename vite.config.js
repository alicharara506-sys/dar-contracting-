// Dev-only helper: POST /__save?name=file.png with an image body writes it to media-src/.
// Used to export exact frames (the CAD sheet) as start frames for the Higgsfield film.
// It only exists in `npm run dev`; the production build is unaffected.
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'dar-save-frame',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        const url = new URL(req.url, 'http://x');
        const name = path.basename(url.searchParams.get('name') || 'frame.png').replace(/[^\w.-]/g, '_');
        if (req.method !== 'POST' || !/\.(png|jpe?g|webp)$/i.test(name)) { res.statusCode = 400; return res.end('bad request'); }
        const dir = path.resolve('media-src'); fs.mkdirSync(dir, { recursive: true });
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks)); res.end('saved ' + name); });
      });
    },
  }],
});
