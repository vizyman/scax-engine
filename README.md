# scax-engine

광선 추적(ray tracing), Sturm 분석, 아핀 왜곡 추정, 유발 난시 계산을 위한 경량 TypeScript 광학 시뮬레이션 엔진입니다.

## Roadmap
- 근축광선일수록 정확도가 높아 집니다.
- 이 프로젝트는 단안 시각화를 지원합니다.
- 모형안 모델의 한계로 가입도(Add)는 지원 계획이 없습니다.

영문 문서는 `README-en.md`를 참고해 주세요.

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

const result: ReturnType<SCAXEngine["simulate"]> = engine.simulate();
console.log(result.traced_rays.length);
console.log(result.induced_astigmatism);
```

UI(슬라이더, 애니메이션 등)에서 변경마다 `new SCAXEngine`을 다시 만들지 않고 하나의 엔진 인스턴스를 재사용하려면, 전체 `props` 객체로 `update`를 호출한 뒤 `simulate`를 다시 실행하세요. `update`에서 생략된 최상위 필드는 이전 상태를 유지하지 않고 생성자 기본값으로 채워집니다(이전 실행과 deep merge되지 않음).

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

시뮬레이션 엔진 인스턴스를 생성합니다. 내부 `Sturm`, `Affine` 헬퍼는 인스턴스당 한 번만 생성됩니다.

#### `props`

- `eyeModel?: "gullstrand" | "navarro"` (기본값: `"gullstrand"`)
- `eye?: { s: number; c: number; ax: number; p?: number; p_ax?: number }` (기본값: `{ s: 0, c: 0, ax: 0, p: 0, p_ax: 0 }`)
- `lens?: LensConfig[]` (기본값: `[]`)
  - `LensConfig = { s, c, ax, p?: number, p_ax?: number, position: { x, y, z }, tilt: { x, y } }`
  - `position.z`를 생략하면 vertex distance 기본값 `12(mm)`가 적용됩니다.
- `light_source?: LightSourceConfig`
  - Grid: `{ type: "grid", width, height, division, z, vergence }`
  - Radial: `{ type: "radial", radius, division, angle_division, z, vergence }`
  - 기본값은 grid 소스 `{ width: 10, height: 10, division: 4, z: -10, vergence: 0 }`입니다.
- `pupil_type?: "constricted" | "neutral" | "dilated"` (기본값: `"neutral"`)

동일한 `props` 옵션이 `update()`에도 적용됩니다(아래 참고). `update`에 부분 객체만 전달하면 생략된 최상위 키는 이전 `update` 값이 아니라 생성자 기본값으로 채워집니다. 하나만 바꾸고 나머지를 유지하려면 앱 상태에서 항상 전체 `props`를 구성해 전달하세요.

#### 프리즘 입력 컨벤션

- `eye.p/p_ax`는 **교정량(처방값)** 입니다.
- `lens.p/p_ax`도 **교정량(처방값)** 입니다.
- `p_ax` 각도 기준은 **렌즈 쪽에서 각막을 바라보는 시점**입니다.
- 내부 `light_deviation` 계산에서 eye는 "실제 눈 편위"를 표현하기 위해 반대벡터(`-eye`)로 변환됩니다.
- lens는 실제 광선을 굴절시키는 물리 요소이므로, 광선 추적에는 입력 방향(`+lens`)이 그대로 적용됩니다.
- 따라서 교정 완료 조건은 `lens prism == eye prism`(크기/축 동일)이며, 이때 `net_prism`은 0에 가까워집니다.

### `engine.update(props?)`

생성자와 동일한 설정 경로를 다시 실행합니다. `props`를 기준으로 eye/lens/surfaces/light source를 재구성하며, 생략된 키에는 위 기본값이 적용됩니다. 이전 메모리 설정과 merge되지 않습니다.

- `Sturm`, `Affine` 인스턴스 자체는 **재생성되지 않지만**, `update` 이전에 캐시된 Sturm/affine 분석 결과는 다시 분석을 수행하기 전까지 초기화됩니다.

#### `props`

형태와 기본값은 위 **`new SCAXEngine(props?)`**와 동일합니다.

### 인스턴스 메서드

- `update(props?)` — 엔진 설정을 갱신합니다. 위 **`engine.update(props?)`** 참고.

- `simulate()`
  ```ts
  (): {
    traced_rays: Ray[];
    induced_astigmatism: {
      induced: { d: number; tabo_deg: number } | null;
      eye: { d: number; tabo_deg: number } | null;
      lens: { d: number; tabo_deg: number } | null;
    };
    deviation_from_baseline: {
      baseline: { x: number; y: number; z: number };
      current: { x: number; y: number; z: number };
      dx: number;
      dy: number;
      dz: number;
      magnitude_xy: number;
      magnitude_xyz: number;
    } | null;
    light_deviation: {
      eye_prism_effect: { x: number; y: number; magnitude: number; angle_deg: number };
      lens_prism_total: { x: number; y: number; magnitude: number; angle_deg: number };
      net_prism: { x: number; y: number; magnitude: number; angle_deg: number };
      x_angle_deg: number;
      y_angle_deg: number;
      net_angle_deg: number;
    };
  }
  ```
  - 광선 추적, 유발 난시, baseline 대비 편위, 빛 편위량 계산을 실행합니다.

- `getEyeRotationForRender()`
  ```ts
  (): {
    x_deg: number;
    y_deg: number;
    magnitude_deg: number;
    source_prism: { p: number; p_ax: number };
  }
  ```
  - 렌더링에서 사용할 눈 회전량(eye prism 처방 기준)을 반환합니다.

- `getSturmGapAnalysis()`
  ```ts
  (): {
    slices_info: {
      count: number;
      slices: Array<{
        z: number;
        ratio: number;
        size: number;
        profile: {
          at: { x: number; y: number; z: number };
          wMajor: number;
          wMinor: number;
          angleMajorDeg: number;
          angleMinorDeg: number;
        };
      }>;
    };
    sturm_info: Array<{
      line: "g" | "F" | "e" | "d" | "C" | "r";
      wavelength_nm: number;
      color: number | null;
      has_astigmatism: boolean;
      method: "sturm-interval-midpoint" | "minimum-ellipse";
      anterior: {
        z: number;
        ratio: number;
        size: number;
        profile: {
          at: { x: number; y: number; z: number };
          wMajor: number;
          wMinor: number;
          angleMajorDeg: number;
          angleMinorDeg: number;
        };
      } | null;
      posterior: {
        z: number;
        ratio: number;
        size: number;
        profile: {
          at: { x: number; y: number; z: number };
          wMajor: number;
          wMinor: number;
          angleMajorDeg: number;
          angleMinorDeg: number;
        };
      } | null;
      approx_center: { x: number; y: number; z: number; mode: "top2-mid" | "min-size" | "top1-flat" } | null;
    }>;
  } | null
  ```
  - 최신 Sturm 분석 결과를 반환합니다.

- `getAffineAnalysis()`
  ```ts
  (): {
    a: number; b: number; c: number; d: number; e: number; f: number;
    count: number;
    residualAvgPct: number;
    residualMaxPct: number;
    residuals: Array<{
      sx: number; sy: number; px: number; py: number; rx: number; ry: number; magnitude: number; pct: number;
    }>;
  } | null
  ```
  - 최신 affine 분석 결과를 반환합니다.


## UMD 사용

UMD 빌드는 `dist/scax-engine.umd.js`에 생성되며 전역 `ScaxEngine`으로 노출됩니다.

## 개발

```bash
npm install
npm run build
npm test
```

### 스크립트

- `npm run clean` - `dist` 삭제
- `npm run build` - ESM/CJS/UMD 번들과 타입 선언 빌드
- `npm test` - Vitest 1회 실행
- `npm run test:watch` - Vitest watch 모드 실행

## 배포

```bash
npm run build
npm test
npm publish --access public
```
