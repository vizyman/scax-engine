# scax-engine

눈 모델(Gullstrand / Navarro)에 대한 광선 추적, Sturm 간격 분석, 유발 난시·프리즘 편위 계산을 제공하는 TypeScript 안경광학 시뮬레이션(단안 기준, OD) 라이브러리입니다. ESM, CJS, UMD 빌드를 지원합니다.


English documentation: [README-en.md](README-en.md)

## SCAX란?

scax는 안경광학에서 기본적으로 쓰이는 데이터입니다. **S**는 구면렌즈 도수, **C**는 원주렌즈 도수, **AX**는 원주렌즈의 축입니다.


## 요구 사항

- **Node.js** 20 이상(로컬 개발·테스트)
- 런타임 의존성: **three** (패키지에 포함됨)


## 설치

```bash
npm install scax-engine
```

## 빠른 시작

```ts
import { SCAXEngine } from "scax-engine";

const engine = new SCAXEngine({
  eyeModel: "gullstrand",
  eye: { s: -2.0, c: -0.75, ax: 90 },
  lens: [
    {
      s: 0,
      c: -0.5,
      ax: 180,
      position: { x: 0, y: 0, z: 12 },
      tilt: { x: 0, y: 0 },
    },
  ],
  light_source: { type: "grid", width: 10, height: 10, division: 6, z: -10, vergence: 0 },
  pupil_type: "neutral",
});

const result = engine.simulate();
console.log(result.traced_rays.length);
console.log(result.info.astigmatism.combined);
console.log(result.info.prism.combined);
```

UI(슬라이더, 애니메이션 등)에서 변경마다 `new SCAXEngine`을 다시 만들지 않고 하나의 엔진 인스턴스를 재사용하려면, 전체 `props` 객체로 `update`를 호출한 뒤 `simulate`를 다시 실행하세요. `update`에서 생략된 최상위 필드는 이전 상태와 병합되지 않으며 생성자 기본값으로 채워집니다.

```ts
const engine = new SCAXEngine({ /* initial props */ });

engine.update({
  eyeModel: "gullstrand",
  eye: { s: -2.5, c: -0.75, ax: 90 },
  lens: [],
  light_source: { type: "grid", width: 10, height: 10, division: 6, z: -10, vergence: 0 },
  pupil_type: "neutral",
});

const next = engine.simulate();
```

## API

### `new SCAXEngine(props?)`

시뮬레이션 엔진 인스턴스를 생성합니다. 내부 `Sturm` 헬퍼는 인스턴스당 한 번만 생성됩니다.

#### `props`

- `eyeModel?: "gullstrand" | "navarro"` (기본값: `"gullstrand"`)
- `eye?: { s, c, ax, p?, p_ax?, tilt? }` (기본값: `{ s: 0, c: 0, ax: 0, p: 0, p_ax: 0 }`)
  - `tilt?: { x?: number; y?: number }` — 각도(도); 렌더 회전·눈 자세에 반영됩니다.
- `lens?: LensConfig[]` (기본값: `[]`)
  - `LensConfig = { s, c, ax, p?, p_ax?, position: { x, y, z }, tilt: { x, y } }`
  - `position.z`를 생략하면 안경 정간 거리(VD) 기본값 **12 mm**가 적용됩니다.
- `light_source?: LightSourceConfig`
  - Grid: `{ type: "grid", width, height, division, z, vergence, position?, tilt? }`
  - Grid (색수차): `{ type: "grid_rg", ... }` — 격자 각 점에서 Fraunhofer **e**선·**C**선 광선을 함께 생성합니다(`division`은 4보다 커야 함).
  - Radial: `{ type: "radial", radius, division, angle_division, z, vergence, position?, tilt? }`
  - 공통으로 `position`·`tilt`(도)를 두면 광원 기준 위치·기울기를 바꿀 수 있습니다.
  - 기본값: `{ type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 }`
- `pupil_type?: "constricted"(2.5 mm) | "neutral"(4.0 mm) | "dilated"(6.0 mm) | "none"(0 mm)` (기본값: `"neutral"`)
  - `"none"`이면 동공(입사 구경) 제한을 끕니다.

동일한 `props` 규칙이 `update()`에도 적용됩니다. 부분 객체만 넘기면 생략된 최상위 키는 이전 `update` 값이 아니라 **항상 기본값**으로 채워지므로, 한 필드만 바꾸려면 앱에서 전체 `props`를 조립해 넘기는 것이 안전합니다.

