import Surface from "./surfaces/surface";
import { GridLightSource, GridLightSourceProps, RadialLightSource, RadialLightSourceProps } from "./light-sources/light-source";
export type SCAXSimulatorProps = {
    eyeModel : 'gullstrand' | 'navarro';
    surfaces: Surface[];
    light_source: {type: 'radial' | 'grid'} & (RadialLightSourceProps | GridLightSourceProps);
}
export default class SCAXSimulator {
    private eyeModel: 'gullstrand' | 'navarro';
    private surfaces: Surface[];
    private light_source: GridLightSource | RadialLightSource;
    constructor(props: SCAXSimulatorProps) {
        const { eyeModel = 'gullstrand', surfaces = [], light_source = {type: 'grid', width: 10, height: 10, division: 4, z: -10, vergence: 0 }} = props;
        this.eyeModel = eyeModel;
        this.surfaces = surfaces;
        if(light_source.type === 'radial') {
            this.light_source = new RadialLightSource(light_source as RadialLightSourceProps);
        } else if(light_source.type === 'grid') {
            this.light_source = new GridLightSource(light_source as GridLightSourceProps);
        } else {
            throw new Error("Invalid light source type");
        }        
    }
}
 