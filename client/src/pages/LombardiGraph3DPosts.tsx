import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import ForceGraph, { GraphMethods, GraphData } from "r3f-forcegraph";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { generateGraphData } from "../utils/generatePostsNodesAndLinks";
import { Node, Link } from "../types/graph";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { StatsDisplay } from "../components/StatsDisplay";
import { initForceCalculations, calculateForces } from '../wasm/force-calculations';
import { GPUForceSimulation } from "../utils/GPUForceSimulation";
import { NodeType } from '../types/graph';

// Définir les couleurs pour les différents éléments
const COLORS = {
    post: "#4285F4",
    displayName: "#EA4335",
    pair: "#FBBC05",
    central: "#34A853",
    background: "#000000",
    linkLevel1: "#FFFFFF",
    linkLevel2: "#AAAAAA",
};

// Définir les types pour les nœuds
type NodeType = "post" | "displayName" | "pair" | "central";

// Interface pour les nœuds du graphe
interface GraphNode {
    id: string;
    name: string;
    val: number;
    color?: string;
    type: NodeType;
    platform?: string;
    date?: string;
    url?: string;
    displayName?: string;
    sourceType?: string;
    isHighlighted?: boolean;
    __threeObj?: THREE.Object3D; // Propriété ajoutée par ForceGraph
}

// Interface pour les liens du graphe
interface GraphLink extends Omit<Link, 'type'> {
    level: number;
    type: string;
}

// Ajouter ces interfaces juste après les interfaces existantes
interface D3Node extends GraphNode {
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    type: NodeType;
}

interface D3Link {
    source: string | D3Node;
    target: string | D3Node;
    type: string;
    value: number;
    level: number;
}

// Ajouter une Map pour le cache des indices
const nodeIndexCache = new Map<string, number>();

// Fonction pour obtenir la couleur d'un nœud
const getNodeColor = (node: GraphNode): string => {
    switch (node.type) {
        case "central":
            return COLORS.central;
        case "displayName":
            return COLORS.displayName;
        case "pair":
            return COLORS.pair;
        case "post":
            return COLORS.post;
        default:
            return "#888888";
    }
};

// Fonction pour convertir le type de nœud
const convertNodeType = (type: Node["type"]): NodeType => {
    switch (type) {
        case "post":
            return "post";
        case "character":
            return "displayName";
        case "source":
            return "pair";
        default:
            return "central";
    }
};

// Fonction pour obtenir la taille d'un point selon son type
const getNodeSize = (type: NodeType): number => {
    switch (type) {
        case "central":
            return 15;
        case "displayName":
            return 10;
        case "pair":
            return 7;
        case "post":
            return 4;
        default:
            return 5;
    }
};

