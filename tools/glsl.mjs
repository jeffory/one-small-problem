import { readFileSync } from 'node:fs';

// Minify GLSL: strip comments, keep preprocessor lines intact, squeeze whitespace.
export function minifyGLSL(src) {
  const lines = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '').split('\n');
  let out = '', code = '';
  const flush = () => {
    out += code.replace(/\s+/g, ' ')
      .replace(/([+-]) (?=[+-])/g, '$1\x01')
      .replace(/ ?([{}()\[\];,=+\-*\/<>!&|?:.]) ?/g, '$1')
      .replace(/\x01/g, ' ').trim();
    code = '';
  };
  for (const l of lines) {
    const t = l.trim();
    if (t[0] === '#') { flush(); if (out && !out.endsWith('\n')) out += '\n'; out += t + '\n'; }
    else code += ' ' + t;
  }
  flush();
  return out.trim();
}

export function glslPlugin() {
  return {
    name: 'glsl',
    setup(b) {
      b.onLoad({ filter: /\.(frag|vert)$/ }, a => ({
        contents: 'export default ' + JSON.stringify(minifyGLSL(readFileSync(a.path, 'utf8'))),
        loader: 'js',
      }));
    },
  };
}
