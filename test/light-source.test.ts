import { describe, expect, it } from "vitest";

import { GridRGLightSource } from "../src/light-sources/light-source";
import { GullstrandParameter } from "../src/parameters/eye/gullstrand-parameter";
import SCAXEngine from "../src/scax-engine";

type SturmInfo = {
  line: string;
  approx_center?: { z: number } | null;
};

function extractChromaticFocusZ() {
  return extractChromaticFocusZForEye({ s: 0, c: 0, ax: 0 });
}

function extractChromaticFocusZForEye(eye: { s: number; c: number; ax: number }) {
  const simulator = new SCAXEngine({
    eyeModel: "gullstrand",
    eye,
    lens: [],
    light_source: {
      type: "grid_rg",
      width: 6,
      height: 6,
      division: 8,
      z: -20,
      vergence: 0,
    },
  });
  const rays = simulator.rayTracing();
  const result = simulator.sturmCalculation(rays) as { sturm_info?: SturmInfo[] };
  const sturmInfo = result.sturm_info ?? [];
  const green = sturmInfo.find((item) => item.line === "e");
  const red = sturmInfo.find((item) => item.line === "C");
  expect(green?.approx_center).not.toBeNull();
  expect(red?.approx_center).not.toBeNull();

  return {
    greenZ: green!.approx_center!.z,
    redZ: red!.approx_center!.z,
  };
}

describe("GridRGLightSource", () => {
  it("격자 각 점에서 녹색(e)과 적색(C) 광선을 함께 생성한다", () => {
    const source = new GridRGLightSource({
      width: 4,
      height: 4,
      division: 4,
      z: -20,
      vergence: 0,
    });
    const rays = source.emitRays();
    expect(rays).toHaveLength(4 * 4 * 2);
    const greenCount = rays.filter((ray) => ray.getFraunhoferLine() === "e").length;
    const redCount = rays.filter((ray) => ray.getFraunhoferLine() === "C").length;
    expect(greenCount).toBe(16);
    expect(redCount).toBe(16);
  });

  it("정시안에서 녹색 초점은 망막 앞, 적색 초점은 망막 뒤에 위치한다", () => {
    const retinaZ = GullstrandParameter.parameter.surfaces.find((surface) => surface.name === "retina")?.z ?? 24;
    const { greenZ, redZ } = extractChromaticFocusZ();

    expect(greenZ).toBeLessThan(retinaZ);
    expect(redZ).toBeGreaterThan(retinaZ);
  });

  it("녹색-망막 거리와 망막-적색 거리가 큰 차이 없이 유사하다", () => {
    const retinaZ = GullstrandParameter.parameter.surfaces.find((surface) => surface.name === "retina")?.z ?? 24;
    const { greenZ, redZ } = extractChromaticFocusZ();

    const frontGap = Math.abs(retinaZ - greenZ);
    const backGap = Math.abs(redZ - retinaZ);
    const larger = Math.max(frontGap, backGap);
    const smaller = Math.max(Math.min(frontGap, backGap), 1e-6);

    expect(larger / smaller).toBeLessThan(2);
  });

  it("근시에서 망막과의 거리는 적색보다 녹색이 더 가깝다", () => {
    const retinaZ = GullstrandParameter.parameter.surfaces.find((surface) => surface.name === "retina")?.z ?? 24;
    // 엔진 부호 규약상 입력 S 양수에서 근시 방향의 초점 이동이 나타납니다.
    const { greenZ, redZ } = extractChromaticFocusZForEye({ s: 6, c: 0, ax: 0 });
    const greenGap = Math.abs(retinaZ - greenZ);
    const redGap = Math.abs(retinaZ - redZ);

    expect(greenGap).toBeLessThan(redGap);
  });

  it("원시에서 망막과의 거리는 녹색보다 적색이 더 가깝다", () => {
    const retinaZ = GullstrandParameter.parameter.surfaces.find((surface) => surface.name === "retina")?.z ?? 24;
    // 엔진 부호 규약상 입력 S 음수에서 원시 방향의 초점 이동이 나타납니다.
    const { greenZ, redZ } = extractChromaticFocusZForEye({ s: -6, c: 0, ax: 0 });
    const greenGap = Math.abs(retinaZ - greenZ);
    const redGap = Math.abs(retinaZ - redZ);

    expect(redGap).toBeLessThan(greenGap);
  });
});
