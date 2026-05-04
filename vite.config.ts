import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.APP_BASE_PATH ?? '/talkGeminiPro/';
const dictRoutePrefix = `${base}dict/`;

const serveKuromojiDictRaw = () => ({
  name: 'serve-kuromoji-dict-raw',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const requestUrl = req.url?.split('?')[0] ?? '';
      if (!requestUrl.startsWith(dictRoutePrefix) || !requestUrl.endsWith('.dat.gz')) {
        next();
        return;
      }

      const fileName = path.basename(requestUrl);
      const filePath = path.join(process.cwd(), 'public', 'dict', fileName);
      if (!fs.existsSync(filePath)) {
        next();
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', fs.statSync(filePath).size);
      fs.createReadStream(filePath).pipe(res);
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const requestUrl = req.url?.split('?')[0] ?? '';
      if (!requestUrl.startsWith(dictRoutePrefix) || !requestUrl.endsWith('.dat.gz')) {
        next();
        return;
      }

      const fileName = path.basename(requestUrl);
      const filePath = path.join(process.cwd(), 'public', 'dict', fileName);
      if (!fs.existsSync(filePath)) {
        next();
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', fs.statSync(filePath).size);
      fs.createReadStream(filePath).pipe(res);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [serveKuromojiDictRaw(), react()],
  base,
  server: {
    proxy: {
      '/api/dify': {
        target: 'https://api.dify.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/dify/, '/v1'),
      },
    },
  },
});