// Optimiser le NodeRenderer avec des Points
function NodeRenderer({
    nodes,
    lodLevel
}: {
    nodes: GraphNode[];
    lodLevel: 'high' | 'medium' | 'low';
}) {
    const { scene } = useThree();
    const pointsRef = useRef<THREE.Points[]>([]);
    
    // Créer les objets Three.js une seule fois
    const nodesByType = useMemo(() => {
        const nodeGroups: Record<string, GraphNode[]> = {
            post: [],
            displayName: [],
            pair: [],
            central: []
        };

        nodes.forEach(node => {
            if (node.type && nodeGroups[node.type]) {
                nodeGroups[node.type].push(node);
            }
        });

        return nodeGroups;
    }, [nodes]);

    // Créer ou mettre à jour les Points
    useEffect(() => {
        // Nettoyer les anciens points
        pointsRef.current.forEach(points => {
            if (points) {
                scene.remove(points);
                points.geometry.dispose();
                (points.material as THREE.PointsMaterial).dispose();
            }
        });

        // Réinitialiser les références
        pointsRef.current = [];

        // Créer de nouveaux points pour chaque type
        Object.entries(nodesByType).forEach(([type, typeNodes]) => {
            if (typeNodes.length > 0) {
                // Créer la géométrie avec les positions
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(typeNodes.length * 3);
                const colors = new Float32Array(typeNodes.length * 3);
                const color = new THREE.Color(getNodeColor({ type: type as NodeType } as GraphNode));

                typeNodes.forEach((node, i) => {
                    if (node.__threeObj) {
                        const idx = i * 3;
                        positions[idx] = node.__threeObj.position.x;
                        positions[idx + 1] = node.__threeObj.position.y;
                        positions[idx + 2] = node.__threeObj.position.z;
                        colors[idx] = color.r;
                        colors[idx + 1] = color.g;
                        colors[idx + 2] = color.b;
                    }
                });

                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                // Créer le matériau pour les points
                const material = new THREE.PointsMaterial({
                    size: getNodeSize(type as NodeType) * (lodLevel === 'high' ? 1.2 : lodLevel === 'medium' ? 1 : 0.8),
                    sizeAttenuation: true,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.8,
                    color: color,
                    toneMapped: false
                });

                // Créer les points
                const points = new THREE.Points(geometry, material);
                points.frustumCulled = true;

                // Ajouter à la scène et stocker la référence
                scene.add(points);
                pointsRef.current.push(points);
            }
        });

        return () => {
            // Nettoyage lors du démontage
            pointsRef.current.forEach(points => {
                if (points) {
                    scene.remove(points);
                    points.geometry.dispose();
                    (points.material as THREE.PointsMaterial).dispose();
                }
            });
        };
    }, [scene, nodesByType, lodLevel]);

    // Optimiser la mise à jour des positions
    useFrame(() => {
        Object.entries(nodesByType).forEach(([type, typeNodes], typeIndex) => {
            const points = pointsRef.current[typeIndex];
            if (!points || typeNodes.length === 0) return;

            const positions = points.geometry.attributes.position.array as Float32Array;
            let needsUpdate = false;

            typeNodes.forEach((node, i) => {
                if (node.__threeObj) {
                    const idx = i * 3;
                    const position = node.__threeObj.position;

                    if (positions[idx] !== position.x || 
                        positions[idx + 1] !== position.y || 
                        positions[idx + 2] !== position.z) {
                        
                        positions[idx] = position.x;
                        positions[idx + 1] = position.y;
                        positions[idx + 2] = position.z;
                        needsUpdate = true;
                    }
                }
            });

            if (needsUpdate) {
                points.geometry.attributes.position.needsUpdate = true;
            }
        });
    });

    return null;
}

