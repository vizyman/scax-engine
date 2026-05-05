import { EyeModelParameter, EyeModelParameterConfig } from "./eyemodel-parameter";
import { FRAUNHOFER_REFRACTIVE_INDICES } from "../constants";

export class GullstrandParameter extends EyeModelParameter {
  static parameter: EyeModelParameterConfig = {
    unit: "mm",
    axis: "optical_axis_z",
    origin: "cornea_anterior_vertex",
    surfaces: [
      {
        type: "spherical",
        name: "cornea_anterior",
        z: 0.0,
        radius: 7.7,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.cornea,
      },
      {
        type: "spherical",
        name: "cornea_posterior",
        z: 0.5,
        radius: 6.8,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.cornea,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.aqueous,
      },
      {
        type: "spherical",
        name: "lens_anterior",
        z: 3.6,
        radius: 10.0,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.aqueous,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.lens_anterior,
      },
      {
        type: "spherical",
        name: "lens_nucleus_anterior",
        z: 4.146,
        radius: 7.911,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.lens_anterior,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.lens_nucleus_anterior,
      },
      {
        type: "spherical",
        name: "lens_nucleus_posterior",
        z: 6.565,
        radius: -5.76,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.lens_nucleus_anterior,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.lens_nucleus_posterior,
      },
      {
        type: "spherical",
        name: "lens_posterior",
        z: 7.2,
        radius: -6.0,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.lens_nucleus_posterior,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.vitreous,
      },
      {
        type: "spherical-image",
        name: "retina",
        radius: -12.0,   // mm (대략적인 망막 곡률)
        z: 24.0   // 중심 위치
      }
    ],
  };
  constructor() {
    super(GullstrandParameter.parameter);
  }
}

