// cc PipelineReporter 트레이스 이벤트를 프레임 단위로 합쳐 분류한다.
//
// 한 BeginFrame에 보고가 여럿 붙을 수 있다(메인 프레임이 늦으면 FORKED 사본이 생긴다).
// Chromium도 같은 BeginFrame의 결과를 합쳐서 판단하므로(cc/metrics/frame_sorter.cc,
// frame_info.cc), 여기서도 (프로세스, frame_source, frame_sequence)로 묶은 뒤
//   - 하나라도 STATE_DROPPED  → dropped
//   - 아니고 하나라도 STATE_PRESENTED_PARTIAL → partial
//   - 아니고 하나라도 STATE_PRESENTED_ALL → presented
//   - 모두 STATE_NO_UPDATE_DESIRED → 업데이트가 필요 없던 프레임이라 세지 않는다.
export function classifyFrame(states) {
  if (states.includes('STATE_DROPPED')) return 'dropped';
  if (states.includes('STATE_PRESENTED_PARTIAL')) return 'partial';
  if (states.includes('STATE_PRESENTED_ALL')) return 'presented';
  return null;
}

export function classifyFrames(events) {
  const frames = new Map();
  for (const e of events) {
    if (e.name !== 'PipelineReporter' || e.ph !== 'b') continue;
    const r = e.args?.frame_reporter;
    if (!r?.state) continue;
    const key = `${e.pid}:${r.frame_source}:${r.frame_sequence}`;
    if (!frames.has(key)) frames.set(key, []);
    frames.get(key).push(r.state);
  }
  const out = { frames: 0, dropped: 0, partial: 0, presented: 0 };
  for (const states of frames.values()) {
    const kind = classifyFrame(states);
    if (!kind) continue;
    out.frames++;
    out[kind]++;
  }
  return out;
}
