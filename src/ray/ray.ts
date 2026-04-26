import {Vector3} from "three";

const EPS = 1e-9;
const DEFAULT_DIR = new Vector3(0, 0, 1);
export const DEFAULT_RAY_WAVELENGTH_NM = 587.56;
export const DEFAULT_RAY_DISPLAY_COLOR = 0xfacc15;

function isFiniteVector3(v: Vector3): boolean {
    return (
        !!v &&
        Number.isFinite(Number(v.x)) &&
        Number.isFinite(Number(v.y)) &&
        Number.isFinite(Number(v.z))
    );
}

/**
 * 프라운호퍼 D선 광선이 기본 입니다. 
 * 기본 색은 노란색입니다.
 */
export class Ray {
    private points: Vector3[];
    constructor(
        public readonly origin: Vector3,
        public readonly direction: Vector3,
        public readonly wavelengthNm: number = DEFAULT_RAY_WAVELENGTH_NM,
        public readonly displayColor: number = DEFAULT_RAY_DISPLAY_COLOR
    ) {
        this.origin = isFiniteVector3(origin)
            ? origin.clone()
            : new Vector3(0, 0, 0);
        this.direction = isFiniteVector3(direction)
            ? direction.clone().normalize()
            : DEFAULT_DIR.clone();
        if (!isFiniteVector3(this.direction) || this.direction.lengthSq() < EPS) {
            this.direction = DEFAULT_DIR.clone();
        }
        this.wavelengthNm = Number.isFinite(Number(wavelengthNm))
            ? Number(wavelengthNm)
            : DEFAULT_RAY_WAVELENGTH_NM;
        this.displayColor =
            displayColor != null && Number.isFinite(Number(displayColor))
                ? Number(displayColor)
                : DEFAULT_RAY_DISPLAY_COLOR;
        this.points = [this.origin.clone()];
    }

    appendPoint(point: Vector3) {
        if (!isFiniteVector3(point)) return;
        this.points.push(point.clone());
    }

    endPoint() {
        return this.points[this.points.length - 1].clone();
    }

    clone() {
        const cloned = new Ray(
            this.origin,
            this.direction,
            this.wavelengthNm,
            this.displayColor,
        );
        cloned.points = this.points.map((point) => point.clone());
        return cloned;
    }

 
    continueFrom(nextOrigin: Vector3, nextDirection: Vector3) {
        if (!isFiniteVector3(nextOrigin) || !isFiniteVector3(nextDirection)) return;
        const dir = nextDirection.clone().normalize();
        if (!isFiniteVector3(dir) || dir.lengthSq() < EPS) return;
        this.origin.copy(nextOrigin);
        this.direction.copy(dir);
        const last = this.endPoint();
        if (last.distanceToSquared(nextOrigin) > EPS) {
            this.appendPoint(nextOrigin);
        }
    }
}