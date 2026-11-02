import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const port = +process.argv[2] || 4173;

createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  const type = TYPES[extname(p)];
  try {
    if (!type || p.includes('..')) throw 0;
    const data = await readFile(join('dist', p));
    res.writeHead(200, { 'content-type': type }).end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`serving dist/ on http://localhost:${port}`));