function ForceGraphWrapper({
  graphData,
    lodLevel
}: {
  graphData: { nodes: Node[]; links: Link[] };
    lodLevel: 'high' | 'medium' | 'low';
}) {
    const fgRef = useRef<GraphMethods>();
    const gpuSimRef = useRef<GPUForceSimulation>();
    const nodesRef = useRef<GraphNode[]>([]);
    const linksRef = useRef<GraphLink[]>([]);
    const { gl } = useThree();

    // Initialiser la simulation GPU
    useEffect(() => {
        if (!gpuSimRef.current) {
            gpuSimRef.current = new GPUForceSimulation(gl);
        }

        return () => {
            gpuSimRef.current?.dispose();
        };
    }, [gl]);

    const createNodeObject = useCallback((node: Node): GraphNode => {
        const graphNode: GraphNode = {
            ...node,
            type: convertNodeType(node.type),
            val: node.val || 1,
        };

        return {
            ...graphNode,
            color: getNodeColor(graphNode),
        };
    }, []);

    const createLinkObject = useCallback((link: Link): GraphLink => {
        return {
            source: link.source,
            target: link.target,
            value: link.value,
            level: link.type === "primary" ? 1 : 2,
            type: link.type,
        };
    }, []);

    const graphDataMemo = useMemo(() => {
        const nodes = graphData.nodes.map(createNodeObject);
        const links = graphData.links.map(createLinkObject);
        nodesRef.current = nodes;
        linksRef.current = links;
        return { nodes, links };
    }, [graphData, createNodeObject, createLinkObject]);

    // Pré-calculer les indices une seule fois
    useEffect(() => {
        nodeIndexCache.clear();
        nodesRef.current.forEach((node, index) => {
            nodeIndexCache.set(node.id, index);
        });
    }, [graphData]);

    // Optimiser le calcul des forces avec GPU
    const frameCount = useRef(0);
  useFrame(() => {
        frameCount.current++;
        
        // Limiter les mises à jour à 30 FPS
        if (frameCount.current % 2 !== 0) return;

        if (!fgRef.current || !gpuSimRef.current || nodesRef.current.length === 0) return;

        try {
            // Préparer les données pour la simulation GPU
            const nodes = nodesRef.current.map(node => ({
                position: new THREE.Vector3(
                    node.__threeObj?.position.x || 0,
                    node.__threeObj?.position.y || 0,
                    node.__threeObj?.position.z || 0
                ),
                velocity: new THREE.Vector3(0, 0, 0),
                charge: -50
            }));

            const links = linksRef.current.map(link => ({
                source: nodeIndexCache.get(link.source as string) || 0,
                target: nodeIndexCache.get(link.target as string) || 0,
                distance: 100,
                strength: link.level === 1 ? 0.8 : 0.4
            }));

            // Mettre à jour les données de la simulation
            gpuSimRef.current.updateNodes(nodes);
            gpuSimRef.current.updateLinks(links);

            // Exécuter une étape de simulation
            gpuSimRef.current.step();

            // Récupérer les nouvelles positions
            const positions = gpuSimRef.current.getPositions();
            
            // Mettre à jour les positions des nœuds
            nodesRef.current.forEach((node, i) => {
                if (node.__threeObj) {
                    const idx = i * 4;
                    node.__threeObj.position.set(
                        positions[idx],
                        positions[idx + 1],
                        positions[idx + 2]
                    );
                }
            });

            fgRef.current.tickFrame();
        } catch (error) {
            console.error('Error in GPU force calculation:', error);
        }
    });

  return (
        <>
    <ForceGraph
      ref={fgRef}
                graphData={graphDataMemo}
                nodeThreeObject={() => new THREE.Object3D()}
                nodeThreeObjectExtend={false}
            />
            <NodeRenderer nodes={graphDataMemo.nodes} lodLevel={lodLevel} />
        </>
  );
}

export function LombardiGraph3DPosts() {
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
    const [lodLevel] = useState<'high' | 'medium' | 'low'>('medium');
  const dataLoadedRef = useRef(false);
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const cameraRef = useRef<THREE.Camera>();

    // Configuration du rendu WebGL
    const handleCreated = ({ gl, camera }: { gl: THREE.WebGLRenderer, camera: THREE.Camera }) => {
        rendererRef.current = gl;
        cameraRef.current = camera;
        
        // Optimisations WebGL
        gl.setPixelRatio(window.devicePixelRatio);
        gl.setSize(window.innerWidth, window.innerHeight);
        gl.setClearColor(0x000000, 1);
    };

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    generateGraphData()
      .then((data) => {
                setGraphData(data);
      })
      .catch((error) => {
        console.error("Erreur lors du chargement des données:", error);
      });
  }, []);

  return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            <StatsDisplay />
      <Canvas 
        camera={{ position: [0, 0, 2000], near: 1, far: 20000 }}
                gl={{ 
                    antialias: false,
                    powerPreference: 'high-performance',
                    alpha: false,
                    stencil: false,
                    depth: true
                }}
                onCreated={handleCreated}
      >
        <color attach="background" args={[COLORS.background]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 0]} intensity={0.5} />
                <ForceGraphWrapper 
                    graphData={graphData} 
                    lodLevel={lodLevel}
                />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={5000}
                    minDistance={10}
          zoomSpeed={1.5}
          dampingFactor={0.3}
          rotateSpeed={0.8}
        />
                <EffectComposer multisampling={0}>
          <Bloom
                        intensity={0.8}
                        luminanceThreshold={0.3}
            luminanceSmoothing={0.9}
            mipmapBlur={false}
                        kernelSize={2}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
