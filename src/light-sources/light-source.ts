import Ray from "../ray/ray.js";
import { Vector3 } from "three";

/** 프라우호퍼 c선 (빨강) */
export const CHROMATIC_RED_NM = 656.28;
export const CHROMATIC_RED_COLOR = 0xf87171;
/** 프라우호퍼 e선 (초록) */
export const CHROMATIC_GREEN_NM = 546.07;
export const CHROMATIC_GREEN_COLOR = 0x4ade80;

export class LightSource {
    protected rays: Ray[];
    protected vergence: number;
    constructor(vergence: number) {
        this.vergence = vergence;
        this.rays = [];
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
    vergence: number;
}
export class GridLightSource extends LightSource {
    private width: number = 0;
    private height: number = 0;
    private division: number = 0;
    private z: number = 0;
    constructor(props: GridLightSourceProps) {
        const { width, height, division = 4, z, vergence = 0} = props;
        
        if(division < 4) {
            throw new Error("division must be greater than 4");
        }

        if(width < 0 || height < 0) {
            throw new Error("width and height must be greater than 0");
        }

        if(z < 0) {
            throw new Error("z must be lesser than 0");
        }
        

        super(vergence);
        this.width = width;
        this.height = height;
        this.division = division;
        this.z = z;
        this.vergence = vergence;

        // 버전스도 반영하여 광선 생성
    }
}


export type RadialLightSourceProps = {
    radius: number;
    division: number;
    angle_division: number;
    z: number;
    vergence: number;
}
export class RadialLightSource extends LightSource {
    private radius: number = 0;
    private division: number = 0;
    private angle_division: number = 0;
    private z: number = 0;
    constructor(props: RadialLightSourceProps) {
        const { radius, division = 4, angle_division = 4, z, vergence = 0} = props;
        if(radius < 0) {
            throw new Error("radius must be greater than 0");
        }

        if(division < 4) {
            throw new Error("division must be greater than 4");
        }

        if(angle_division < 4) {
            throw new Error("angle_division must be greater than 4");
        }

        if(z < 0) {
            throw new Error("z must be lesser than 0");
        }

        super(vergence);
        this.radius = radius;
        this.division = division;
        this.angle_division = angle_division;
        this.z = z;
        this.vergence = vergence;

        // 버전스도 반영하여 광선 생성
    }
}