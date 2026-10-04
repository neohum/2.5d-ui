#!/usr/bin/env node
// 네 렌더 방식(A~D) × 블록 수(N)를 CPU 6배 감속 Chromium에서 재고 bench/results.md에 쓴다.
// 사용: node bench/run.mjs   (REPS=3, IDLE_MS=10000, HOVER_MS=2000, SIZES=50,500,1000,2000, ONLY=A,C, OUT=results.md 로 조절)
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPS = Number(process.env.REPS ?? 3);
const IDLE_MS = Number(process.env.IDLE_MS ?? 10000);
const HOVER_MS = Number(process.env.HOVER_MS ?? 2000);
const THROTTLE = 6;
const SIZES = (process.env.SIZES ?? "50,500,1000,2000").split(",").map(Number);
const APPROACHES = [
  { id: 'A', file: 'a-css2d.html', name: 'CSS 2D matrix() 면' },
  { id: 'B', file: 'b-css3d.html', name: 'CSS 3D preserve-3d' },
  { id: 'C', file: 'c-svg.html', name: 'SVG polygon' },
  { id: 'D', file: 'd-canvas.html', name: 'Canvas 2D' },
].filter((a) => !process.env.ONLY || process.env.ONLY.split(",").includes(a.id));
const OUT = process.env.OUT ?? "results.md";

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function serve() {
  const server = http.createServer(async (req, res) => {
    const name = path.basename(new URL(req.url, 'http://x').pathname);
    try {
      const body = await readFile(path.join(here, name));
      res.writeHead(200, { 'content-type': MIME[path.extname(name)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const median = (xs) => {
  const s = xs.filter((v) => v != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function openPage(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.mouse.move(1, 1); // 블록이 없는 구석. 시작 시 우발적 호버를 막는다.
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bench?.ready === true, null, { timeout: 120000 });
  return { context, page, cdp };
}

async function measureOnce(browser, url) {
  const { context, page, cdp } = await openPage(browser, url);
  const marks = await page.evaluate(() => ({
    built: performance.getEntriesByName('built')[0].startTime,
    rendered: performance.getEntriesByName('rendered')[0].startTime,
    elements: document.getElementsByTagName('*').length,
    targets: window.__bench.targets,
  }));
  const counters = await cdp.send('Memory.getDOMCounters');
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');

  // 호버 패스 1 (표시 프레임): rAF 탐침 없이 트레이스만 켜고 호버한다. 탐침이 매 프레임
  // 메인 프레임을 요구하면 컴포지터 스케줄이 바뀌므로 두 패스를 나눈다.
  await browser.startTracing(page, { categories: ["disabled-by-default-devtools.timeline.frame"] });
  await hoverSweep(page, marks.targets);
  const trace = JSON.parse((await browser.stopTracing()).toString("utf8"));
  const presented = presentedFrames(trace.traceEvents);

  await page.mouse.move(1, 1);
  await page.waitForTimeout(400); // 패스 1의 들림이 모두 내려온 뒤 시작한다.

  // 호버 패스 2 (메인 스레드): 페이지 안 rAF 탐침으로 메인 스레드 프레임 간격을 잰다.
  await page.evaluate(() => {
    const ts = [];
    window.__probe = { ts, on: true };
    const loop = (t) => {
      ts.push(t);
      if (window.__probe.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await hoverSweep(page, marks.targets);
  const ts = await page.evaluate(() => {
    window.__probe.on = false;
    return window.__probe.ts;
  });
  const main = mainThreadFrames(ts);
  return {
    context, page, cdp,
    result: {
      built: marks.built,
      rendered: marks.rendered,
      elements: marks.elements,
      nodes: counters.nodes,
      heapMB: heap.usedSize / 1048576,
      ...presented,
      ...main,
    },
  };
}

// 블록 20개의 윗면 중심을 HOVER_MS 동안 고르게 나눠 차례로 호버한다.
async function hoverSweep(page, targets) {
  const step = HOVER_MS / targets.length;
  const t0 = Date.now();
  for (let k = 0; k < targets.length; k++) {
    const [x, y] = targets[k];
    await page.mouse.move(x, y, { steps: 3 });
    const wait = t0 + (k + 1) * step - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.waitForTimeout(250); // 마지막 블록의 180ms 트랜지션까지 담는다.
}

// 표시 프레임: cc의 PipelineReporter(프레임마다 하나, 컴포지터 기준 최종 상태).
// FORKED 보고는 늦은 메인 프레임 몫을 따로 떼어 낸 사본이라 같은 vsync를 두 번 세지 않도록 뺀다.
// 업데이트가 필요 없던 프레임(STATE_NO_UPDATE_DESIRED)은 분모에서 뺀다.
function presentedFrames(events) {
  const c = { STATE_PRESENTED_ALL: 0, STATE_PRESENTED_PARTIAL: 0, STATE_DROPPED: 0 };
  for (const e of events) {
    if (e.name !== "PipelineReporter" || e.ph !== "b") continue;
    const r = e.args?.frame_reporter;
    if (!r || r.frame_type === "FORKED" || !(r.state in c)) continue;
    c[r.state]++;
  }
  const total = c.STATE_PRESENTED_ALL + c.STATE_PRESENTED_PARTIAL + c.STATE_DROPPED;
  return {
    pFrames: total,
    pDropPct: total ? (100 * c.STATE_DROPPED) / total : null,
    pPartialPct: total ? (100 * c.STATE_PRESENTED_PARTIAL) / total : null,
  };
}

// 메인 스레드 프레임: rAF 간격 g마다 놓친 vsync 수 max(0, round(g / 16.67) − 1)를 더해
// 창 길이로 기대한 프레임 수로 나눈다. 33.3ms 간격이 이어지면 50%가 된다.
const VSYNC = 1000 / 60;
function mainThreadFrames(ts) {
  if (ts.length < 2) return { mFrames: 0, mDropPct: null, worstGap: null };
  let missed = 0, worst = 0;
  for (let k = 1; k < ts.length; k++) {
    const g = ts[k] - ts[k - 1];
    missed += Math.max(0, Math.round(g / VSYNC) - 1);
    worst = Math.max(worst, g);
  }
  const expected = Math.round((ts[ts.length - 1] - ts[0]) / VSYNC);
  return { mFrames: expected, mDropPct: expected ? (100 * missed) / expected : null, worstGap: worst };
}

async function measureIdle(browser, page) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(600); // 호버 해제 트랜지션(180ms)이 끝나길 기다린다.
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
  await page.waitForTimeout(IDLE_MS);
  const buf = await browser.stopTracing();
  const { traceEvents } = JSON.parse(buf.toString('utf8'));
  const count = (name) => traceEvents.filter((e) => e.name === name && e.ph !== 'E').length;
  return { raf: count('FireAnimationFrame'), paint: count('Paint') };
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const version = browser.version();
const started = Date.now();
const rows = [];
try {
  for (const a of APPROACHES) {
    for (const n of SIZES) {
      const runs = [];
      let last;
      for (let r = 0; r < REPS; r++) {
        if (last) await last.context.close();
        last = await measureOnce(browser, `${base}/${a.file}?n=${n}`);
        runs.push(last.result);
      }
      const idle = await measureIdle(browser, last.page);
      await last.context.close();
      const pick = (k) => median(runs.map((x) => x[k]));
      const row = {
        id: a.id, name: a.name, n,
        built: pick('built'), rendered: pick('rendered'),
        renderedAll: runs.map((x) => x.rendered),
        elements: pick('elements'), nodes: pick('nodes'), heapMB: pick('heapMB'),
        pDropPct: pick('pDropPct'), pPartialPct: pick('pPartialPct'), pFrames: pick('pFrames'),
        mDropPct: pick('mDropPct'), mFrames: pick('mFrames'), worstGap: pick('worstGap'),
        idleRaf: idle.raf, idlePaint: idle.paint,
      };
      rows.push(row);
      console.log(`${a.id} n=${n}: render ${row.rendered.toFixed(0)}ms [${row.renderedAll.map((v) => v.toFixed(0)).join(', ')}], presented drop ${row.pDropPct?.toFixed(1)}% partial ${row.pPartialPct?.toFixed(1)}% (${row.pFrames}f), main drop ${row.mDropPct?.toFixed(1)}%, nodes ${row.nodes}, heap ${row.heapMB.toFixed(2)}MB, idle rAF ${row.idleRaf} paint ${row.idlePaint}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

const cpus = os.cpus();
const elapsed = ((Date.now() - started) / 1000).toFixed(0);
const now = new Date();
const local = now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }) + ' (Asia/Seoul)';
const f = (v, d = 1) => (v == null ? '—' : v.toFixed(d));
const md = `# 렌더 방식 벤치마크 결과

> **주의: 이 수치는 실제 크롬북이 아니라 데스크톱에서 CDP \`Emulation.setCPUThrottlingRate\`(rate ${THROTTLE})로 CPU만 ${THROTTLE}배 느리게 한 결과다.**
> GPU·메모리 대역폭·래스터 스레드는 감속되지 않으므로 합성(B)·래스터 비용은 실기기보다 낮게 나온다. 상대 비교로만 읽는다.

- 측정 시각: ${local} · ISO ${now.toISOString()}
- CPU: ${cpus[0]?.model ?? 'unknown'} × ${cpus.length} 코어 · OS: ${os.type()} ${os.release()} (${os.arch()}) · RAM ${(os.totalmem() / 2 ** 30).toFixed(0)} GB
- 브라우저: Chromium ${version} (Playwright, headless) · 뷰포트 1366×768 · DPR 1
- 반복: 방식×N마다 새 컨텍스트로 ${REPS}회, 표의 값은 중앙값. 유휴 측정은 마지막 반복 페이지에서 1회.
- 총 실행 시간: ${elapsed}초 · 재현: \`${[process.env.ONLY && `ONLY=${process.env.ONLY}`, `SIZES=${SIZES.join(",")}`, OUT !== "results.md" && `OUT=${OUT}`].filter(Boolean).join(" ")} node bench/run.mjs\`

## 표 1. 측정값

| 방식 | N | 첫 렌더(ms) | 그중 빌드 완료(ms) | 표시 프레임 드롭(%) | 표시 프레임 부분 갱신(%) | 표시 프레임 수 | 메인 스레드 프레임 누락(%) | 최장 rAF 간격(ms) | DOM 요소 | DOM 노드(CDP) | JS 힙(MB) | 유휴 ${IDLE_MS / 1000}s rAF | 유휴 ${IDLE_MS / 1000}s Paint |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.map((r) => `| ${r.id} ${r.name} | ${r.n} | ${f(r.rendered)} | ${f(r.built)} | ${f(r.pDropPct)} | ${f(r.pPartialPct)} | ${r.pFrames} | ${f(r.mDropPct)} | ${f(r.worstGap)} | ${r.elements} | ${r.nodes} | ${f(r.heapMB, 2)} | ${r.idleRaf} | ${r.idlePaint} |`).join('\n')}

## 반복별 첫 렌더(ms)

| 방식 | N | 반복값 |
| --- | ---: | --- |
${rows.map((r) => `| ${r.id} | ${r.n} | ${r.renderedAll.map((v) => f(v)).join(', ')} |`).join('\n')}

## 측정 방법

- **첫 렌더**: 내비게이션 시작(\`performance.timeOrigin\`) → 블록을 모두 만든 뒤 double rAF 안에서 찍은 \`performance.mark('rendered')\`. 네 방식 모두 같은 모듈 스크립트에서 같은 데이터(시드 고정 mulberry32 높이)로 만든다. A·B·C는 마크업 문자열을 \`innerHTML\` 한 번으로 넣고, D는 캔버스에 한 번 그린다. "빌드 완료"는 그 직후(첫 rAF 전) \`performance.mark('built')\`.
- **호버**: 블록 20개의 윗면 중심을 약 ${HOVER_MS / 1000}초 동안 차례로 호버한다(\`page.mouse.move\`, 3단계, 마지막 뒤 250ms 더 기록). A·B·C는 CSS \`:hover\` \`transition: transform 0.18s ease-out\`, D는 블록마다 따로 같은 180ms ease-out(cubic-bezier(0,0,.58,1))으로 올리고 내리며, 움직이는 블록이 있는 동안만 rAF로 캔버스 전체를 다시 그린다. 같은 페이지에서 두 패스를 따로 돈다.
  - **표시 프레임 드롭 / 부분 갱신 (컴포지터 기준, 1번 패스)**: rAF 탐침 없이 \`disabled-by-default-devtools.timeline.frame\` 트레이스를 켜고, cc \`PipelineReporter\` 이벤트의 \`frame_reporter.state\`를 센다. FORKED 사본과 \`STATE_NO_UPDATE_DESIRED\`는 뺀다. 드롭 = \`STATE_DROPPED\` / (PRESENTED_ALL + PRESENTED_PARTIAL + DROPPED). 부분 갱신 = \`STATE_PRESENTED_PARTIAL\` / 같은 분모. 부분 갱신은 화면은 갱신됐지만 늦은 메인 스레드 몫(예: 새 호버 상태 반영)이 빠진 프레임이다. 컴포지터에서 도는 CSS transform 트랜지션은 메인 스레드가 막혀도 이 지표에서는 드롭이 아니다.
  - **메인 스레드 프레임 누락 (2번 패스)**: 페이지 안 rAF 탐침의 간격 g마다 놓친 vsync 수 max(0, round(g / 16.67) − 1)를 더하고, 창 길이 / 16.67로 나눈 값. 33.3ms 간격이 이어지면 50%다. 메인 스레드가 얼마나 막혔는지를 보이며, 화면에 표시된 프레임 손실과는 다르다(D는 메인 스레드에서 그리므로 두 지표가 함께 움직인다).
- **DOM 요소**: \`document.getElementsByTagName('*').length\`. **DOM 노드**: CDP \`Memory.getDOMCounters\`의 \`nodes\`(텍스트 노드 포함, 문서 단위).
- **JS 힙**: CDP \`HeapProfiler.collectGarbage\` 뒤 \`Runtime.getHeapUsage\`의 \`usedSize\`.
- **유휴 활동**: 마우스를 블록 없는 구석으로 옮기고 600ms 뒤, ${IDLE_MS / 1000}초 동안 \`devtools.timeline\` 트레이스에서 \`FireAnimationFrame\`·\`Paint\` 이벤트 수를 센다.
`;
await writeFile(path.join(here, OUT), md);
console.log(`bench/${OUT} 작성 (${elapsed}s)`);
