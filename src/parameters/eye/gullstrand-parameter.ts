import Surface from "../../surfaces/surface";
import SphericalSurface from "../../surfaces/spherical-surface";
import SphericalImageSurface from "../../surfaces/spherical-image";
import { EyeModelParameter } from "./eyemodel-parameter";

export class GullstrandParameter implements EyeModelParameter {
  static parameter = {
    unit: "mm",
    axis: "optical_axis_z",
    origin: "cornea_anterior_vertex",
    surfaces: [
      {
        type: "spherical",
        name: "cornea_anterior",
        z: 0.0,
        radius: 7.7,
        n_before: 1.0,
        n_after: 1.376,
      },
      {
        type: "spherical",
        name: "cornea_posterior",
        z: 0.5,
        radius: 6.8,
        n_before: 1.376,
        n_after: 1.336,
      },
      {
        type: "spherical",
        name: "lens_anterior",
        z: 3.6,
        radius: 10.0,
        n_before: 1.336,
        n_after: 1.386,
      },
      {
        type: "spherical",
        name: "lens_nucleus_anterior",
        z: 4.146,
        radius: 7.911,
        n_before: 1.386,
        n_after: 1.406,
      },
      {
        type: "spherical",
        name: "lens_nucleus_posterior",
        z: 6.565,
        radius: -5.76,
        n_before: 1.406,
        n_after: 1.386,
      },
      {
        type: "spherical",
        name: "lens_posterior",
        z: 7.2,
        radius: -6.0,
        n_before: 1.386,
        n_after: 1.336,
      },
      {
        type: "spherical-image",
        name: "retina",
        radius: -12.0,   // mm (대략적인 망막 곡률)
        z: 24.0   // 중심 위치
      }
    ],
  };
  constructor() { }
  createSurface(): Surface[] {
    return GullstrandParameter.parameter.surfaces.map((surface) => {
      if (surface.type === "spherical") {
        if (surface.n_before == null || surface.n_after == null) {
          throw new Error(`Missing refractive indices for surface: ${surface.name}`);
        }

        return new SphericalSurface({
          type: "spherical",
          name: surface.name,
          r: surface.radius,
          position: { x: 0, y: 0, z: surface.z },
          tilt: { x: 0, y: 0 },
          n_before: surface.n_before,
          n_after: surface.n_after,
        });
      }

      if (surface.type === "spherical-image") {
        return new SphericalImageSurface({
          type: "spherical-image",
          name: surface.name,
          radius: surface.radius,
          position: { x: 0, y: 0, z: surface.z },
          tilt: { x: 0, y: 0 },
          retina_extra_after: true,
        });
      }

      throw new Error(`Unsupported surface type in Gullstrand model: ${surface.type}`);
    });
  }


}

