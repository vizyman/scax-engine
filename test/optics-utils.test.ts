import { describe, expect, it } from "vitest";

import { principalMeridiansFromPowers } from "../src/optics/power-vector";
import { prismVectorFromBase, toPrismSummaryItem, vectorToPrismInfo } from "../src/optics/prism";

describe("optics utility conventions", () => {
  it("converts clinical base direction to the opposite light deviation vector", () => {
    const baseRight = prismVectorFromBase(4, 0);
    expect(baseRight.x).toBeCloseTo(-4, 10);
    expect(Math.abs(baseRight.y)).toBeLessThan(1e-10);

    const baseUp = prismVectorFromBase(4, 90);
    expect(Math.abs(baseUp.x)).toBeLessThan(1e-10);
    expect(baseUp.y).toBeGreaterThan(0);
  });

  it("summarizes near-zero prism magnitude as null", () => {
    const summary = toPrismSummaryItem(vectorToPrismInfo(0, 0));
    expect(summary.magnitude).toBeNull();
    expect(summary.prism_angle).toBe(0);
  });

  it("returns ordered principal meridians from SCAx powers", () => {
    const meridians = principalMeridiansFromPowers([{ s: -1, c: -2, ax: 180 }]);
    expect(meridians).toHaveLength(2);
    expect(meridians[0].d).toBeLessThanOrEqual(meridians[1].d);
  });
});
