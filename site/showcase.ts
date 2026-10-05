// 2.5D 인터랙티브 3D 쇼케이스 및 다양한 실무 사례 로직

interface MapItem {
  k: string;
  x: number;
  y: number;
  w?: number;
  d?: number;
  v?: number;
  c?: string;
  state?: string;
}

interface MapData {
  floor: { w: number; d: number };
  items: MapItem[];
}

interface LayerItem {
  k: string;
  v: number;
  c?: string;
}

interface Layer {
  k: string;
  items: LayerItem[];
}

interface CityBuilding {
  k: string;
  size: number;
  v: number;
  c?: string;
}

interface CityDistrict {
  k: string;
  children: CityBuilding[];
}

interface CityData {
  k: string;
  children: CityDistrict[];
}

type Tag = "iso-bars" | "iso-stack" | "iso-heatmap" | "iso-ledger" | "iso-kpi" | "iso-map" | "iso-layers" | "iso-city";

interface AxisInfo {
  x: { name: string; desc: string };
  y: { name: string; desc: string };
  z: { name: string; desc: string };
}

interface LabItem {
  tag: Tag;
  label: string;
  axis: AxisInfo;
  defaultData: any;
  defaultAttrs?: Record<string, string>;
  getSliders: (data: any, update: () => void) => HTMLElement[];
}

