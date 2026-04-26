import Surface from "./surface";
import Ray from "../ray/ray";
import { Vector3 } from "three";
import { RETINA_EXTRA_AFTER_MM } from "../parameters/constants";
export type SphericalImageSurfaceProps = {
    type: "spherical-image";
    name: string;
    radius: number;
    z: number;
    retina_extra_after: boolean;
}

/**
 * 곡면 표현만 하고 굴절 효과는 없습니다. 
 * 망막 위치를 표현하는 데 사용됩니다.
 */
export default class SphericalImageSurface extends Surface {
    private type: string = "";
    private name: string = "";
    private radius: number = 0;
    private z: number = 0;
    private retina_extra_after: boolean = true;
    constructor(props: SphericalImageSurfaceProps) {
        super();
        const { type = "spherical-image", name, radius, z, retina_extra_after = true } = props;
        this.type = type;
        this.name = name;
        this.radius = radius;
        this.z = z;
        this.retina_extra_after = retina_extra_after;
    }
    incident(ray: Ray): Vector3 | null {
        return null;
    }
    refract(ray: Ray): Vector3 | null {  
        return null;
    }
}