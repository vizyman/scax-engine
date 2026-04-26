import Ray from "../ray/ray";
import Surface from "./surface";
import { Vector3 } from "three";
export type SphericalSurfaceProps = {
    type: "spherical";
    name: string;
    r: number;
    n_before: number;
    n_after: number;   
    x: number;
    y: number;
    z: number;
}
export default class SphericalSurface extends Surface {
    private type: string = "";
    private name: string = "";
    private r: number = 0;
    private n_before: number = 0;
    private n_after: number = 0;
    private x: number = 0;
    private y: number = 0;
    private z: number = 0;
    constructor(props: SphericalSurfaceProps) {
        super();
        const { type = "spherical", name, r, n_before = 1.0, n_after = 1.0, x, y, z } = props;
        this.type = type;
        this.name = name;
        this.r = r;
        this.n_before = n_before;
        this.n_after = n_after;
        this.x = x;
        this.y = y;
        this.z = z;
    }
    incident(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
    refract(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
}