import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import ForceGraph from "r3f-forcegraph";
import { OrbitControls, Stats } from "@react-three/drei";
import * as THREE from "../../node_modules/@types/three";
import { useSocketSync } from "../hooks/useSocketSync";
import { generateGraphData } from "../utils/generateGraphNodesAndLinks";
import { Node, Link } from "../types/graph";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Pixelation } from "@react-three/postprocessing";
import { createNodeObject, COLORS } from "../utils/createNodeObject";
import { GamepadControls } from "../components/GamepadControls";
import { FlyControls } from "@react-three/drei";
import {
  PostsRenderer,
  FrustumCuller,
  Post,
} from "../components/PostsRenderer";

function CameraSync() {
  const { camera } = useThree();
  useSocketSync(true, camera);
  return null;
}

interface ControllerConfig {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  rotationSpeed: number;
  deadzone: number;
}

// Interface pour stocker les positions des nœuds
interface NodePosition {
  slug: string;
  type: string;
  isJoshua?: boolean;
  x: number;
  y: number;
  z: number;
}

function ForceGraphWrapper({
  graphData,
  showCentralJoshua,
  onStabilized,
}: {
  graphData: { nodes: Node[]; links: Link[] };
  showCentralJoshua: boolean;
  onStabilized?: (nodePositions: NodePosition[]) => void;
}) {
  const fgRef = useRef<any>();
  const isTickingRef = useRef(false);
  const stabilizedRef = useRef(false);
  const nodePositionsRef = useRef<Record<string, NodePosition>>({});

  // Fonction pour capturer les positions des nœuds
  const captureNodePositions = useCallback(() => {
    if (!fgRef.current || !onStabilized) return;

    const nodePositions: NodePosition[] = [];

    // Parcourir tous les nœuds et capturer leurs positions
    fgRef.current.graphData().nodes.forEach((node: any) => {
      if (
        node.x !== undefined &&
        node.y !== undefined &&
        node.z !== undefined
      ) {
        nodePositions.push({
          slug: node.slug,
          type: node.type,
          isJoshua: node.isJoshua,
          x: node.x,
          y: node.y,
          z: node.z,
        });
      }
    });

    onStabilized(nodePositions);
  }, [onStabilized]);

  useFrame(() => {
    if (fgRef.current && !isTickingRef.current) {
      isTickingRef.current = true;
      fgRef.current.tickFrame();
      isTickingRef.current = false;

      // Vérifier si le graphe est stabilisé
      if (!stabilizedRef.current && fgRef.current._animationCycle === null) {
        stabilizedRef.current = true;
        captureNodePositions();
      }
    }
  });

  // Fonction personnalisée pour mettre à jour les positions des nœuds
  const nodePositionUpdate = useCallback(
    (nodeObj: any, coords: any, node: any) => {
      // Stocker la position du nœud
      if (node && node.slug) {
        nodePositionsRef.current[node.id] = {
          slug: node.slug,
          type: node.type,
          isJoshua: node.isJoshua,
          x: coords.x,
          y: coords.y,
          z: coords.z,
        };
      }

      // Retourner false pour permettre la mise à jour normale de la position
      return false;
    },
    []
  );

  return (
    <ForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeThreeObject={createNodeObject}
      nodePositionUpdate={nodePositionUpdate}
      linkColor={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? COLORS.centralJoshua
          : link.target.type === "source"
          ? COLORS.source
          : link.target.isJoshua
          ? COLORS.joshua
          : COLORS.character
      }
      linkOpacity={1}
      linkWidth={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? 0.5
          : 0.5
      }
      nodeResolution={8}
      warmupTicks={0}
      linkDirectionalParticles={0}
      linkDirectionalParticleWidth={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? 3
          : 2
      }
      cooldownTicks={3000}
      cooldownTime={3000}
      linkDirectionalArrowLength={0}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? COLORS.centralJoshua
          : link.target.type === "source"
          ? COLORS.source
          : link.target.isJoshua
          ? COLORS.joshua
          : COLORS.character
      }
      nodeVal={(node) =>
        node.id === "central-joshua" ? 30 : node.val * (node.isJoshua ? 2.5 : 2)
      }
    />
  );
}

