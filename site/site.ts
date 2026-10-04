// 문서 사이트 공용 동작: 테마 전환, 예시(실행 + 코드) 찍기, 코드 복사, iso-select 기록.
// 라이브러리 자체는 쓰지 않는다 — 엘리먼트 등록은 각 페이지가 /packages/core/src/index.ts로 한다.

const THEMES = ["system", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const THEME_NAME: Record<Theme, string> = { system: "시스템", light: "라이트", dark: "다크" };
const KEY = "iso-docs-theme";

const root = document.documentElement;

const readTheme = (): Theme => {
  const t = root.dataset.theme;
  return t == "light" || t == "dark" ? t : "system";
};

for (const btn of document.querySelectorAll<HTMLButtonElement>("button.theme")) {
  const paint = () => (btn.textContent = "테마: " + THEME_NAME[readTheme()]);
  paint();
  btn.addEventListener("click", () => {
    const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
    if (next == "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next == "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // 저장소가 막힌 환경(시크릿 창 등)에서는 이번 페이지에만 적용한다.
    }
    paint();
  });
}

/** 템플릿 원문의 공통 들여쓰기와 앞뒤 빈 줄을 걷어 낸다. */
const dedent = (s: string): string => {
  const lines = s.replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(pad)).join("\n");
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** `<pre>`를 감싸고 복사 버튼을 붙인다. */
export const codeBlock = (pre: HTMLPreElement): HTMLElement => {
  const box = el("div", "code");
  pre.replaceWith(box);
  const btn = el("button", "copy", "복사");
  btn.type = "button";
  btn.setAttribute("aria-label", "코드 복사");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent ?? "");
      btn.textContent = "복사됨";
    } catch {
      btn.textContent = "복사 실패";
    }
    setTimeout(() => (btn.textContent = "복사"), 1500);
  });
  box.append(pre, btn);
  return box;
};

// <div class="example" data-log><script type="text/html">…</script></div>
// → 실제로 그린 예시 + 같은 원문의 코드 블록. 예시와 코드가 어긋날 수 없다.
// <template>가 아니라 script인 이유: template.innerHTML은 속성 따옴표를 &quot;로 다시 써서
// data='[…]' 원문을 보여 줄 수 없다. script 내용은 원문 그대로 남는다.
for (const ex of document.querySelectorAll<HTMLElement>(".example")) {
  const src = ex.querySelector<HTMLScriptElement>('script[type="text/html"]');
  if (!src) continue;
  const code = dedent(src.textContent ?? "");
  const preview = el("div", "preview");
  preview.innerHTML = code;
  const pre = el("pre");
  pre.append(el("code", "", code));
  src.replaceWith(preview);
  if (ex.hasAttribute("data-log")) {
    const log = el("p", "log", "블록을 누르거나 Tab으로 옮겨 Enter를 누르면 iso-select 이벤트가 여기에 기록됩니다.");
    log.setAttribute("aria-live", "polite");
    ex.append(log);
    ex.addEventListener("iso-select", (e) => {
      const { index, item } = (e as CustomEvent<{ index: number; item: unknown }>).detail;
      log.textContent = `iso-select → index: ${index}, item: ${JSON.stringify(item)}`;
    });
  }
  ex.append(pre);
  codeBlock(pre);
}

for (const pre of document.querySelectorAll<HTMLPreElement>("pre[data-copy]")) codeBlock(pre);
