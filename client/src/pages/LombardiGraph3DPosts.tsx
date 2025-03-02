import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import ForceGraph, { GraphMethods } from "r3f-forcegraph";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { generateGraphData } from "../utils/generatePostsNodesAndLinks";
import { Node, Link } from "../types/graph";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { StatsDisplay } from "../components/StatsDisplay";

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

// Composant pour rendre les nœuds avec InstancedMesh
function NodeRenderer({
    nodes,
    lodLevel
}: {
    nodes: GraphNode[];
    lodLevel: 'high' | 'medium' | 'low';
}) {
    const { scene } = useThree();
    const meshRefs = useRef<THREE.InstancedMesh[]>([]);

    // Fonction simplifiée pour obtenir la résolution des géométries
    const getGeometryResolution = useCallback((type: string): number => {
        switch (type) {
            case 'post':
                return lodLevel === 'high' ? 8 : 6;
            case 'displayName':
                return lodLevel === 'high' ? 12 : 8;
            case 'pair':
                return lodLevel === 'high' ? 10 : 7;
            case 'central':
                return lodLevel === 'high' ? 16 : 12;
            default:
                return 6;
        }
    }, [lodLevel]);

    // Créer des géométries et matériaux partagés
    const sharedResources = useMemo(() => {
        const geometries: Record<string, THREE.SphereGeometry> = {
            post: new THREE.SphereGeometry(1, getGeometryResolution('post'), getGeometryResolution('post')),
            displayName: new THREE.SphereGeometry(1, getGeometryResolution('displayName'), getGeometryResolution('displayName')),
            pair: new THREE.SphereGeometry(1, getGeometryResolution('pair'), getGeometryResolution('pair')),
            central: new THREE.SphereGeometry(1, getGeometryResolution('central'), getGeometryResolution('central'))
        };

        const materials: Record<string, THREE.MeshStandardMaterial> = {
            post: new THREE.MeshStandardMaterial({
                color: new THREE.Color(COLORS.post),
                emissive: new THREE.Color(COLORS.post),
                emissiveIntensity: 0.3,
                toneMapped: false
            }),
            displayName: new THREE.MeshStandardMaterial({
                color: new THREE.Color(COLORS.displayName),
                emissive: new THREE.Color(COLORS.displayName),
                emissiveIntensity: 0.3,
                toneMapped: false
            }),
            pair: new THREE.MeshStandardMaterial({
                color: new THREE.Color(COLORS.pair),
                emissive: new THREE.Color(COLORS.pair),
                emissiveIntensity: 0.3,
                toneMapped: false
            }),
            central: new THREE.MeshStandardMaterial({
                color: new THREE.Color(COLORS.central),
                emissive: new THREE.Color(COLORS.central),
                emissiveIntensity: 0.3,
                toneMapped: false
            })
        };

        return { geometries, materials };
    }, [getGeometryResolution]);

    // Compter les nœuds par type
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

    // Créer ou mettre à jour les InstancedMesh
    useEffect(() => {
        // Nettoyer les anciennes instances
        meshRefs.current.forEach(mesh => {
            if (mesh) {
                scene.remove(mesh);
                mesh.dispose();
            }
        });

        // Réinitialiser les références
        meshRefs.current = [];

        // Créer de nouvelles instances pour chaque type
        Object.entries(nodesByType).forEach(([type, typeNodes]) => {
            if (typeNodes.length > 0) {
                // Créer l'InstancedMesh
                const mesh = new THREE.InstancedMesh(
                    sharedResources.geometries[type],
                    sharedResources.materials[type],
                    typeNodes.length
                );

                mesh.frustumCulled = true;
                mesh.castShadow = false;
                mesh.receiveShadow = false;

                // Ajouter au scene et stocker la référence
                scene.add(mesh);
                meshRefs.current.push(mesh);
            }
        });

        return () => {
            // Nettoyage lors du démontage
            meshRefs.current.forEach(mesh => {
                if (mesh) {
                    scene.remove(mesh);
                    mesh.dispose();
                }
            });
        };
    }, [scene, sharedResources, nodesByType]);

    // Mettre à jour les positions des instances à chaque frame
    useFrame(() => {
        const dummy = new THREE.Object3D();

        // Mettre à jour chaque type de nœud
        Object.entries(nodesByType).forEach(([type, typeNodes], typeIndex) => {
            const mesh = meshRefs.current[typeIndex];
            if (!mesh || typeNodes.length === 0) return;

            // Mettre à jour chaque instance
            typeNodes.forEach((node, i) => {
                if (node.__threeObj) {
                    const position = node.__threeObj.position;

                    // Calculer la taille en fonction du type
                    let scale = 1;
                    if (type === "post") scale = Math.min((node.val || 5) * 0.5, 5);
                    else if (type === "displayName") scale = 10;
                    else if (type === "pair") scale = 7;
                    else if (type === "central") scale = 15;

                    // Mettre à jour la matrice de transformation
                    dummy.position.set(position.x, position.y, position.z);
                    dummy.scale.set(scale, scale, scale);
                    dummy.updateMatrix();

                    // Appliquer la matrice à l'instance
                    mesh.setMatrixAt(i, dummy.matrix);
                }
            });

            // Marquer la matrice comme nécessitant une mise à jour
            mesh.instanceMatrix.needsUpdate = true;
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
        };
    }, []);

    const graphDataMemo = useMemo(() => ({
        nodes: graphData.nodes.map(createNodeObject),
        links: graphData.links.map(createLinkObject),
    }), [graphData, createNodeObject, createLinkObject]);

    // Fonction pour déterminer la couleur des liens
    const getLinkColor = (link: D3Link) => {
        if (link.type === "character-source") {
            return COLORS.linkLevel1;
        } else {
            return COLORS.linkLevel2;
        }
    };

    // Forcer le rafraîchissement de la simulation en cas de modification des données
  useFrame(() => {
        if (fgRef.current && graphDataMemo.nodes.length > 0) {
      fgRef.current.tickFrame();
        }
    });

  return (
        <>
    <ForceGraph
                ref={fgRef as any}
                graphData={graphDataMemo}
                nodeResolution={1}
                warmupTicks={0}
                // cooldownTicks={-1}
                // cooldownTime={0}
                d3AlphaMin={0}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.1}
      linkColor={getLinkColor}
                linkWidth={(link: D3Link) => link.type === 'character-source' ? 2 : 1}
                linkOpacity={0.6}
                linkResolution={6}
                nodeVal={(node: GraphNode) => {
                    if (node.type === "post") return Math.min((node.val || 5) * 0.5, 5);
                    if (node.type === "displayName") return 10;
                    if (node.type === "pair") return 7;
                    if (node.type === "central") return 15;
                    return 5;
                }}
                nodeThreeObject={() => new THREE.Object3D()}
                d3ChargeStrength={(node: D3Node) => {
                    if (node.type === 'central') return -100;
                    if (node.type === 'displayName') return -50;
                    if (node.type === 'pair') return -50;
                    return -10;
                }}
                d3ChargeDistanceMax={100}
                d3LinkDistance={(link: D3Link) => {
                    if (link.type === 'character-source') return 500;
                    return 100;
                }}
                d3LinkStrength={(link: D3Link) => {
                    if (link.type === 'character-source') return 0.8;
                    return 0.8;
                }}
                d3CenterStrength={0.1}
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
        camera={{ position: [0, 0, 500], near: 0.1, far: 10000 }}
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
