import { describe, expect, it } from "vitest";

import { FRAUNHOFER_REFRACTIVE_INDICES } from "../src/parameters/constants";
import SCAXEngine from "../src/scax-engine";
import STSurface from "../src/surfaces/st-surface";

function expectedRadiusMm(powerD: number, nBefore: number, nAfter: number) {
  return (1000 * (nAfter - nBefore)) / powerD;
}

describe("STSurface regressions", () => {
  it("cylinder가 있을 때 front/back 반경이 실제 굴절 인터페이스 기준으로 계산된다", () => {
    const st = new STSurface({
      type: "compound",
      name: "regression_st",
      position: { x: 0, y: 0, z: -12 },
      tilt: { x: 0, y: 0 },
      s: -2,
      c: -2,
      ax: 180,
      n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
      n: FRAUNHOFER_REFRACTIVE_INDICES.crown_glass,
      n_after: FRAUNHOFER_REFRACTIVE_INDICES.air,
    });

    const stAny = st as unknown as {
      front?: { r?: number };
      back?: { r_perp?: number };
    };
    const frontR = Number(stAny.front?.r);
    const backRPerp = Number(stAny.back?.r_perp);

    const nAir = FRAUNHOFER_REFRACTIVE_INDICES.air.d;
    const nGlass = FRAUNHOFER_REFRACTIVE_INDICES.crown_glass.d;

    const expectedBack = expectedRadiusMm(-2, nAir, nGlass);
    const expectedFront = expectedRadiusMm(-2, nGlass, nAir);

    expect(backRPerp).toBeCloseTo(expectedBack, 6);
    expect(frontR).toBeCloseTo(expectedFront, 6);
  });

  it("lens.position.z가 실제 렌즈 ST 표면 위치에 반영된다", () => {
    const targetZ = -6.5;
    const engine = new SCAXEngine({
      eyeModel: "navarro",
      eye: { s: 0, c: 0, ax: 0 },
      lens: [
        {
          s: -2,
          c: -2,
          ax: 180,
          position: { x: 0, y: 0, z: targetZ },
          tilt: { x: 0, y: 0 },
        },
      ],
      light_source: { type: "grid", width: 2, height: 2, division: 4, z: -20, vergence: 0 },
    });

    const lensList = (engine as unknown as { lens?: Array<{ position?: { z?: number } }> }).lens ?? [];
    expect(lensList.length).toBe(1);
    expect(Number(lensList[0]?.position?.z)).toBeCloseTo(targetZ, 9);
  });
});
