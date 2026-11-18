'use strict';
// index.html이 외부 자원·저장소·네트워크 API를 쓰지 않는지 정적으로 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { html, ROOT } = require('./load-core');

test('.nojekyll이 저장소 맨 위에 빈 파일로 있다', () => {
  const stat = fs.statSync(path.join(ROOT, '.nojekyll'));
  assert.equal(stat.isFile(), true);
  assert.equal(stat.size, 0);
});

test('외부 스크립트·스타일·글꼴·이미지를 불러오지 않는다', () => {
  assert.doesNotMatch(html, /<script[^>]*\ssrc\s*=/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /@import|@font-face|url\(/i);
  assert.doesNotMatch(html, /<(img|iframe|object|embed|video|audio|source)\b/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('데이터를 보내거나 저장하는 API를 쓰지 않는다', () => {
  for (const word of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'innerHTML', 'outerHTML',
    'insertAdjacentHTML', 'document.write', '<form']) {
    assert.equal(html.includes(word), false, word);
  }
});

test('CSP가 외부 연결과 폼 전송을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP 메타 태그가 있어야 합니다');
  const csp = m[1];
  for (const rule of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "img-src 'none'"]) {
    assert.ok(csp.includes(rule), rule);
  }
});

test('입력칸은 맞춤법 검사와 자동완성을 끈다', () => {
  const m = html.match(/<textarea[^>]*>/);
  assert.ok(m);
  assert.match(m[0], /spellcheck="false"/);
  assert.match(m[0], /autocomplete="off"/);
});

test('결과 표 머리글은 문항 / 유효 응답 / 평균 / 빈 응답 / 제외', () => {
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const cols = [...thead.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]);
  assert.deepEqual(cols, ['문항', '유효 응답', '평균', '빈 응답', '제외']);
});

test('계산 로직 스크립트는 화면(DOM)을 건드리지 않는다', () => {
  const core = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(core, /\b(document|window|navigator|addEventListener)\b/);
});
