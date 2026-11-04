const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const importmap = '{"imports":{"spessasynth_core":"/node_modules/spessasynth_core/dist/index.js","stb-vorbis":"/node_modules/stb-vorbis/dist/index.js"}}';
const mapHash = crypto.createHash('sha256').update(importmap).digest('base64');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.sf2':'application/octet-stream', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml'};
exports.start = () => new Promise(resolve => {
  const server = http.createServer((req,res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname === '/' ? '/src/index.html' : decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || !/^\/(src|assets|node_modules\/(spessasynth_(lib|core)|stb-vorbis))\//.test(name)) {res.writeHead(403); return res.end();}
    fs.readFile(file, (err, data) => {
      if(err){res.writeHead(404);return res.end('Not found');}
      res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream','Content-Security-Policy': `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-${mapHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`}); res.end(path.extname(file) === '.html' ? data.toString().replace('</head>', `<script type="importmap">${importmap}</script></head>`) : data);
    });
  });
  server.listen(0,'127.0.0.1', () => resolve({server, url:`http://127.0.0.1:${server.address().port}`}));
});
