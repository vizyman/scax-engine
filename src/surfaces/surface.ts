import Ray from "../ray/ray";
import { Vector3 } from "three";

export default abstract class Surface {
    protected incidentRays: Ray[];
    protected refractedRays: Ray[];

    constructor() {
        this.incidentRays = [];
        this.refractedRays = [];        
    }

    abstract incident(ray: Ray): Vector3 | null;

    abstract refract(ray: Ray): Vector3 | null;

    
}
