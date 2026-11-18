'use strict';
// index.html이 외부 자원·네트워크·저장 API를 쓰지 않는지, 규칙 코드가 화면과 분리됐는지 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { html, coreSource } = require('./load-core');

test('외부 스크립트·스타일·글꼴·이미지를 불러오지 않는다', () => {
  assert.doesNotMatch(html, /<script[^>]*\ssrc\s*=/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /@import|@font-face|url\(/i);
  assert.doesNotMatch(html, /<(img|iframe|object|embed|video|audio|source)\b/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('네트워크·저장 API와 HTML 문자열 삽입을 쓰지 않는다', () => {
  for (const word of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'innerHTML', 'outerHTML',
    'insertAdjacentHTML', 'document.write']) {
    assert.equal(html.includes(word), false, word);
  }
});

test('CSP가 외부 연결을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m);
  for (const rule of ["default-src 'none'", "connect-src 'none'", "img-src 'none'"]) assert.ok(m[1].includes(rule), rule);
});

test('규칙 코드는 화면(DOM)을 건드리지 않는다', () => {
  assert.doesNotMatch(coreSource, /\b(document|window|navigator|addEventListener)\b/);
});
