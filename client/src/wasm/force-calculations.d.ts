declare module "*.wasm" {
    const content: WebAssembly.Module;
    export default content;
}

declare module "*/force-calculations.js" {
    interface Vec3 {
        x: number;
        y: number;
        z: number;
    }

    interface WasmNode {
        position: Vec3;
        velocity: Vec3;
        charge: number;
    }

    interface ForceCalculationsModule {
        calculateRepulsionForces: (nodes: WasmNode[], maxDistance: number) => void;
        calculateLinkForces: (
            nodes: WasmNode[],
            links: [number, number][],
            distances: number[],
            strengths: number[]
        ) => void;
        updatePositions: (nodes: WasmNode[], velocityDecay: number) => void;
    }

    const Module: () => Promise<ForceCalculationsModule>;
    export default Module;
} 