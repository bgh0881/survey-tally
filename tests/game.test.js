'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { core } = require('./load-core');
const { SIZE, WIN_LENGTH, newGame, canPlay, play, undo } = core;

// vm 컨텍스트의 배열을 이 컨텍스트 값으로 바꿔 deepEqual이 동작하게 한다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const idx = (r, c) => r * SIZE + c;
// [[r, c], ...]를 흑부터 번갈아 둔다.
const playAll = (moves, g = newGame()) => moves.reduce((acc, [r, c]) => play(acc, r, c), g);

test('판은 10x10, 3개를 이으면 이긴다', () => {
  assert.equal(SIZE, 10);
  assert.equal(WIN_LENGTH, 3);
  const g = newGame();
  assert.equal(g.board.length, 100);
  assert.ok(g.board.every((v) => v === null));
  assert.equal(g.turn, 'B');
  assert.equal(g.winner, null);
});

test('흑과 백이 번갈아 둔다', () => {
  let g = play(newGame(), 4, 4);
  assert.equal(g.board[idx(4, 4)], 'B');
  assert.equal(g.turn, 'W');
  g = play(g, 0, 0);
  assert.equal(g.board[idx(0, 0)], 'W');
  assert.equal(g.turn, 'B');
  assert.deepEqual(plain(g.moves), [idx(4, 4), idx(0, 0)]);
});

test('원래 상태는 바뀌지 않는다', () => {
  const g0 = newGame();
  const g1 = play(g0, 1, 1);
  assert.equal(g0.board[idx(1, 1)], null);
  assert.equal(g0.moves.length, 0);
  assert.notEqual(g0, g1);
});

test('이미 돌이 있는 자리와 판 밖에는 둘 수 없다', () => {
  const g = play(newGame(), 2, 2);
  assert.equal(play(g, 2, 2), g);
  for (const [r, c] of [[-1, 0], [0, -1], [10, 0], [0, 10], [1.5, 2], [NaN, 0]]) {
    assert.equal(canPlay(g, r, c), false, `${r},${c}`);
    assert.equal(play(g, r, c), g);
  }
});

const wins = {
  '가로': [[5, 2], [0, 0], [5, 3], [0, 9], [5, 4]],
  '세로': [[1, 7], [9, 0], [2, 7], [9, 9], [3, 7]],
  '↘ 대각선': [[3, 3], [0, 9], [4, 4], [9, 0], [5, 5]],
  '↙ 대각선': [[2, 6], [9, 9], [3, 5], [0, 0], [4, 4]],
};
for (const [name, moves] of Object.entries(wins)) {
  test(`${name}으로 3개를 이으면 흑 승리`, () => {
    const g = playAll(moves);
    assert.equal(g.winner, 'B');
    const expected = moves.filter((_, i) => i % 2 === 0).map(([r, c]) => idx(r, c)).sort((a, b) => a - b);
    assert.deepEqual(plain(g.line).sort((a, b) => a - b), expected);
  });
}

test('가운데를 나중에 채워 3개가 되어도 승리', () => {
  const g = playAll([[5, 2], [0, 0], [5, 4], [0, 9], [5, 3]]);
  assert.equal(g.winner, 'B');
});

test('백도 이길 수 있다', () => {
  const g = playAll([[0, 0], [5, 5], [0, 9], [5, 6], [9, 9], [5, 7]]);
  assert.equal(g.winner, 'W');
  assert.equal(g.turn, 'W');
});

test('2개만 이은 것과 끊긴 3개는 승리가 아니다', () => {
  let g = playAll([[5, 2], [0, 0], [5, 3], [0, 9]]);
  assert.equal(g.winner, null);
  g = playAll([[5, 2], [5, 3], [5, 4], [0, 0], [5, 5]]); // 흑 · 백 · 흑 · 흑 — 백이 사이를 막음
  assert.equal(g.winner, null);
});

test('줄 끝에서 다음 줄 처음으로 넘어가 이어지지 않는다', () => {
  // (0,8) (0,9) (1,0)은 칸 번호로는 8, 9, 10으로 이어지지만 판에서는 이어지지 않는다
  let g = playAll([[0, 8], [5, 5], [0, 9], [7, 7], [1, 0]]);
  assert.equal(g.winner, null);
  // ↙ 대각선 (0,1) (1,0) 다음 칸은 판 밖이다. 칸 번호 1, 10, 19인 (1,9)와 이어지면 안 된다
  g = playAll([[0, 1], [5, 5], [1, 0], [7, 7], [1, 9]]);
  assert.equal(g.winner, null);
});

test('4개 이상 이어져도 승리이며, 이어진 줄 전체를 표시한다', () => {
  const g = playAll([[5, 1], [0, 0], [5, 3], [0, 9], [5, 4], [9, 9], [5, 2]]);
  // 흑 (5,1) (5,3) (5,4)는 끊겨 있다가, (5,2)를 두면 1~4열 4개가 이어진다
  assert.equal(g.winner, 'B');
  assert.deepEqual(plain(g.line), [idx(5, 1), idx(5, 2), idx(5, 3), idx(5, 4)]);
});

test('승부가 나면 더 둘 수 없다', () => {
  const g = playAll(wins['가로']);
  assert.equal(canPlay(g, 9, 9), false);
  assert.equal(play(g, 9, 9), g);
});

test('판이 가득 차도록 3개가 없으면 무승부', () => {
  // 흑백 배치: BBWWBBWWBB / WWBBWWBBWW 를 번갈아 — 어느 방향으로도 3개가 이어지지 않는다
  const color = (r, c) => ((Math.floor(c / 2) + r) % 2 === 0 ? 'B' : 'W');
  const black = [], white = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) (color(r, c) === 'B' ? black : white).push([r, c]);
  assert.equal(black.length, 50);
  const moves = [];
  for (let i = 0; i < 50; i++) moves.push(black[i], white[i]);
  let g = newGame();
  for (let i = 0; i < moves.length; i++) {
    g = play(g, ...moves[i]);
    if (i < moves.length - 1) assert.equal(g.winner, null, `${i + 1}수에서 승부가 나면 안 됨`);
  }
  assert.equal(g.winner, 'draw');
  assert.equal(g.moves.length, 100);
  assert.deepEqual(plain(g.line), []);
});

test('무르기: 마지막 수를 지우고 차례를 되돌린다', () => {
  const g = playAll([[1, 1], [2, 2], [3, 3]]);
  const u = undo(g);
  assert.equal(u.board[idx(3, 3)], null);
  assert.equal(u.turn, 'B');
  assert.deepEqual(plain(u.moves), [idx(1, 1), idx(2, 2)]);
  assert.equal(undo(newGame()).moves.length, 0);
});

test('무르기: 승부가 난 수를 무르면 다시 둘 수 있다', () => {
  const g = undo(playAll(wins['가로']));
  assert.equal(g.winner, null);
  assert.deepEqual(plain(g.line), []);
  assert.equal(g.turn, 'B');
  assert.equal(canPlay(g, 5, 4), true);
});