// ----------------------------------------------------
// 1. 3D 실험실(Lab) 정의
// ----------------------------------------------------
const LAB_ITEMS: Record<Tag, LabItem> = {
  "iso-bars": {
    tag: "iso-bars",
    label: "시스템 서비스별 메모리 점유율 (MB)",
    axis: {
      x: { name: "서비스 항목 (Category)", desc: "아이소메트릭 X축 (우하향 배치, 라벨 비가림)" },
      y: { name: "배치 순서 (Sequence)", desc: "Y축 방향 1열 선형 정렬" },
      z: { name: "메모리 점유량 (Value, MB)", desc: "수직 높이 (블록 높이 --iso-h 에 반영)" },
    },
    defaultAttrs: { max: "500", "height-units": "4", unit: "20" },
    defaultData: [
      { k: "웹서버", v: 320 },
      { k: "데이터베이스", v: 460 },
      { k: "캐시노드", v: 210 },
      { k: "메시지큐", v: 140 },
    ],
    getSliders: (data, update) => {
      return data.map((item: { k: string; v: number }) => {
        const box = document.createElement("div");
        box.className = "slider-box";
        box.innerHTML = `
          <div class="slider-header">
            <span><strong>${item.k}</strong> (Z축 높이)</span>
            <span class="slider-val">${item.v} MB</span>
          </div>
          <input type="range" min="20" max="500" step="10" value="${item.v}">
        `;
        const input = box.querySelector("input")!;
        const valSpan = box.querySelector(".slider-val")!;
        input.addEventListener("input", () => {
          item.v = Number(input.value);
          valSpan.textContent = `${item.v} MB`;
          update();
        });
        return box;
      });
    },
  },
  "iso-stack": {
    tag: "iso-stack",
    label: "분기별 클라우드 비용 구성 (만원)",
    axis: {
      x: { name: "분기 (Quarter)", desc: "X축 방향으로 분기별 적층 기둥 나열" },
      y: { name: "기준열 (Baseline)", desc: "1열 정렬" },
      z: { name: "부문별 누적 비용 (Stacked Value)", desc: "연산(Compute) + 스토리지(Storage) 누적 적층" },
    },
    defaultAttrs: { max: "100", "height-units": "4", unit: "20" },
    defaultData: [
      { k: "1분기", parts: [{ name: "연산", v: 45 }, { name: "스토리지", v: 30 }] },
      { k: "2분기", parts: [{ name: "연산", v: 35 }, { name: "스토리지", v: 45 }] },
      { k: "3분기", parts: [{ name: "연산", v: 60 }, { name: "스토리지", v: 25 }] },
    ],
    getSliders: (data, update) => {
      const elements: HTMLElement[] = [];
      data.forEach((q: { k: string; parts: Array<{ name: string; v: number }> }) => {
        q.parts.forEach((p) => {
          const box = document.createElement("div");
          box.className = "slider-box";
          box.innerHTML = `
            <div class="slider-header">
              <span><strong>${q.k} ${p.name}</strong></span>
              <span class="slider-val">${p.v} 만원</span>
            </div>
            <input type="range" min="5" max="60" step="5" value="${p.v}">
          `;
          const input = box.querySelector("input")!;
          const valSpan = box.querySelector(".slider-val")!;
          input.addEventListener("input", () => {
            p.v = Number(input.value);
            valSpan.textContent = `${p.v} 만원`;
            update();
          });
          elements.push(box);
        });
      });
      return elements;
    },
  },
  "iso-heatmap": {
    tag: "iso-heatmap",
    label: "요일·시간대별 네트워크 트래픽 (Gbps)",
    axis: {
      x: { name: "시간대 (Hour)", desc: "X축 그리드 열 (09시, 13시, 17시, 21시)" },
      y: { name: "요일 (Day)", desc: "Y축 그리드 행 (월, 화, 수, 목)" },
      z: { name: "트래픽 대역폭 (Traffic)", desc: "블록 높이 및 색상 채도 (OKLCH 단계별 명도 매핑)" },
    },
    defaultAttrs: { max: "100", "height-units": "3", unit: "18" },
    defaultData: {
      rows: ["월", "화", "수", "목"],
      cols: ["09시", "13시", "17시", "21시"],
      values: [
        [35, 75, 90, 45],
        [40, 80, 85, 50],
        [30, 65, 95, 60],
        [45, 90, 70, 40],
      ],
    },
    getSliders: (data, update) => {
      const elements: HTMLElement[] = [];
      // 대표 행 2개에 대한 조절 슬라이더
      const presets = [
        { label: "월요일 피크 (17시)", r: 0, c: 2 },
        { label: "수요일 피크 (17시)", r: 2, c: 2 },
        { label: "목요일 점심 (13시)", r: 3, c: 1 },
      ];
      presets.forEach(({ label, r, c }) => {
        const box = document.createElement("div");
        box.className = "slider-box";
        box.innerHTML = `
          <div class="slider-header">
            <span><strong>${label}</strong></span>
            <span class="slider-val">${data.values[r][c]} Gbps</span>
          </div>
          <input type="range" min="10" max="100" step="5" value="${data.values[r][c]}">
        `;
        const input = box.querySelector("input")!;
        const valSpan = box.querySelector(".slider-val")!;
        input.addEventListener("input", () => {
          data.values[r][c] = Number(input.value);
          valSpan.textContent = `${data.values[r][c]} Gbps`;
          update();
        });
        elements.push(box);
      });
      return elements;
    },
  },
  "iso-ledger": {
    tag: "iso-ledger",
    label: "마일스톤 배포 파이프라인 진행 상태",
    axis: {
      x: { name: "배포 단계 (Step)", desc: "왼쪽에서 오른쪽으로 흐르는 릴리스 시퀀스" },
      y: { name: "릴리스 트랙 (Track)", desc: "단일 릴리스 레인" },
      z: { name: "빌드 및 배포 완료율 (Height)", desc: "블록 상단 높이 및 연결 노드" },
    },
    defaultAttrs: {},
    defaultData: [
      { k: "v1.0", note: "기반 아키텍처 수립" },
      { k: "v1.1", note: "실시간 대시보드 연동" },
      { k: "v1.2", note: "성능 및 접근성 최적화" },
      { k: "v2.0", note: "글로벌 멀티리전 배포" },
    ],
    getSliders: (_data, _update) => {
      return [];
    },
  },
  "iso-kpi": {
    tag: "iso-kpi",
    label: "실시간 GPU 클러스터 가동률",
    axis: {
      x: { name: "가로 폭 (Width)", desc: "단일 KPI 블록의 폭" },
      y: { name: "깊이 (Depth)", desc: "단일 KPI 블록의 깊이" },
      z: { name: "달성도 / 측정값 (Value %)", desc: "전체 게이지 용량(max) 대비 채워진 수직 높이" },
    },
    defaultAttrs: { max: "100", value: "82", suffix: "%", unit: "32" },
    defaultData: {},
    getSliders: (_data, update) => {
      const box = document.createElement("div");
      box.className = "slider-box";
      box.innerHTML = `
        <div class="slider-header">
          <span><strong>가동률 수치 (Z축 높이)</strong></span>
          <span class="slider-val">82%</span>
        </div>
        <input type="range" min="0" max="100" step="1" value="82">
      `;
      const input = box.querySelector("input")!;
      const valSpan = box.querySelector(".slider-val")!;
      input.addEventListener("input", () => {
        valSpan.textContent = `${input.value}%`;
        const chart = document.getElementById("lab-chart")!;
        chart.setAttribute("value", input.value);
        update();
      });
      return [box];
    },
  },
  "iso-map": {
    tag: "iso-map",
    label: "스마트 팩토리 구역별 설비 가동도",
    axis: {
      x: { name: "작업장 가로 좌표 (X w)", desc: "팩토리 바닥면 X축 위치 및 설비 폭" },
      y: { name: "작업장 세로 깊이 (Y d)", desc: "팩토리 바닥면 Y축 위치 및 설비 깊이" },
      z: { name: "설비 부하 지수 (Height v)", desc: "가동률 또는 센서 측정 부하치" },
    },
    defaultAttrs: { unit: "20" },
    defaultData: {
      floor: { w: 9, d: 7 },
      items: [
        { k: "중앙제어대", x: 3, y: 0.5, w: 3, d: 1 },
        { k: "CNC-1호기", x: 1, y: 2.5, w: 1.5, d: 1.5, v: 4 },
        { k: "CNC-2호기", x: 3.5, y: 2.5, w: 1.5, d: 1.5, v: 7 },
        { k: "조립로봇", x: 6, y: 2.5, w: 2, d: 1.5, v: 9 },
        { k: "검사라인", x: 2, y: 4.8, w: 5, d: 1.2, v: 3 },
      ],
    } as MapData,
    getSliders: (data: MapData, update) => {
      const elements: HTMLElement[] = [];
      data.items.filter((it: MapItem) => it.v !== undefined).forEach((item: MapItem) => {
        const box = document.createElement("div");
        box.className = "slider-box";
        box.innerHTML = `
          <div class="slider-header">
            <span><strong>${item.k}</strong> (높이 v)</span>
            <span class="slider-val">${item.v}</span>
          </div>
          <input type="range" min="1" max="10" step="1" value="${item.v}">
        `;
        const input = box.querySelector("input")!;
        const valSpan = box.querySelector(".slider-val")!;
        input.addEventListener("input", () => {
          item.v = Number(input.value);
          valSpan.textContent = String(item.v);
          update();
        });
        elements.push(box);
      });
      return elements;
    },
  },
  "iso-layers": {
    tag: "iso-layers",
    label: "스마트 캠퍼스 층별 전력 사용 현황",
    axis: {
      x: { name: "층내 항목 배치 (Category)", desc: "층 판 위 좌우로 정렬된 세부 공간" },
      y: { name: "층 판 깊이 (Depth)", desc: "등각 투영 층 판의 깊이" },
      z: { name: "층수(Layer) & 돌출 높이 (v)", desc: "바닥판 적층 Z축 + 전력 소비량 돌출 높이" },
    },
    defaultAttrs: { open: "1", unit: "20" },
    defaultData: [
      {
        k: "1F 로비",
        items: [
          { k: "카페테리아", v: 25 },
          { k: "안내데스크", v: 15 },
        ],
      },
      {
        k: "2F 연구실",
        items: [
          { k: "SW연구랩", v: 60 },
          { k: "서버룸", v: 85 },
        ],
      },
      {
        k: "3F 기획실",
        items: [
          { k: "대회의실", v: 45 },
          { k: "임원실", v: 30 },
        ],
      },
    ] as Layer[],
    getSliders: (data: Layer[], update) => {
      // 1. 펼칠 층 선택 (open 속성 0, 1, 2)
      const openBox = document.createElement("div");
      openBox.className = "slider-box";
      openBox.innerHTML = `
        <div class="slider-header">
          <span><strong>펼칠 층 선택 (open 속성)</strong></span>
          <span class="slider-val">2F 연구실 (1)</span>
        </div>
        <input type="range" min="0" max="2" step="1" value="1">
      `;
      const openInput = openBox.querySelector("input")!;
      const openVal = openBox.querySelector(".slider-val")!;
      const names = ["1F 로비 (0)", "2F 연구실 (1)", "3F 기획실 (2)"];
      openInput.addEventListener("input", () => {
        const idx = Number(openInput.value);
        openVal.textContent = names[idx];
        const chart = document.getElementById("lab-chart")!;
        chart.setAttribute("open", String(idx));
        update();
      });

      // 2. 서버룸 전력량 슬라이더
      const serverBox = document.createElement("div");
      serverBox.className = "slider-box";
      const serverItem = data[1].items[1];
      serverBox.innerHTML = `
        <div class="slider-header">
          <span><strong>2F 서버룸 부하 (높이 v)</strong></span>
          <span class="slider-val">${serverItem.v}</span>
        </div>
        <input type="range" min="10" max="100" step="5" value="${serverItem.v}">
      `;
      const serverInput = serverBox.querySelector("input")!;
      const serverVal = serverBox.querySelector(".slider-val")!;
      serverInput.addEventListener("input", () => {
        serverItem.v = Number(serverInput.value);
        serverVal.textContent = String(serverItem.v);
        update();
      });

      return [openBox, serverBox];
    },
  },
  "iso-city": {
    tag: "iso-city",
    label: "마이크로서비스 클러스터 메트릭 시티",
    axis: {
      x: { name: "도메인 구역 트리맵 (District)", desc: "도메인별 구역(District) 및 건물 가로 배치" },
      y: { name: "건물 밑면 넓이 (size, RPS)", desc: "초당 트래픽/요청수 비례 바닥 면적" },
      z: { name: "서비스 지연시간 (Latency v, ms)", desc: "건물 높이 = P99 응답 지연시간" },
    },
    defaultAttrs: { unit: "20" },
    defaultData: {
      k: "MSA 클러스터",
      children: [
        {
          k: "인증·게이트웨이",
          children: [
            { k: "Auth API", size: 20, v: 4 },
            { k: "Gateway", size: 30, v: 7 },
          ],
        },
        {
          k: "상거래 코어",
          children: [
            { k: "Order", size: 25, v: 5 },
            { k: "Payment", size: 28, v: 9 },
          ],
        },
      ],
    } as CityData,
    getSliders: (data: CityData, update) => {
      const elements: HTMLElement[] = [];
      data.children.forEach((dist: CityDistrict) => {
        dist.children.forEach((b: CityBuilding) => {
          const box = document.createElement("div");
          box.className = "slider-box";
          box.innerHTML = `
            <div class="slider-header">
              <span><strong>${b.k}</strong> (높이 v)</span>
              <span class="slider-val">${b.v}</span>
            </div>
            <input type="range" min="1" max="15" step="1" value="${b.v}">
          `;
          const input = box.querySelector("input")!;
          const valSpan = box.querySelector(".slider-val")!;
          input.addEventListener("input", () => {
            b.v = Number(input.value);
            valSpan.textContent = String(b.v);
            update();
          });
          elements.push(box);
        });
      });
      return elements;
    },
  },
};

