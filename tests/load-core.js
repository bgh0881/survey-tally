'use strict';
// index.html 안의 <script id="tally-core">를 뽑아 실행한다. 배포되는 바로 그 코드를 시험하기 위함.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const match = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
if (!match) throw new Error('index.html에서 <script id="tally-core">를 찾지 못했습니다.');

const sandbox = { module: { exports: {} } };
vm.runInNewContext(match[1], sandbox, { filename: 'index.html#tally-core' });

module.exports = { core: sandbox.module.exports, html, ROOT };
