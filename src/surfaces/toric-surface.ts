import { Vector3 } from "three";
import Ray from "../ray/ray";
import Surface from "./surface";

export type ToricSurfaceProps = {
    type: "toric";
    name: string;
    x: number;
    y: number;
    z: number;
    r_axis: number;
    r_perp: number;
    n_before: number;
    n_after: number;   
}
export default class ToricSurface extends Surface {
    private type: string = "";
    private name: string = "";
    private x: number = 0;
    private y: number = 0;
    private z: number = 0;
    private r_axis: number = 0;
    private r_perp: number = 0;
    private n_before: number = 0;
    private n_after: number = 0;

    constructor(props: ToricSurfaceProps) {
        super();
        const { type = "toric", name, x, y, z, r_axis, r_perp, n_before = 1.0, n_after = 1.0 } = props;
        this.type = type;
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.r_axis = r_axis;
        this.r_perp = r_perp;
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
