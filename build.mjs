import { build as esbuild } from 'esbuild';
import { minify } from 'terser';
import { pack } from 'jspackcompress';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { glslPlugin } from './tools/glsl.mjs';

const CAP = 131072;

export async function build({ release = true, cap = CAP } = {}) {
  const r = await esbuild({
    entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'es2022',
    define: { DEBUG: release ? 'false' : 'true' }, plugins: [glslPlugin()], write: false,
  });
  let code = r.outputFiles[0].text;
  const [head, body] = readFileSync('src/shell.html', 'utf8').split('<!--BODY-->');
  mkdirSync('dist', { recursive: true });
  const path = release ? 'dist/index.html' : 'dist/dev.html';
  let out;
  if (release) {
    code = (await minify(code, {
      toplevel: true, compress: { passes: 3 }, mangle: { properties: { regex: /^_/ } }, format: { ascii_only: true },
    })).code;
    const res = await pack({
      script: code, compressionlevel: 9, compactHtml: false, useSmallDecoder: false,
      universalDecoder: true, extraHead: head, extraBody: body,
    });
    out = Buffer.from(res.payload);
  } else {
    out = Buffer.from(`<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}<script>${code}</script></body></html>`);
  }
  writeFileSync(path, out);
  const bytes = out.length;
  if (release && bytes > cap) throw new Error(`${path} is ${bytes} bytes, exceeds ${cap} bytes`);
  return { path, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { path, bytes } = await build({ release: !process.argv.includes('--dev') });
  console.log(`${path}: ${bytes} bytes (${(bytes / CAP * 100).toFixed(1)}% of ${CAP})`);
}
