import test from 'node:test'; import assert from 'node:assert/strict';
import { minifyGLSL } from '../tools/glsl.mjs';
test('keeps #version and #define on their own lines', () => {
  assert.equal(minifyGLSL('#version 300 es\n#define K 2.\nprecision highp float;\n'), '#version 300 es\n#define K 2.\nprecision highp float;');
});
test('strips comments and collapses whitespace around punctuation', () => {
  assert.equal(minifyGLSL('void main( ) {\n  // hi\n  float a = 1. ; /* x */ o = vec4( a );\n}'), 'void main(){float a=1.;o=vec4(a);}');
});
test('keeps spaces between words and between +/- pairs', () => {
  assert.equal(minifyGLSL('if(a) b = x - -y; else if (c) d = e + +f;'), 'if(a)b=x- -y;else if(c)d=e+ +f;');
});
