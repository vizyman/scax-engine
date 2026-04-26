import { Vector3 } from "three";
import Ray from "../ray/ray";
import Surface from "./surface";

export type AsphericalSurfaceProps = {
    type: "aspherical";
    name: string;
    x: number;
    y: number;
    z: number;
    r: number;
    r_x: number;
    n_y: number;
    conic: number;
    conic_x: number;
    conic_y: number;
    n_before: number;
    n_after: number;   
}
    
export class AsphericalSurface extends Surface {
    private type: string = "";
    private name: string = "";
    private x: number = 0;
    private y: number = 0;
    private z: number = 0;
    private r: number = 0;
    private r_x: number = 0;
    private n_y: number = 0;
    private conic: number = 0;    
    private n_before: number = 0;
    private n_after: number = 0;
    constructor(props: AsphericalSurfaceProps) {
        super();
        const { type = "aspherical", name, x, y, z, r, r_x, n_y, conic = -1.0, n_before = 1.0, n_after = 1.0 } = props;
        this.type = type;
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.r = r;
        this.r_x = r_x;
        this.n_y = n_y;
        this.conic = conic;
        this.n_before = n_before;
        this.n_after = n_after;
    }
    incident(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
    refract(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
    
}