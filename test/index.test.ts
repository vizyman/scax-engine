import { describe, expect, it } from "vitest";

import { add, divide, multiply, percentage, subtract } from "../src/index";

describe("scax-engine calculations", () => {
  it("adds numbers", () => {
    expect(add({ left: 10, right: 5 })).toBe(15);
  });

  it("subtracts numbers", () => {
    expect(subtract({ left: 10, right: 5 })).toBe(5);
  });

  it("multiplies numbers", () => {
    expect(multiply({ left: 10, right: 5 })).toBe(50);
  });

  it("divides numbers", () => {
    expect(divide({ left: 10, right: 5 })).toBe(2);
  });

  it("calculates percentage", () => {
    expect(percentage({ left: 25, right: 200 })).toBe(12.5);
  });

  it("throws on divide by zero", () => {
    expect(() => divide({ left: 10, right: 0 })).toThrowError("Cannot divide by zero.");
  });
});
