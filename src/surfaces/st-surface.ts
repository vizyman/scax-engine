import Surface from "./surface";
import Ray from "../ray/ray";
import { Vector3 } from "three";
export type STSurfaceProps = {
    type: "compound";
    name: string;
    x: number;
    y: number;
    z: number;
    r: number;
    s: number;
    c: number;
    ax: number;    
    n_before: number;    
    n_after: number;    
    gap: number;
}

export default class STSurface extends Surface {
    private type: string = "";
    private name: string = "";
    private x: number = 0;
    private y: number = 0;
    private z: number = 0;
    private r: number = 0;
    private s: number = 0;
    private c: number = 0;
    private ax: number = 0;
    private n_before: number = 0;
    private n_after: number = 0;
    private gap: number = 0;
    constructor(props: STSurfaceProps) {
        super();
        const { type = "compound", name, x, y, z, r, s, c, ax, n_before = 1.0, n_after = 1.0, gap = 0 } = props;
        this.type = type;
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.r = r;
    }
    incident(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
    refract(ray: Ray): Vector3 | null {
        throw new Error("Method not implemented.");
    }
}