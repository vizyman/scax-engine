import { Vector2, Vector3 } from "three";
import Ray from "../ray/ray";

export type SurfaceProps = {
  type: string;
  name: string;
  position: { x: number, y: number, z: number };
  tilt: { x: number, y: number };
}

export default abstract class Surface {
  protected type: string = "";
  protected name: string = "";
  protected incidentRays: Ray[];
  protected refractedRays: Ray[];
  protected position: Vector3 = new Vector3(0, 0, 0);
  protected tilt: Vector2 = new Vector2(0, 0);
  protected meridians: { angle: number, d: number }[] = [];

  constructor(props: SurfaceProps) {
    const { type, name, position, tilt } = props;
    this.type = type;
    this.name = name;
    this.position = new Vector3(position.x, position.y, position.z);
    this.tilt = new Vector2(tilt.x, tilt.y);
    this.incidentRays = [];
    this.refractedRays = [];
  }

  abstract incident(ray: Ray): Vector3 | null;

  abstract refract(ray: Ray): Ray | null;

  public getName() {
    return this.name;
  }

  public getPosition() {
    return this.position.clone();
  }

  public getTraceHistory() {
    return {
      incidentRays: this.incidentRays.map((ray) => ray.clone()),
      refractedRays: this.refractedRays.map((ray) => ray.clone()),
    };
  }

  public getCylinderPower(): { c: number; ax: number } | null {
    return null;
  }

  public clearTraceHistory() {
    this.incidentRays = [];
    this.refractedRays = [];
  }

}
