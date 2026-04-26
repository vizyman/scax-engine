import { Surface } from "../../surfaces/surface";
export abstract class EyeModelParameter {
    constructor(){}

    abstract createSurface(): Surface[];
}