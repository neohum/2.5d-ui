// 실행: node --test bench/classify.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFrames } from './classify.mjs';

const ev = (seq, state, frame_type) => ({
  name: 'PipelineReporter',
  ph: 'b',
  pid: 1,
  args: { frame_reporter: { frame_source: 7, frame_sequence: seq, state, ...(frame_type && { frame_type }) } },
});

test('같은 프레임의 일반 PRESENTED_ALL + FORKED DROPPED → dropped', () => {
  const r = classifyFrames([ev(1, 'STATE_PRESENTED_ALL'), ev(1, 'STATE_DROPPED', 'FORKED')]);
  assert.deepEqual(r, { frames: 1, dropped: 1, partial: 0, presented: 0 });
});

test('FORKED PRESENTED_PARTIAL → partial', () => {
  const r = classifyFrames([ev(2, 'STATE_PRESENTED_ALL'), ev(2, 'STATE_PRESENTED_PARTIAL', 'FORKED')]);
  assert.deepEqual(r, { frames: 1, dropped: 0, partial: 1, presented: 0 });
});

test('FORKED 보고만 있는 프레임도 센다', () => {
  const r = classifyFrames([ev(3, 'STATE_PRESENTED_PARTIAL', 'FORKED')]);
  assert.deepEqual(r, { frames: 1, dropped: 0, partial: 1, presented: 0 });
});

test('DROPPED가 PARTIAL보다 우선한다', () => {
  const r = classifyFrames([ev(4, 'STATE_PRESENTED_PARTIAL'), ev(4, 'STATE_DROPPED', 'FORKED')]);
  assert.equal(r.dropped, 1);
  assert.equal(r.partial, 0);
});

test('NO_UPDATE_DESIRED만 있는 프레임은 분모에서 뺀다', () => {
  const r = classifyFrames([ev(5, 'STATE_NO_UPDATE_DESIRED'), ev(6, 'STATE_PRESENTED_ALL')]);
  assert.deepEqual(r, { frames: 1, dropped: 0, partial: 0, presented: 1 });
});

test('다른 프레임은 따로 세고, 끝 이벤트(ph e)와 다른 이벤트는 무시한다', () => {
  const r = classifyFrames([
    ev(7, 'STATE_PRESENTED_ALL'),
    ev(8, 'STATE_DROPPED'),
    { ...ev(9, 'STATE_DROPPED'), ph: 'e' },
    { name: 'DrawFrame', ph: 'I', pid: 1, args: {} },
  ]);
  assert.deepEqual(r, { frames: 2, dropped: 1, partial: 0, presented: 1 });
});
