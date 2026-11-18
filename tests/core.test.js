'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { core } = require('./load-core');
const { parseTable, classifyCell, formatAverage, tally } = core;

// vm 컨텍스트의 배열·객체를 이 컨텍스트의 일반 값으로 바꿔 deepEqual이 동작하게 한다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const tsv = (rows) => rows.map((r) => r.join('\t')).join('\r\n') + '\r\n';
const byName = (result) => Object.fromEntries(result.questions.map((q) => [q.name, q]));

test('칸 판정: 앞뒤 공백을 지운 값이 1~5면 유효', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3', '4 ', '\t5\t', ' 2 ', '　1　']) {
    assert.equal(classifyCell(v), 'valid', JSON.stringify(v));
  }
});

test('칸 판정: 비었거나 공백만 있으면 빈 응답', () => {
  for (const v of ['', ' ', '   ', ' ', '　', undefined]) {
    assert.equal(classifyCell(v), 'blank', JSON.stringify(v));
  }
});

test('칸 판정: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '10', '-1', '1.0', '3.5', '01', '+3', '３', '1 2', '예', 'N/A', 'x', '"3"']) {
    assert.equal(classifyCell(v), 'excluded', JSON.stringify(v));
  }
});

test('평균: 소수 셋째 자리에서 반올림해 둘째 자리까지', () => {
  assert.equal(formatAverage(0, 0), '-');
  assert.equal(formatAverage(3, 1), '3.00');
  assert.equal(formatAverage(7, 2), '3.50');
  assert.equal(formatAverage(10, 3), '3.33'); // 3.333…
  assert.equal(formatAverage(11, 3), '3.67'); // 3.666…
  assert.equal(formatAverage(5, 3), '1.67'); // 1.666…
  assert.equal(formatAverage(469, 200), '2.35'); // 정확히 2.345 → 올림
  assert.equal(formatAverage(401, 200), '2.01'); // 정확히 2.005 → 올림 (부동소수로는 2.00이 되기 쉬움)
  assert.equal(formatAverage(2009, 1000), '2.01'); // 2.009
  assert.equal(formatAverage(2004, 1000), '2.00'); // 2.004
  assert.equal(formatAverage(5, 1), '5.00');
  assert.equal(formatAverage(1, 1), '1.00');
});

test('표 나누기: 탭과 줄바꿈(\\r\\n, \\n, \\r)', () => {
  assert.deepEqual(plain(parseTable('a\tb\r\n1\t2\n3\t4\r5\t6')), [['a', 'b'], ['1', '2'], ['3', '4'], ['5', '6']]);
});

test('표 나누기: 끝의 줄바꿈과 글자 없는 줄은 건너뛰고, 탭만 있는 줄은 남긴다', () => {
  assert.deepEqual(plain(parseTable('a\tb\r\n\r\n1\t2\r\n\t\r\n\r\n')), [['a', 'b'], ['1', '2'], ['', '']]);
});

test('표 나누기: 엑셀식 따옴표 칸(칸 안 줄바꿈·탭·따옴표)', () => {
  const text = '번호\t"만족도\r\n(전반)"\t"이름 ""별칭"""\t"탭\t포함"\r\n1\t4\t5\t3\r\n';
  assert.deepEqual(plain(parseTable(text)), [
    ['번호', '만족도\r\n(전반)', '이름 "별칭"', '탭\t포함'],
    ['1', '4', '5', '3'],
  ]);
});

test('표 나누기: 형식에 맞지 않는 따옴표는 글자 그대로', () => {
  assert.deepEqual(plain(parseTable('"abc\t"x"y\tz"\r\n')), [['"abc', '"x"y', 'z"']]);
});

test('표 나누기: 맨 앞 BOM 제거, 빈 입력', () => {
  assert.deepEqual(plain(parseTable('﻿a\tb')), [['a', 'b']]);
  assert.deepEqual(plain(parseTable('')), []);
  assert.deepEqual(plain(parseTable('\r\n\n')), []);
});

test('집계: 첫 열(응답번호)은 집계하지 않는다', () => {
  const r = tally(tsv([['응답번호', 'Q1'], ['1', '3'], ['2', '5'], ['3', '9']]));
  assert.equal(r.ok, true);
  assert.equal(r.questions.length, 1);
  assert.deepEqual(plain(r.questions.map((q) => q.name)), ['Q1']);
  assert.equal(r.responseCount, 3);
});

