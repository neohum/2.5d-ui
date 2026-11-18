# Vibe Tokens Design Specification (vibe-tokens.design.md)

> **스타일 규약:** Vibe Tokens (10대 벤치마크 융합 디자인 토큰 및 안티-슬롭 엔진)  
> **적용 범위:** 하네스 전역 UI 컴포넌트, 대시보드, 랜딩 페이지, B2B SaaS 인터페이스  
> **인코딩 & 언어:** UTF-8 no BOM, 한국어 문서 / 영어 토큰 식별자  

---

## 1. 개요 및 디자인 철학

본 토큰 명세는 **Realtime Colors**(실시간 색상 조화 및 WCAG 명도 대비), **Fontshare**(고품질 타이포그래피 표준), **shadcn/ui**(접근성 프리미티브) 및 **Mobbin / SaaSFrame**의 검증된 레이아웃 규칙을 결합하여, AI 에이전트("바이브 코더")가 생성하는 코드에서 전형적인 시각적 결함("AI Slop")을 원천 차단하기 위해 수립되었습니다.

### 1.1 하네스 절대 불변식
1. **대칭 테두리 필수 (Anti-Cuticle Rule):** 사방 균일한 전면 대칭 테두리(`border: 1px|2px solid ...`)만을 사용하며, `border-l-4` 등 편향된 손톱 테두리는 일체 금지합니다.
2. **버튼 & 배지 완벽 중앙 정렬:** 모든 버튼/배지는 `inline-flex items-center justify-center leading-none` 유틸리티를 적용합니다.
3. **한국어 어절 단위 줄바꿈:** 본문은 `break-keep`, 제목은 `break-keep text-balance`, 버튼은 `whitespace-nowrap`을 필수 적용합니다.
4. **WCAG 2.1 AA 명도 대비:** 일반 텍스트는 배경 대비 최소 **4.5:1**, 라지 텍스트 및 핵심 아이콘은 **3.0:1** 이상의 명도비를 엄격히 유지합니다.
5. **터치 타깃 안전망:** 모든 대화형 인터랙티브 요소는 최소 **44px × 44px** 이상의 클릭/터치 히트박스를 확보합니다.

---

## 2. OKLCH 색공간 토큰 (Color Palette)

지각적으로 균일한(Perceptually Uniform) OKLCH 색공간을 사용하여 다양한 밝기와 색상환에서도 일관된 시각적 대비를 제공합니다.

```css
:root {
  /* ========================================================================= */
  /* Light Mode Palette                                                        */
  /* ========================================================================= */
  --vibe-bg: oklch(0.985 0.003 247.8);              /* Base Page Background (#f9fafb) */
  --vibe-surface: oklch(1.0 0 0);                   /* Card & Container Surface (#ffffff) */
  --vibe-surface-subtle: oklch(0.965 0.006 247.8);   /* Subtle Background / Hover (#f3f4f6) */
  
  /* Symmetric Borders (1px / 2px standard) */
  --vibe-border: oklch(0.88 0.008 247.8);           /* Default Border (#e5e7eb) */
  --vibe-border-hover: oklch(0.72 0.015 247.8);     /* Border Focus/Hover (#9ca3af) */
  --vibe-border-focus: oklch(0.55 0.20 250);        /* Interactive Focus Ring */
  
  /* Text & Glyphs (WCAG 2.1 AA Compliant on --vibe-surface: CR >= 4.5:1) */
  --vibe-text-primary: oklch(0.15 0.005 247.8);     /* Primary Heading & Body Text (CR ~ 17.5:1) */
  --vibe-text-secondary: oklch(0.42 0.012 247.8);   /* Secondary / Subtitle Text (CR ~ 5.8:1) */
  --vibe-text-muted: oklch(0.54 0.015 247.8);       /* Captions / Meta Text (CR ~ 4.5:1 floor) */
  
  /* Brand & Interactive Accents */
  --vibe-accent: oklch(0.55 0.22 260);              /* Primary Brand Indigo/Cobalt */
  --vibe-accent-hover: oklch(0.48 0.24 260);        /* Accent Active / Hover */
  --vibe-accent-subtle: oklch(0.95 0.04 260);       /* Accent Surface / Pill Badge */
  --vibe-accent-text: oklch(0.99 0.002 247.8);      /* Text on Accent Button (CR >= 6.0:1) */
  
  /* Status Feedback Colors */
  --vibe-success: oklch(0.58 0.18 145);             /* Success Green */
  --vibe-warning: oklch(0.72 0.16 75);              /* Warning Amber */
  --vibe-danger: oklch(0.56 0.22 25);               /* Destructive / Danger Red */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* ========================================================================= */
    /* Dark Mode Palette                                                         */
    /* ========================================================================= */
    --vibe-bg: oklch(0.12 0.006 247.8);             /* Dark Page Background (#111216) */
    --vibe-surface: oklch(0.17 0.008 247.8);        /* Dark Surface (#1c1e24) */
    --vibe-surface-subtle: oklch(0.22 0.010 247.8);  /* Subtle Dark (#262a33) */
    
    /* Symmetric Borders */
    --vibe-border: oklch(0.28 0.010 247.8);         /* Dark Border */
    --vibe-border-hover: oklch(0.42 0.015 247.8);   /* Dark Border Hover */
    --vibe-border-focus: oklch(0.65 0.20 255);      /* Dark Focus Ring */
    
    /* Text & Glyphs (WCAG 2.1 AA Compliant on --vibe-surface: CR >= 4.5:1) */
    --vibe-text-primary: oklch(0.98 0.002 247.8);   /* Dark Primary Text (CR ~ 16.0:1) */
    --vibe-text-secondary: oklch(0.75 0.008 247.8); /* Dark Secondary Text (CR ~ 7.2:1) */
    --vibe-text-muted: oklch(0.62 0.012 247.8);     /* Dark Muted Text (CR ~ 4.6:1 floor) */
    
    /* Brand & Interactive Accents */
    --vibe-accent: oklch(0.65 0.20 260);            /* Dark Accent */
    --vibe-accent-hover: oklch(0.72 0.18 260);      /* Dark Accent Hover */
    --vibe-accent-subtle: oklch(0.25 0.06 260);     /* Dark Accent Surface */
    --vibe-accent-text: oklch(0.99 0.002 247.8);    /* Text on Dark Accent */
    
    /* Status Feedback Colors */
    --vibe-success: oklch(0.68 0.18 145);
    --vibe-warning: oklch(0.78 0.16 75);
    --vibe-danger: oklch(0.65 0.22 25);
  }
}
```

