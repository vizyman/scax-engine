import { SPECTACLE_VERTEX_DISTANCE_MM } from "../parameters/constants";
import { normalizeAngle360, normalizePrismAmount } from "../optics/prism";
import type {
  EyeConfig,
  EyeModel,
  LensConfig,
  LightSourceConfig,
  PupilType,
  SCAXEngineProps,
} from "../scax-engine";

export type NormalizedEyeConfig = {
  s: number;
  c: number;
  ax: number;
  p: number;
  p_ax: number;
  tilt: { x: number; y: number };
};

export type NormalizedLensConfig = Required<Omit<LensConfig, "isXCyl">> & {
  isXCyl: boolean;
};

export type NormalizedEngineConfig = {
  eyeModel: EyeModel;
  eye: NormalizedEyeConfig;
  lens: NormalizedLensConfig[];
  light_source: LightSourceConfig & {
    position: { x: number; y: number; z: number };
    tilt: { x: number; y: number };
  };
  pupil_type: PupilType;
};

export function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeEyeTilt(value: EyeConfig["tilt"]) {
  return {
    x: toFiniteNumber(value?.x),
    y: toFiniteNumber(value?.y),
  };
}

export function normalizeLightSourcePose(value: LightSourceConfig) {
  return {
    position: {
      x: toFiniteNumber(value?.position?.x),
      y: toFiniteNumber(value?.position?.y),
      z: toFiniteNumber(value?.position?.z),
    },
    tilt: {
      x: toFiniteNumber(value?.tilt?.x),
      y: toFiniteNumber(value?.tilt?.y),
    },
  };
}

export function normalizeEngineProps(props: SCAXEngineProps = {}): NormalizedEngineConfig {
  const {
    eyeModel = "gullstrand",
    eye = { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
    lens = [],
    light_source = { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
    pupil_type = "neutral",
  } = props;
  const normalizedLightSourcePose = normalizeLightSourcePose(light_source);

  return {
    eyeModel,
    eye: {
      s: toFiniteNumber(eye?.s),
      c: toFiniteNumber(eye?.c),
      ax: toFiniteNumber(eye?.ax),
      p: normalizePrismAmount(eye?.p),
      p_ax: normalizeAngle360(eye?.p_ax),
      tilt: normalizeEyeTilt(eye?.tilt),
    },
    lens: (Array.isArray(lens) ? lens : []).map((spec) => ({
      s: toFiniteNumber(spec?.s),
      c: toFiniteNumber(spec?.c),
      ax: toFiniteNumber(spec?.ax),
      p: normalizePrismAmount(spec?.p),
      p_ax: normalizeAngle360(spec?.p_ax),
      position: {
        x: toFiniteNumber(spec?.position?.x),
        y: toFiniteNumber(spec?.position?.y),
        z: toFiniteNumber(spec?.position?.z, SPECTACLE_VERTEX_DISTANCE_MM),
      },
      tilt: {
        x: toFiniteNumber(spec?.tilt?.x),
        y: toFiniteNumber(spec?.tilt?.y),
      },
      isXCyl: spec?.isXCyl === true,
    })),
    light_source: {
      ...light_source,
      position: { ...normalizedLightSourcePose.position },
      tilt: { ...normalizedLightSourcePose.tilt },
    } as NormalizedEngineConfig["light_source"],
    pupil_type,
  };
}