// ----------------------------------------------------
// 2. 실험실(Lab) 탭 전환 및 렌더링
// ----------------------------------------------------
let currentTag: Tag = "iso-bars";
let currentData: any = JSON.parse(JSON.stringify(LAB_ITEMS[currentTag].defaultData));

function renderLab() {
  const item = LAB_ITEMS[currentTag];
  const chartContainer = document.getElementById("lab-chart-container")!;
  const sliderContainer = document.getElementById("lab-sliders")!;
  
  // 축 정보 패널 갱신
  document.getElementById("axis-x-name")!.textContent = item.axis.x.name;
  document.getElementById("axis-x-desc")!.textContent = item.axis.x.desc;
  document.getElementById("axis-y-name")!.textContent = item.axis.y.name;
  document.getElementById("axis-y-desc")!.textContent = item.axis.y.desc;
  document.getElementById("axis-z-name")!.textContent = item.axis.z.name;
  document.getElementById("axis-z-desc")!.textContent = item.axis.z.desc;

  // 차트 엘리먼트 생성
  chartContainer.innerHTML = "";
  const el = document.createElement(item.tag);
  el.id = "lab-chart";
  el.setAttribute("label", item.label);
  
  if (item.defaultAttrs) {
    for (const [k, v] of Object.entries(item.defaultAttrs)) {
      el.setAttribute(k, v);
    }
  }

  if (item.tag !== "iso-kpi") {
    el.setAttribute("data", JSON.stringify(currentData));
  }
  chartContainer.appendChild(el);

  // 슬라이더 패널 생성
  sliderContainer.innerHTML = "";
  const updateChart = () => {
    if (item.tag !== "iso-kpi") {
      el.setAttribute("data", JSON.stringify(currentData));
    }
  };

  const sliders = item.getSliders(currentData, updateChart);
  if (sliders.length > 0) {
    sliders.forEach(s => sliderContainer.appendChild(s));
  } else {
    sliderContainer.innerHTML = `<p class="muted" style="grid-column: 1/-1;">해당 엘리먼트는 정적 단계 연결 컴포넌트입니다.</p>`;
  }
}