test('집계: 문항별 유효 / 평균 / 빈 응답 / 제외', () => {
  const r = tally(tsv([
    ['응답번호', 'Q1', 'Q2', 'Q3', 'Q4'],
    ['1', '5', '', 'abc', ' 3 '],
    ['2', '4', '  ', '0', '6'],
    ['3', '4', '2', '1.5', '3'],
    ['4', '', '1', '', '3'],
  ]));
  assert.equal(r.ok, true);
  const q = byName(r);
  assert.deepEqual(plain(q.Q1), { name: 'Q1', valid: 3, sum: 13, blank: 1, excluded: 0, average: '4.33' });
  assert.deepEqual(plain(q.Q2), { name: 'Q2', valid: 2, sum: 3, blank: 2, excluded: 0, average: '1.50' });
  assert.deepEqual(plain(q.Q3), { name: 'Q3', valid: 0, sum: 0, blank: 1, excluded: 3, average: '-' });
  assert.deepEqual(plain(q.Q4), { name: 'Q4', valid: 3, sum: 9, blank: 0, excluded: 1, average: '3.00' });
  // 각 문항에서 유효 + 빈 응답 + 제외 = 응답 줄 수
  for (const s of r.questions) assert.equal(s.valid + s.blank + s.excluded, r.responseCount);
});

test('집계: 칸 수가 머리글보다 모자란 줄은 모자란 칸을 빈 응답으로 센다', () => {
  const text = '번호\tQ1\tQ2\tQ3\r\n1\t5\r\n2\r\n3\t4\t4\t4\r\n';
  const q = byName(tally(text));
  assert.deepEqual([q.Q1.valid, q.Q1.blank], [2, 1]);
  assert.deepEqual([q.Q2.valid, q.Q2.blank], [1, 2]);
  assert.deepEqual([q.Q3.valid, q.Q3.blank], [1, 2]);
  assert.equal(q.Q1.average, '4.50');
});

test('집계: 머리글보다 칸이 많은 줄의 남는 칸은 집계하지 않고 줄 수를 알린다', () => {
  const r = tally('번호\tQ1\r\n1\t3\t5\t5\r\n2\t4\r\n');
  assert.equal(r.questions.length, 1);
  assert.deepEqual(plain(byName(r).Q1), { name: 'Q1', valid: 2, sum: 7, blank: 0, excluded: 0, average: '3.50' });
  assert.equal(r.extraCellRows, 1);
});

test('집계: 탭만 있는 줄은 모든 문항에 빈 응답', () => {
  const r = tally('번호\tQ1\tQ2\r\n\t\t\r\n1\t2\t3\r\n');
  assert.equal(r.responseCount, 2);
  assert.deepEqual(plain(r.questions.map((q) => q.blank)), [1, 1]);
});

test('집계: 머리글 이름은 앞뒤 공백을 지우고, 비었으면 열 번호로 이름 붙인다', () => {
  const r = tally(' 번호 \t  만족도  \t \tQ3\r\n1\t1\t2\t3\r\n');
  assert.deepEqual(plain(r.questions.map((q) => q.name)), ['만족도', '(이름 없음 3열)', 'Q3']);
});

test('집계: 같은 이름의 문항도 열마다 따로 센다', () => {
  const r = tally('번호\tQ\tQ\r\n1\t1\t5\r\n');
  assert.deepEqual(plain(r.questions.map((q) => [q.name, q.average])), [['Q', '1.00'], ['Q', '5.00']]);
});

test('집계: 머리글만 있으면 모두 0, 평균 -', () => {
  const r = tally('번호\tQ1\tQ2\r\n');
  assert.equal(r.ok, true);
  assert.equal(r.responseCount, 0);
  for (const q of r.questions) assert.deepEqual([q.valid, q.blank, q.excluded, q.average], [0, 0, 0, '-']);
});

test('집계: 빈 입력과 문항 없는 머리글은 오류', () => {
  assert.deepEqual(plain(tally('')), { ok: false, error: 'empty' });
  assert.deepEqual(plain(tally('  \r\n')), { ok: false, error: 'no-questions' });
  assert.deepEqual(plain(tally('응답번호\r\n1\r\n')), { ok: false, error: 'no-questions' });
});

test('집계: 따옴표로 감싼 여러 줄 머리글', () => {
  const r = tally('번호\t"Q1\r\n만족도"\r\n1\t4\r\n2\t2\r\n');
  assert.equal(r.responseCount, 2);
  assert.equal(r.questions[0].name, 'Q1\r\n만족도');
  assert.equal(r.questions[0].average, '3.00');
});

test('집계: 많은 응답에서도 평균이 정확하다', () => {
  // 1이 1000개, 2가 1000개, 3이 1개 → 3003/2001 = 1.50074… → 1.50
  const rows = [['번호', 'Q']];
  for (let i = 0; i < 1000; i++) rows.push([String(i), '1']);
  for (let i = 0; i < 1000; i++) rows.push([String(i), '2']);
  rows.push(['x', '3']);
  const q = tally(tsv(rows)).questions[0];
  assert.deepEqual([q.valid, q.sum, q.average], [2001, 3003, '1.50']);
});
