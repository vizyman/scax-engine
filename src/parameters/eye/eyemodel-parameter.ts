import Surface from "../../surfaces/surface";
export abstract class EyeModelParameter {
  constructor() { }

  /**
   * subclass의 static parameter를 사용하여 Surface 객체를 생성합니다.
   * type: "spherical", "aspherical", "paraxial", "toric", "compound", "spherical-image"
   * class: SphericalSurface, AsphericalSurface, ParaxialSurface, ToricSurface, STSurface, SphericalImageSurface
   * @returns Surface 객체들을 반환합니다.
   */
  abstract createSurface(): Surface[];
}