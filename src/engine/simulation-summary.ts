import {
  principalMeridiansFromPowers,
} from "../optics/power-vector";
import {
  prismComponentToAngleDeg,
  prismMagnitudeToAngleDeg,
  toPrismSummaryItem,
  vectorToPrismInfo,
} from "../optics/prism";
import type {
  LightDeviation,
  SCAxPower,
  SimulationResultInfo,
} from "../scax-engine";
import type { NormalizedLensConfig } from "./engine-config";

export type SimulationSummaryInput = {
  eyePower: SCAxPower;
  lensPowers: SCAxPower[];
  lensConfigs: NormalizedLensConfig[];
  eyePrismEffectVector: { x: number; y: number };
  lensPrismVector: { x: number; y: number };
};

export function buildSimulationInfo(input: SimulationSummaryInput): SimulationResultInfo {
  const lightDeviation = calculateLightDeviation(input.eyePrismEffectVector, input.lensPrismVector);
  return {
    astigmatism: {
      eye: principalMeridiansFromPowers([input.eyePower]),
      lens: principalMeridiansFromPowers(astigmatismSummaryLensPowers(input.lensConfigs)),
      combined: principalMeridiansFromPowers([
        input.eyePower,
        ...input.lensPowers,
      ]),
    },
    prism: {
      eye: toPrismSummaryItem(lightDeviation.eye_prism_effect),
      lens: toPrismSummaryItem(lightDeviation.lens_prism_total),
      combined: toPrismSummaryItem(lightDeviation.net_prism),
    },
  };
}

function astigmatismSummaryLensPowers(lensConfigs: NormalizedLensConfig[]): SCAxPower[] {
  return lensConfigs
    .filter((spec) => !spec.isXCyl)
    .map((spec) => ({
      s: spec.s,
      c: spec.c,
      ax: spec.ax,
    }));
}

function calculateLightDeviation(
  eyePrismEffectVector: { x: number; y: number },
  lensPrismVector: { x: number; y: number },
): LightDeviation {
  // eye/lens 입력은 모두 임상 Base 방향이므로, prismVectorFromBase 내부에서
  // Base -> 광선편향(+180deg) 변환이 적용됩니다.
  // eye는 "처방값(교정 필요량)"으로 해석하므로 실제 눈 편위는 역벡터입니다.
  const eyeEffect = vectorToPrismInfo(eyePrismEffectVector.x, eyePrismEffectVector.y);
  // lens 입력은 교정량이며, 렌즈는 Base 반대방향으로 광선을 실제 굴절시킵니다.
  // prismVectorFromBase에서 Base->광선편향이 이미 반영된 벡터를 그대로 합산합니다.
  const lensTotal = vectorToPrismInfo(lensPrismVector.x, lensPrismVector.y);
  const net = vectorToPrismInfo(eyeEffect.x + lensTotal.x, eyeEffect.y + lensTotal.y);
  return {
    eye_prism_effect: eyeEffect,
    lens_prism_total: lensTotal,
    net_prism: net,
    x_angle_deg: prismComponentToAngleDeg(net.x),
    y_angle_deg: prismComponentToAngleDeg(net.y),
    net_angle_deg: prismMagnitudeToAngleDeg(net.magnitude),
  };
}
