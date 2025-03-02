// Type definition for Emscripten module
interface EmscriptenModule {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    HEAPU8: Uint8Array;
    HEAP32: Int32Array;
    NodeVector: {
        new(): NodeVectorType;
    };
    LinkVector: {
        new(): LinkVectorType;
    };
    FloatVector: {
        new(): FloatVectorType;
    };
    ForceSimulation: {
        new(maxDistance: number, velocityDecay: number): ForceSimulation;
    };
}

// Types pour les vecteurs C++
interface NodeVectorType {
    push_back(node: Node): void;
    get(index: number): Node;
    size(): number;
    delete(): void;
}

interface LinkVectorType {
    push_back(link: Link): void;
    get(index: number): Link;
    size(): number;
    delete(): void;
}

interface FloatVectorType {
    push_back(value: number): void;
    get(index: number): number;
    size(): number;
    delete(): void;
}

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface Node {
    position: Vec3;
    velocity: Vec3;
    charge: number;
}

interface Link {
    source: number;
    target: number;
}

interface ForceSimulation {
    setNodes(nodes: NodeVectorType): void;
    setLinks(links: LinkVectorType): void;
    setDistances(distances: FloatVectorType): void;
    setStrengths(strengths: FloatVectorType): void;
    getNodes(): NodeVectorType;
    step(): void;
}

interface ForceCalculationsModule extends EmscriptenModule {
    ForceSimulation: {
        new(maxDistance: number, velocityDecay: number): ForceSimulation;
    };
}

declare global {
    interface Window {
        createModule?: () => Promise<ForceCalculationsModule>;
    }
}

let moduleInstance: ForceCalculationsModule | null = null;
let simulation: ForceSimulation | null = null;

function loadWasmModule(): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/wasm/force-calculations.js';
        script.onload = () => resolve();
        script.onerror = (error) => reject(new Error(`Failed to load WASM script: ${error}`));
        document.head.appendChild(script);
    });
}

export async function initForceCalculations(): Promise<ForceCalculationsModule> {
    if (moduleInstance) {
        return moduleInstance;
    }

    try {
        await loadWasmModule();

        if (typeof window.createModule !== 'function') {
            throw new Error('createModule is not available. Make sure the WASM module is loaded correctly.');
        }

        moduleInstance = await window.createModule();
        simulation = new moduleInstance.ForceSimulation(100, 0.1);
        console.log('WebAssembly module initialized successfully');
        return moduleInstance;
    } catch (error) {
        console.error('Failed to initialize WebAssembly module:', error);
        throw error;
    }
}

export function calculateForces(
    nodes: Node[],
    links: [number, number][],
    distances: number[],
    strengths: number[]
): void {
    if (!simulation || !moduleInstance) {
        throw new Error('WebAssembly module not initialized. Call initForceCalculations first.');
    }

    try {
        // Create C++ vectors
        const nodeVector = new moduleInstance.NodeVector();
        const linkVector = new moduleInstance.LinkVector();
        const distanceVector = new moduleInstance.FloatVector();
        const strengthVector = new moduleInstance.FloatVector();

        // Fill node vector with current state
        nodes.forEach(node => {
            // Ensure velocity is bounded to prevent instability
            const maxVelocity = 10;
            if (node.velocity) {
                node.velocity.x = Math.max(Math.min(node.velocity.x, maxVelocity), -maxVelocity);
                node.velocity.y = Math.max(Math.min(node.velocity.y, maxVelocity), -maxVelocity);
                node.velocity.z = Math.max(Math.min(node.velocity.z, maxVelocity), -maxVelocity);
            }
            nodeVector.push_back(node);
        });

        // Fill link vector with normalized indices
        links.forEach(([source, target]) => {
            // Ensure indices are valid
            if (source >= 0 && source < nodes.length && target >= 0 && target < nodes.length) {
                linkVector.push_back({ source, target });
            }
        });

        // Fill distance vector with normalized values
        distances.forEach(distance => {
            // Ensure distance is positive and reasonable
            const normalizedDistance = Math.max(distance, 1);
            distanceVector.push_back(normalizedDistance);
        });

        // Fill strength vector with normalized values
        strengths.forEach(strength => {
            // Ensure strength is bounded
            const normalizedStrength = Math.max(Math.min(strength, 1), 0);
            strengthVector.push_back(normalizedStrength);
        });

        // Update simulation with vectors
        simulation.setNodes(nodeVector);
        simulation.setLinks(linkVector);
        simulation.setDistances(distanceVector);
        simulation.setStrengths(strengthVector);

        // Run simulation step
        simulation.step();

        // Get updated nodes and carefully update positions
        const updatedNodes = simulation.getNodes();
        for (let i = 0; i < nodes.length; i++) {
            const updatedNode = updatedNodes.get(i);
            if (updatedNode) {
                // Apply position updates with damping
                const damping = 0.8; // Reduce the effect of position changes
                nodes[i].position.x += (updatedNode.position.x - nodes[i].position.x) * damping;
                nodes[i].position.y += (updatedNode.position.y - nodes[i].position.y) * damping;
                nodes[i].position.z += (updatedNode.position.z - nodes[i].position.z) * damping;
                
                // Update velocities with the same damping
                nodes[i].velocity = {
                    x: updatedNode.velocity.x * damping,
                    y: updatedNode.velocity.y * damping,
                    z: updatedNode.velocity.z * damping
                };
            }
        }

        // Clean up vectors
        nodeVector.delete();
        linkVector.delete();
        distanceVector.delete();
        strengthVector.delete();
    } catch (error) {
        console.error('Error in force calculation:', error);
        throw error;
    }
} 