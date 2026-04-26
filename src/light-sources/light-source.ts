import { Ray } from "../ray/ray.js";
import { Vector3 } from "three";

/** 프라우호퍼 c선 (빨강) */
export const CHROMATIC_RED_NM = 656.28;
export const CHROMATIC_RED_COLOR = 0xf87171;
/** 프라우호퍼 e선 (초록) */
export const CHROMATIC_GREEN_NM = 546.07;
export const CHROMATIC_GREEN_COLOR = 0x4ade80;

export class LightSource {
    private rays: Ray[];
    constructor(rays: Ray[] = []) {
        this.rays = rays.map((ray) => ray.clone());
    }

    addRay(ray: Ray) {
        this.rays.push(ray.clone());
    }

    emitRays() {
        return this.rays.map((ray) => ray.clone());
    }
}

export type GridLightSourceProps = {
    width: number;
    height: number;
    division: number;
    z: number;    
}
export class GridLightSource extends LightSource {
    constructor(rays: Ray[] = []) {
        super(rays);
    }
}


export type RadialLightSourceProps = {
    radius: number;
    division: number;
    angle_division: number;
    z: number;
}
export class RadialLightSource extends LightSource {
    constructor(rays: Ray[] = []) {
        super(rays);
    }
}