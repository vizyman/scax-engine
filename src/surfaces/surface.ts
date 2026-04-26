import { Ray } from "../ray/ray";
export abstract class Surface {
    private incidentRays: Ray[];
    private refractedRays: Ray[];

    constructor() {
        this.incidentRays = [];
        this.refractedRays = [];        
    }

    abstract incident(ray: Ray): void;

    abstract refract(ray: Ray): void;

    
}