export function LombardiGraph3D() {
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
  const dataLoadedRef = useRef(false);
  const [showCentralJoshua, setShowCentralJoshua] = useState(true);
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const [isStabilized, setIsStabilized] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showPosts, setShowPosts] = useState(true);
  const postsLoadedRef = useRef(false);

  const [controllerConfig, setControllerConfig] = useState<ControllerConfig>({
    maxSpeed: 1400,
    acceleration: 800,
    deceleration: 0.95,
    rotationSpeed: 4.2,
    deadzone: 0.15,
  });

  const handleControllerChange = (key: string, value: number) => {
    setControllerConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Fonction pour gérer la stabilisation du graphe
  const handleStabilized = useCallback((positions: NodePosition[]) => {
    setNodePositions(positions);
    setIsStabilized(true);
    console.log(
      "Graphe stabilisé, positions des nœuds capturées:",
      positions.length
    );
  }, []);

  // Fonction pour exporter les positions des nœuds en JSON
  const exportNodePositions = useCallback(() => {
    if (nodePositions.length === 0) {
      // Même si le graphe n'est pas encore stabilisé, on peut exporter les positions actuelles
      const currentPositions: NodePosition[] = [];

      if (graphData && graphData.nodes) {
        graphData.nodes.forEach((node: any) => {
          if (
            node.x !== undefined &&
            node.y !== undefined &&
            node.z !== undefined
          ) {
            currentPositions.push({
              slug: node.slug,
              type: node.type,
              isJoshua: node.isJoshua,
              x: node.x,
              y: node.y,
              z: node.z,
            });
          }
        });
      }

      if (currentPositions.length === 0) {
        alert(
          "Aucune position de nœud disponible à exporter. Attendez que le graphe commence à se déployer."
        );
        return;
      }

      // Utiliser les positions actuelles
      exportPositionsToFile(currentPositions);
    } else {
      // Utiliser les positions stabilisées
      exportPositionsToFile(nodePositions);
    }
  }, [nodePositions, graphData]);

  // Fonction utilitaire pour exporter les positions vers un fichier
  const exportPositionsToFile = useCallback((positions: NodePosition[]) => {
    // Créer un objet Blob avec les données JSON
    const data = JSON.stringify(positions, null, 2);
    const blob = new Blob([data], { type: "application/json" });

    // Créer une URL pour le Blob
    const url = URL.createObjectURL(blob);

    // Créer un lien de téléchargement et cliquer dessus
    const link = document.createElement("a");
    link.href = url;
    link.download = "node-positions.json";
    document.body.appendChild(link);
    link.click();

    // Nettoyer
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(
      `Exportation de ${positions.length} positions de nœuds terminée.`
    );
  }, []);

  // Charger les posts
  useEffect(() => {
    if (postsLoadedRef.current) return;
    postsLoadedRef.current = true;

    fetch("/data/spatialized_posts_voronoi.json")
      .then((res) => res.json())
      .then((data) => {
        console.log("Posts chargés:", data.length);
        setPosts(data);
      })
      .catch((error) => {
        console.error("Erreur lors du chargement des posts:", error);
      });
  }, []);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    fetch("/data/characters.json")
      .then((res) => res.json())
      .then((characters) => {
        let data = generateGraphData(characters);

        // Si showCentralJoshua est activé, ajouter le nœud central et ses liens
        if (showCentralJoshua) {
          // Créer le nœud central Joshua
          const centralJoshuaNode: Node = {
            id: "central-joshua",
            name: "JOSHUA",
            slug: "central-joshua", // Ajout de la propriété slug requise
            type: "character",
            val: 30,
            color: COLORS.centralJoshua,
            isJoshua: true,
          };

          // Ajouter le nœud central à la liste des nœuds
          data.nodes.push(centralJoshuaNode);

          // Créer des liens entre le nœud central et tous les nœuds Joshua
          const joshuaNodes = data.nodes.filter(
            (node) =>
              node.type === "character" &&
              node.isJoshua === true &&
              node.id !== "central-joshua"
          );

          // Ajouter les liens
          joshuaNodes.forEach((node) => {
            data.links.push({
              source: "central-joshua",
              target: node.id,
              type: "joshua-connection",
              value: 2,
            });
          });
        }

        console.log("Données du graphe générées:", {
          noeuds: data.nodes.length,
          liens: data.links.length,
          personnages: data.nodes.filter((n) => n.type === "character").length,
          sources: data.nodes.filter((n) => n.type === "source").length,
        });
        setGraphData(data);
      });
  }, [showCentralJoshua]);

  return (
    <div
      style={{ width: "100vw", height: "100vh", background: COLORS.background }}
    >
      {/* Bouton d'exportation des positions des nœuds */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 1000,
        }}
      >
        <button
          onClick={exportNodePositions}
          style={{
            padding: "10px 15px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            marginRight: "10px",
          }}
        >
          Exporter les positions des nœuds{" "}
          {isStabilized ? "(stabilisé)" : "(en cours)"}
        </button>

        <button
          onClick={() => setShowPosts(!showPosts)}
          style={{
            padding: "10px 15px",
            backgroundColor: showPosts ? "#f44336" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {showPosts ? "Masquer les posts" : "Afficher les posts"}
        </button>
      </div>

      <Canvas camera={{ position: [0, 0, 500], near: 0.1, far: 10000 }}>
        <Stats className="stats" showPanel={0} />
        <color attach="background" args={[COLORS.background]} />
        <ambientLight intensity={0.4} />
        {/* <pointLight position={[0, 0, 0]} intensity={0.5} />
        <pointLight position={[2000, 2000, 2000]} intensity={0.5} /> */}
        <ForceGraphWrapper
          graphData={graphData}
          showCentralJoshua={showCentralJoshua}
          onStabilized={handleStabilized}
        />
        {/* Affichage conditionnel des posts */}
        {showPosts && (
          <>
            <PostsRenderer posts={posts} />
            {/* <FrustumCuller /> */}
          </>
        )}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={5000}
          minDistance={50}
          zoomSpeed={1.5}
          dampingFactor={0.3}
          rotateSpeed={0.8}
        />
        {/* <FlyControls movementSpeed={1000} rollSpeed={0.5} dragToLook={true} />
        <GamepadControls config={controllerConfig} />
        <CameraSync /> */}
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.3}
          />
          {/* <Pixelation
            granularity={5} // pixel granularity
          /> */}
        </EffectComposer>
      </Canvas>
    </div>
  );
}
