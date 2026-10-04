// 플레이그라운드: textarea의 JSON과 속성 입력을 엘리먼트 하나에 그대로 옮긴다.
// 잘못된 JSON도 data 속성에 그대로 넣어, 엘리먼트 자신의 오류 상태를 보여 준다.

type Tag = "iso-bars" | "iso-stack" | "iso-heatmap" | "iso-ledger" | "iso-kpi";

interface Sample {
  data: unknown;
  max?: string;
  label: string;
}

// 모두 예시 데이터.
const SAMPLES: Record<Tag, Sample> = {
  "iso-bars": {
    label: "앱별 메모리 사용량 (MB)",
    data: [
      { k: "문서", v: 180 },
      { k: "시트", v: 240 },
      { k: "화상회의", v: 410 },
      { k: "클래스", v: 150 },
    ],
  },
  "iso-stack": {
    label: "월별 자원 사용 (GB)",
    data: [
      { k: "1월", parts: [{ name: "CPU", v: 30 }, { name: "메모리", v: 20 }] },
      { k: "2월", parts: [{ name: "CPU", v: 45 }, { name: "메모리", v: 25 }] },
      { k: "3월", parts: [{ name: "CPU", v: 20 }, { name: "메모리", v: 40 }] },
    ],
  },
  "iso-heatmap": {
    label: "요일·시간대별 접속 수",
    data: { rows: ["월", "화", "수"], cols: ["9시", "13시", "17시"], values: [[42, 12, 30], [45, 15, 28], [39, 10, 33]] },
  },
  "iso-ledger": {
    label: "릴리스 기록",
    data: [
      { k: "v1.0", note: "첫 공개" },
      { k: "v1.1", note: "다크 테마" },
      { k: "v1.2", note: "키보드 탐색" },
    ],
  },
  // iso-kpi는 data 대신 value·suffix 속성을 받으므로, 이 JSON의 키를 속성으로 옮긴다.
  "iso-kpi": { label: "배터리 평균 잔량", max: "100", data: { value: 72, suffix: "%" } },
};

const ATTRS = ["max", "unit", "height-units", "label"] as const;
const KPI_KEYS = ["value", "suffix"] as const;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const type = $<HTMLSelectElement>("pg-type");
const ta = $<HTMLTextAreaElement>("pg-data");
const statusEl = $<HTMLParagraphElement>("pg-status");
const stage = $<HTMLDivElement>("pg-stage");
const code = $<HTMLElement>("pg-code");
const input = (a: string) => $<HTMLInputElement>("pg-" + a);

let el: HTMLElement;

/** 바뀐 속성만 쓴다. 속성 하나마다 다시 그리므로(잘못된 데이터면 매번 console.error) 같은 값은 건너뛴다. */
const attr = (name: string, value: string | null) => {
  if (el.getAttribute(name) === value) return;
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
};

const quote = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;");

const snippet = (tag: Tag, raw: string, parsed: unknown, ok: boolean): string => {
  const names = tag == "iso-kpi" ? [...ATTRS, ...KPI_KEYS] : ATTRS;
  const attrs = names.flatMap((n) => {
    const v = el.getAttribute(n);
    return v == null ? [] : [` ${n}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`];
  });
  const data = tag == "iso-kpi" ? "" : ` data='${quote(ok ? JSON.stringify(parsed) : raw)}'`;
  return `<${tag}${attrs.join("")}${data}></${tag}>`;
};

const update = () => {
  const tag = type.value as Tag;
  const raw = ta.value;
  let parsed: unknown;
  let ok = true;
  let err = "";
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    ok = false;
    err = (e as Error).message;
  }
  ta.setAttribute("aria-invalid", String(!ok));
  statusEl.classList.toggle("bad", !ok);

  for (const a of ATTRS) attr(a, input(a).value.trim() || null);

  if (tag == "iso-kpi") {
    // kpi에는 data 속성이 없다. JSON이 깨지면 이전 값을 그대로 둔다.
    if (ok && parsed && typeof parsed == "object") {
      const o = parsed as Record<string, unknown>;
      for (const k of KPI_KEYS) attr(k, o[k] == null ? null : String(o[k]));
    }
    statusEl.textContent = ok ? "value·suffix 키를 속성으로 옮겼습니다." : `JSON 오류: ${err} (iso-kpi는 이전 값을 유지합니다)`;
  } else {
    attr("data", raw);
    statusEl.textContent = ok ? "올바른 JSON입니다." : `JSON 오류: ${err} — 엘리먼트가 오류 상태를 보입니다.`;
  }
  code.textContent = snippet(tag, raw, parsed, ok);
};

/** 엘리먼트 종류를 바꾸면 그 종류의 예시 데이터와 속성으로 새로 만든다. */
const load = () => {
  const tag = type.value as Tag;
  const s = SAMPLES[tag];
  ta.value = JSON.stringify(s.data, null, 2);
  input("max").value = s.max ?? "";
  input("unit").value = "";
  input("height-units").value = "";
  input("label").value = s.label;
  el = document.createElement(tag);
  stage.replaceChildren(el);
  update();
};

type.addEventListener("change", load);
$("pg-reset").addEventListener("click", load);
$("play-form").addEventListener("input", (e) => {
  if (e.target !== type) update();
});
$("play-form").addEventListener("submit", (e) => e.preventDefault());

load();

// 모듈로 두어 최상위 이름(status 등)이 전역 window 속성과 겹치지 않게 한다.
export {};
