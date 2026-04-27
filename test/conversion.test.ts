import { describe, expect, it } from "vitest";

import DegToTABO from "../src/utils/deg-to-tabo";
import TABOToDeg from "../src/utils/tabo-to-deg";

describe("angle conversion helpers", () => {
  it("normalizes edge and out-of-range values to [0, 180)", () => {
    const samples = [0, 180, -30, 540, 721.2];
    for (const sample of samples) {
      const deg = TABOToDeg(sample);
      const tabo = DegToTABO(sample);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(180);
      expect(tabo).toBeGreaterThanOrEqual(0);
      expect(tabo).toBeLessThan(180);
    }
  });

  it("keeps round-trip consistency within normalization rules", () => {
    const samples = [0, 12.5, 44, 90, 135, 179.999];
    for (const sample of samples) {
      const roundTrip = TABOToDeg(DegToTABO(sample));
      const normalized = ((sample % 180) + 180) % 180;
      expect(roundTrip).toBeCloseTo(normalized, 8);
    }
  });

  it("returns zero for invalid numeric inputs", () => {
    expect(DegToTABO(Number.NaN)).toBe(0);
    expect(TABOToDeg(Number.NaN)).toBe(0);
    expect(DegToTABO(Number.POSITIVE_INFINITY)).toBe(0);
    expect(TABOToDeg(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