#### 프리즘 입력 컨벤션

- `eye.p` / `eye.p_ax`는 **교정량(처방값)** 입니다.
- `lens.p` / `lens.p_ax`도 **교정량(처방값)** 입니다.
- `p_ax`는 **임상 Base 방향**, **렌즈 쪽에서 각막을 바라보는 시점** 기준입니다.
- `simulate().info.prism.eye` 계산에서 눈 프리즘 효과는 실제 안구 편위를 표현하기 위해 내부에서 역방향으로 변환됩니다.
- 렌즈는 광선을 굴절시키는 물리 요소이므로, 광선 추적에는 입력 방향이 그대로 적용됩니다.
- 교정이 맞으면 `lens prism`과 `eye prism`이 크기·축에서 대응하고, 이때 `net_prism`은 0에 가깝습니다.

### `engine.update(props?)`

생성자와 동일한 설정 경로를 다시 실행합니다. `props`를 기준으로 eye / lens / 표면 / 광원을 재구성하며, 생략된 키에는 위 기본값이 적용됩니다.

- `Sturm` 인스턴스는 재생성되지 않지만, `update` 직후에는 Sturm 분석 캐시가 비워지며 `simulate` 등으로 다시 채워집니다.

### `engine.dispose()`

엔진 인스턴스가 잡고 있던 추적/분석 캐시와 표면 trace history를 정리합니다.

- 해제 대상: traced rays, Sturm 캐시, surface incident/refracted history
- UI에서 엔진을 자주 새로 만들 때(예: 프레임별/슬라이더 연속 갱신) 이전 인스턴스에 `dispose()`를 호출하면 메모리 사용량을 안정적으로 유지할 수 있습니다.

### 인스턴스 메서드

- `update(props?)` — 위와 동일.
- `dispose()` — 내부 캐시와 표면 trace history를 정리합니다.

- `simulate()`
  ```ts
  (): {
    traced_rays: Ray[];
    info: {
      astigmatism: {
        eye: Array<{ tabo: number; d: number }>;
        lens: Array<Array<{ tabo: number; d: number }>>;
        combined: Array<{ tabo: number; d: number }>;
      };
      prism: {
        eye: { p_x: number; p_y: number; prism_angle: number; magnitude: number | null };
        lens: { p_x: number; p_y: number; prism_angle: number; magnitude: number | null };
        combined: { p_x: number; p_y: number; prism_angle: number; magnitude: number | null };
      };
    };
  }
  ```
  - 광선 추적과 함께 난시/프리즘 요약 정보를 반환합니다.
  - `d`, `magnitude`는 0에 가까우면 `null`로 반환됩니다.

- `getEyeRotation()`
  ```ts
  (): {
    x_deg: number;
    y_deg: number;
    magnitude_deg: number;
  }
  ```
  - 처방 프리즘·`eye.tilt`를 반영한 렌더용 눈 회전량을 반환합니다.

- `rayTracing()` — 광선 추적만 수행해 추적된 `Ray[]`를 반환합니다. `simulate()`는 이를 포함해 Sturm·난시/프리즘 요약까지 한 번에 계산합니다.

- `sturmCalculation(rays?)` — 추적 광선(인자 생략 시 마지막 `rayTracing`/`simulate` 결과)으로 Sturm 슬라이스·스펙트럼선별 분석 객체를 계산해 반환합니다. `simulate()` 호출 시 내부에서 Sturm도 갱신됩니다.


## UMD

UMD 빌드는 `dist/scax-engine.umd.js`에 생성되며 전역 이름 **`ScaxEngine`**으로 노출됩니다.

## 개발

```bash
npm install
npm run build
npm test
```

### 스크립트

- `npm run clean` — `dist` 삭제
- `npm run build` — 타입 선언 및 ESM / CJS / UMD 번들 빌드
- `npm test` — Vitest 1회 실행
- `npm run test:watch` — Vitest 워치 모드

로컬에서 엔진 동작을 손으로 보려면 `test/ui-test/ui-test.html`을 브라우저에서 열 수 있습니다(빌드 산출물 경로에 맞게 스크립트를 조정해야 할 수 있음).

## 배포

```bash
npm run build
npm test
npm publish --access public
```

## 라이선스

MIT