// ----------------------------------------------------
// 3. 산업별 실무 사례 시뮬레이션 인터랙션
// ----------------------------------------------------

// 사례 1: 데이터센터 서버 랙 열화 모니터링 (Heatmap)
function initCase1ServerRacks() {
  const chart = document.getElementById("case1-chart");
  if (!chart) return;

  const normalValues = [
    [32, 35, 34, 38, 36, 40],
    [36, 38, 42, 39, 41, 44],
    [38, 41, 45, 43, 46, 48],
    [35, 39, 40, 42, 39, 41],
    [33, 36, 37, 39, 38, 40],
    [31, 33, 35, 36, 35, 37],
  ];

  const peakValues = [
    [65, 72, 78, 82, 79, 85],
    [70, 84, 88, 86, 91, 94],
    [75, 89, 95, 92, 96, 98],
    [68, 79, 85, 87, 84, 88],
    [62, 71, 75, 80, 78, 81],
    [58, 65, 70, 74, 71, 76],
  ];

  const failureValues = [
    [35, 40, 42, 39, 41, 43],
    [40, 45, 99, 99, 48, 46],
    [42, 48, 99, 99, 52, 49],
    [38, 42, 46, 45, 43, 44],
    [34, 38, 39, 41, 40, 42],
    [32, 35, 36, 37, 36, 38],
  ];

  const updateHeatmap = (values: number[][]) => {
    const data = {
      rows: ["Rack-A", "Rack-B", "Rack-C", "Rack-D", "Rack-E", "Rack-F"],
      cols: ["1U", "2U", "3U", "4U", "5U", "6U"],
      values,
    };
    chart.setAttribute("data", JSON.stringify(data));
  };

  document.getElementById("btn-case1-normal")?.addEventListener("click", () => {
    updateHeatmap(normalValues);
  });
  document.getElementById("btn-case1-peak")?.addEventListener("click", () => {
    updateHeatmap(peakValues);
  });
  document.getElementById("btn-case1-fail")?.addEventListener("click", () => {
    updateHeatmap(failureValues);
  });
}

