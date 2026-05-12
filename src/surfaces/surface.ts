import { Euler, Quaternion, Vector2, Vector3 } from "three";
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

  public clearTraceHistory() {
    this.incidentRays = [];
    this.refractedRays = [];
  }

  public getWorldPosition(): Vector3 {
    return this.position.clone();
  }

  public setPositionAndTilt(position: Vector3, tiltXDeg: number, tiltYDeg: number): void {
    this.position.copy(position);
    this.tilt.set(tiltXDeg, tiltYDeg);
  }

  /**
   * 안질 tilt가 0인 표면을 전제로, pivot 기준 강체 회전 후 동일 Euler(XYZ) tilt를 부여합니다.
   */
  public applyRigidRotationAboutPivot(pivot: Vector3, rotation: Quaternion): void {
    const p1 = pivot.clone().add(
      new Vector3().subVectors(this.position, pivot).applyQuaternion(rotation),
    );
    const euler = new Euler().setFromQuaternion(rotation, "XYZ");
    this.position.copy(p1);
    this.tilt.set((euler.x * 180) / Math.PI, (euler.y * 180) / Math.PI);
  }

}
