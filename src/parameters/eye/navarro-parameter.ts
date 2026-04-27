import Surface from "../../surfaces/surface";
import { AsphericalSurface } from "../../surfaces/aspherical-surface";
import SphericalImageSurface from "../../surfaces/spherical-image";
import { EyeModelParameter } from "./eyemodel-parameter";

export class NavarroParameter implements EyeModelParameter {
  createSurface(): Surface[] {
    return NavarroParameter.parameter.surfaces.map((surface) => {
      if (surface.type === "aspherical") {
        if (
          surface.conic == null
          || surface.n_before == null
          || surface.n_after == null
        ) {
          throw new Error(`Missing aspherical properties for surface: ${surface.name}`);
        }

        return new AsphericalSurface({
          type: "aspherical",
          name: surface.name,
          position: { x: 0, y: 0, z: surface.z },
          tilt: { x: 0, y: 0 },
          r: surface.radius,
          conic: surface.conic,
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

      throw new Error(`Unsupported surface type in Navarro model: ${surface.type}`);
    });
  }
  static parameter = {
    unit: "mm",
    axis: "optical_axis_z",
    surfaces: [
      {
        type: "aspherical",
        name: "cornea_anterior",
        z: 0.0,
        radius: 7.72,
        conic: -0.26,
        n_before: 1.0,
        n_after: 1.376,
      },
      {
        type: "aspherical",
        name: "cornea_posterior",
        z: 0.55,
        radius: 6.5,
        conic: 0.0,
        n_before: 1.376,
        n_after: 1.336,
      },
      {
        type: "aspherical",
        name: "lens_anterior",
        z: 0.55 + 3.05,
        radius: 10.2,
        conic: -3.13,
        n_before: 1.336,
        n_after: 1.42,
      },
      {
        type: "aspherical",
        name: "lens_posterior",
        z: 0.55 + 3.05 + 4.0,
        radius: -6.0,
        conic: -1.0,
        n_before: 1.42,
        n_after: 1.336,
      },
      {
        type: "spherical-image",
        name: "retina",
        radius: -12.0,   // mm (대략적인 망막 곡률)
        z: 24.04   // 중심 위치
      }
    ],
  };
}