// 사례 2: 스마트 물류창고 입체 파레트 적재 현황 (Map)
function initCase2Warehouse() {
  const chart = document.getElementById("case2-chart");
  if (!chart) return;

  const warehouseData: MapData = {
    floor: { w: 9, d: 7 },
    items: [
      { k: "출고도크", x: 0.5, y: 0.5, w: 2.5, d: 1 },
      { k: "중앙통로", x: 3.5, y: 0.5, w: 2, d: 5.8 },
      { k: "A-01", x: 0.6, y: 2.2, w: 1.2, d: 1.2, v: 3 },
      { k: "A-02", x: 2.0, y: 2.2, w: 1.2, d: 1.2, v: 5 },
      { k: "A-03", x: 0.6, y: 3.8, w: 1.2, d: 1.2, v: 2 },
      { k: "A-04", x: 2.0, y: 3.8, w: 1.2, d: 1.2, v: 4 },
      { k: "B-01", x: 5.8, y: 2.2, w: 1.2, d: 1.2, v: 4 },
      { k: "B-02", x: 7.2, y: 2.2, w: 1.2, d: 1.2, v: 1 },
      { k: "B-03", x: 5.8, y: 3.8, w: 1.2, d: 1.2, v: 5 },
      { k: "B-04", x: 7.2, y: 3.8, w: 1.2, d: 1.2, v: 3 },
    ],
  };

  const update = () => {
    chart.setAttribute("data", JSON.stringify(warehouseData));
  };

  document.getElementById("btn-case2-in")?.addEventListener("click", () => {
    // A-01 1단 추가
    const target = warehouseData.items.find((i: MapItem) => i.k === "A-01");
    if (target && target.v !== undefined && target.v < 7) {
      target.v += 1;
      update();
    }
  });

  document.getElementById("btn-case2-out")?.addEventListener("click", () => {
    // A-01 1단 출고
    const target = warehouseData.items.find((i: MapItem) => i.k === "A-01");
    if (target && target.v !== undefined && target.v > 0) {
      target.v -= 1;
      update();
    }
  });
}

