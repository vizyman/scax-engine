import Surface from "./surface";
import Ray from "../ray/ray";
import { Vector3 } from "three";

export type ParaxialSurfaceProps = {
    type: "paraxial";
    name: string;
    x: number;
    y: number;
    z: number;
    s: number;
    c: number;
    ax: number;    
    n: number;    
}
export default class ParaxialSurface extends Surface {
    private type: string = "";
    private name: string = "";
    private x: number = 0;
    private y: number = 0;
    private z: number = 0;
    private s: number = 0;
    private c: number = 0;
    private ax: number = 0;
    private n: number = 0;
    constructor(props: ParaxialSurfaceProps) {
        super();
        const { type = "paraxial", name, x, y, z, s, c, ax, n = 1.0 } = props;
        this.type = type;
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.s = s;
        this.c = c;
        this.ax = ax;
        this.n = n;
    }
    incident(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
    refract(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
}