---

## 3. 4/8pt 스페이싱 및 그리드 토큰 (Spacing Tokens)

모든 여백과 크기는 4px 기본 단위를 기준으로 배수 확장됩니다.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
}
```

| 토큰 | 픽셀 값 | 사용처 | Tailwind 매핑 |
| :--- | :--- | :--- | :--- |
| `--space-1` | `4px` | 초미세 간격, 인라인 아이콘 여백 | `p-1`, `gap-1`, `space-x-1` |
| `--space-2` | `8px` | 버튼 내부 요소 간격, 배지 패딩 | `p-2`, `gap-2`, `space-x-2` |
| `--space-3` | `12px` | 콤팩트 카드 인셋, 인풋 수평 여백 | `p-3`, `gap-3`, `px-3` |
| `--space-4` | `16px` | 표준 카드 패딩, 그리드 갭 기본값 | `p-4`, `gap-4`, `p-4` |
| `--space-6` | `24px` | 데스크톱 섹션 여백, 큰 카드 패딩 | `p-6`, `gap-6`, `p-6` |
| `--space-8` | `32px` | 컴포넌트 간 분할 여백, 모달 인셋 | `p-8`, `gap-8`, `my-8` |
| `--space-12` | `48px` | 페이지 주요 섹션 분할 여백 | `py-12`, `gap-12` |
| `--space-16` | `64px` | 랜딩 Hero 섹션 상하 여백 | `py-16` |

---

## 4. 한국어 타이포그래피 표준 (Korean Typography & Line-Break)

웹 폰트 및 한국어 텍스트 렌더링 시 발생하기 쉬운 음절 단위 절단 현상을 방지합니다.

```css
/* 한국어 표준 텍스트 유틸리티 */
.vibe-heading {
  font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif;
  word-break: keep-all;         /* 어절 단위 줄바꿈: 음절 분절 방지 */
  text-wrap: balance;           /* 제목 줄바꿈 균형 유지 */
  letter-spacing: -0.02em;      /* 한국어 자간 최적화 */
}

.vibe-body {
  font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif;
  word-break: keep-all;         /* 어절 단위 줄바꿈 */
  text-wrap: pretty;            /* text-pretty: 마지막 행 외톨이 단어(Orphan) 방지 */
  overflow-wrap: break-word;    /* 긴 URL이나 무공백 전문용어 안전 줄바꿈 */
  line-height: 1.6;
  letter-spacing: -0.01em;
}

.vibe-button-label {
  white-space: nowrap;          /* 버튼/배지 라벨의 2행 꺾임 방지 */
  line-height: 1;               /* 수직 드리프트 방지 */
}
```

---

## 5. 테두리 및 둥글기 토큰 (Borders & Radius)

```css
:root {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* 테두리 두께: 대칭 1px 및 2px 표준만 허용 */
  --border-width-standard: 1px;
  --border-width-emphasis: 2px;
}
```