// 사례 3: 친환경 스마트 오피스 빌딩 층별 에너지 소비 (Layers)
function initCase3Building() {
  const chart = document.getElementById("case3-chart");
  const openSlider = document.getElementById("case3-open-slider") as HTMLInputElement;
  const openVal = document.getElementById("case3-open-val");
  if (!chart || !openSlider) return;

  const layerNames = ["1F 로비·카페 (0)", "2F 업무공간 A (1)", "3F 업무공간 B (2)"];

  openSlider.addEventListener("input", () => {
    const val = openSlider.value;
    const idx = Number(val);
    if (openVal) openVal.textContent = layerNames[idx] || val;
    chart.setAttribute("open", val);
  });

  document.getElementById("btn-case3-eco")?.addEventListener("click", () => {
    const ecoData: Layer[] = [
      {
        k: "1F 로비·카페",
        items: [
          { k: "안내데스크", v: 15 },
          { k: "라운지", v: 25 },
          { k: "카페테리아", v: 30 },
        ],
      },
      {
        k: "2F 업무공간 A",
        items: [
          { k: "사무실 201", v: 35 },
          { k: "회의실 202", v: 20 },
          { k: "연구개발랩", v: 50 },
        ],
      },
      {
        k: "3F 업무공간 B",
        items: [
          { k: "기획팀", v: 30 },
          { k: "디자인팀", v: 45 },
          { k: "서버룸", v: 60 },
        ],
      },
    ];
    chart.setAttribute("data", JSON.stringify(ecoData));
  });

  document.getElementById("btn-case3-peak")?.addEventListener("click", () => {
    const peakData: Layer[] = [
      {
        k: "1F 로비·카페",
        items: [
          { k: "안내데스크", v: 35 },
          { k: "라운지", v: 55 },
          { k: "카페테리아", v: 70 },
        ],
      },
      {
        k: "2F 업무공간 A",
        items: [
          { k: "사무실 201", v: 80 },
          { k: "회의실 202", v: 65 },
          { k: "연구개발랩", v: 95 },
        ],
      },
      {
        k: "3F 업무공간 B",
        items: [
          { k: "기획팀", v: 75 },
          { k: "디자인팀", v: 85 },
          { k: "서버룸", v: 100 },
        ],
      },
    ];
    chart.setAttribute("data", JSON.stringify(peakData));
  });
}

// 사례 4: 마이크로서비스(MSA) 트래픽 시티 (City)
function initCase4Microservices() {
  const chart = document.getElementById("case4-chart");
  if (!chart) return;

  const defaultCity: CityData = {
    k: "MSA 시스템",
    children: [
      {
        k: "인증 & 게이트웨이",
        children: [
          { k: "Auth API", size: 20, v: 4 },
          { k: "Gateway", size: 30, v: 6 },
        ],
      },
      {
        k: "상거래 코어",
        children: [
          { k: "Order", size: 25, v: 5 },
          { k: "Payment", size: 28, v: 7 },
          { k: "Catalog", size: 22, v: 4 },
        ],
      },
      {
        k: "지원 서비스",
        children: [
          { k: "Notification", size: 18, v: 2 },
          { k: "Analytics", size: 24, v: 5 },
        ],
      },
    ],
  };

  const peakCity: CityData = {
    k: "MSA 시스템",
    children: [
      {
        k: "인증 & 게이트웨이",
        children: [
          { k: "Auth API", size: 28, v: 8 },
          { k: "Gateway", size: 45, v: 11 },
        ],
      },
      {
        k: "상거래 코어",
        children: [
          { k: "Order", size: 35, v: 9 },
          { k: "Payment (장애 위험)", size: 48, v: 16, c: "#b42335" },
          { k: "Catalog", size: 28, v: 7 },
        ],
      },
      {
        k: "지원 서비스",
        children: [
          { k: "Notification", size: 25, v: 6 },
          { k: "Analytics", size: 32, v: 10 },
        ],
      },
    ],
  };

  document.getElementById("btn-case4-normal")?.addEventListener("click", () => {
    chart.setAttribute("data", JSON.stringify(defaultCity));
  });

  document.getElementById("btn-case4-spike")?.addEventListener("click", () => {
    chart.setAttribute("data", JSON.stringify(peakCity));
  });
}

// ----------------------------------------------------
// 메인 초기화 (DOMContentLoaded 또는 즉시 실행 안전 보장)
// ----------------------------------------------------
function init() {
  // 1. 실험실 탭 이벤트 바인딩
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".lab-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag as Tag;
      if (!tag || !LAB_ITEMS[tag]) return;
      currentTag = tag;
      currentData = JSON.parse(JSON.stringify(LAB_ITEMS[tag].defaultData));
      tabButtons.forEach(b => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        b.classList.toggle("active", b === btn);
      });
      renderLab();
    });
  });

  renderLab();

  // 2. 실무 사례들 초기화
  initCase1ServerRacks();
  initCase2Warehouse();
  initCase3Building();
  initCase4Microservices();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
