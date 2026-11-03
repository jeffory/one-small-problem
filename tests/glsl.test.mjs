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
import { readFileSync } from 'node:fs';
test('the post pass mixes toward warm white by uK.y, capped at .85 (opening flash, pre-flight F14)', () => {
  assert.match(readFileSync('src/gfx/shaders/post.frag', 'utf8'), /mix\(\s*c\s*,\s*vec3\(\s*\.94\s*,\s*\.91\s*,\s*\.86\s*\)\s*,\s*min\(\s*\.85\s*,\s*uK\.y\s*\)\s*\)/); });
test('the tape layer is a brighter silver (Plan 5)', () => {
  assert.match(readFileSync('src/gfx/shaders/bake.frag', 'utf8'), /uLay==11\)\{[^}]*a=vec4\(vec3\(\.34,\.35,\.37\)\+\.12\*wv,wv\)/); });
