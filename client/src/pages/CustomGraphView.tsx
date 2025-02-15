import { Canvas } from "@react-three/fiber";
import { FlyControls, Stats } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import CustomGraph from "../components/CustomGraph";
import { GamepadControls } from "../components/GamepadControls";
import { useSocketSync } from "../hooks/useSocketSync";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

interface TreeNode {
  name: string;
  depth: number;
  uid: number;
  children?: TreeNode[];
}

interface GraphNode {
  id: number;
  name: string;
  depth: number;
  x?: number;
  y?: number;
  z?: number;
  isLeaf: boolean;
}

interface GraphLink {
  source: number;
  target: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Function to convert tree data to graph format and position nodes in a grid
const convertTreeToGraph = (treeData: TreeNode): GraphData => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  let nodeCount = 0;

  // Calculer le nombre de nœuds par niveau
  const nodesByLevel: { [key: number]: TreeNode[] } = {};
  const countNodesAtLevel = (node: TreeNode) => {
    if (!nodesByLevel[node.depth]) {
      nodesByLevel[node.depth] = [];
    }
    nodesByLevel[node.depth].push(node);
    node.children?.forEach(countNodesAtLevel);
  };
  countNodesAtLevel(treeData);

  // Paramètres de la grille
  const Z_SPACING = 200; // Espacement entre les niveaux de profondeur
  const GRID_SPACING = 80; // Espacement entre les nœuds
  const SPHERE_RADIUS = 150; // Rayon de la sphère pour les posts

  const processNode = (node: TreeNode): boolean => {
    if (nodeCount >= 3000) return false;

    // Vérifier si c'est une feuille (post)
    const isLeaf = !node.children || node.children.length === 0;

    if (!isLeaf) {
      // Pour les nœuds non-feuilles, utiliser le placement en grille normal
      const levelNodes = nodesByLevel[node.depth];
      const nodeIndex = levelNodes.indexOf(node);
      const gridSize = Math.ceil(Math.sqrt(levelNodes.length));

      // Calculer la position dans la grille
      const row = Math.floor(nodeIndex / gridSize);
      const col = nodeIndex % gridSize;

      // Centrer la grille
      const gridOffset = (gridSize * GRID_SPACING) / 2;
      const x = col * GRID_SPACING - gridOffset;
      const y = row * GRID_SPACING - gridOffset;
      const z = -node.depth * Z_SPACING;

      nodes.push({
        id: node.uid,
        name: node.name || `Node ${node.uid}`,
        depth: node.depth,
        x,
        y,
        z,
        isLeaf: false,
      });
      nodeCount++;

      // Traiter les enfants
      if (node.children) {
        // Calculer le nombre de posts (feuilles) pour ce nœud
        const posts = node.children.filter(
          (child) => !child.children || child.children.length === 0
        );
        const numPosts = posts.length;

        // Distribuer les posts en sphère
        posts.forEach((post, index) => {
          if (nodeCount >= 3000) return;

          // Calculer les angles pour une distribution uniforme sur une sphère
          const phi = Math.acos(-1 + (2 * index) / numPosts);
          const theta = Math.sqrt(numPosts * Math.PI) * phi;

          // Convertir en coordonnées cartésiennes
          const postX = x + SPHERE_RADIUS * Math.cos(theta) * Math.sin(phi);
          const postY = y + SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
          const postZ = z + SPHERE_RADIUS * Math.cos(phi);

          nodes.push({
            id: post.uid,
            name: post.name || `Post ${post.uid}`,
            depth: post.depth,
            x: postX,
            y: postY,
            z: postZ,
            isLeaf: true,
          });
          nodeCount++;

          links.push({
            source: node.uid,
            target: post.uid,
          });
        });

        // Traiter les nœuds non-feuilles normalement
        const nonLeafChildren = node.children.filter(
          (child) => child.children && child.children.length > 0
        );
        nonLeafChildren.forEach((child) => {
          if (nodeCount >= 3000) return;
          const shouldContinue = processNode(child);
          if (shouldContinue) {
            links.push({
              source: node.uid,
              target: child.uid,
            });
          }
        });
      }
    }

    return true;
  };

  processNode(treeData);
  console.log(
    `Graph généré avec ${nodes.length} nœuds et ${links.length} liens`
  );
  return { nodes, links };
};

function CameraSync() {
  const { camera } = useThree();
  useSocketSync(true, camera);
  return null;
}

export function CustomGraphView() {
  const graphRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });

  // Charger et convertir les données
  useEffect(() => {
    fetch("/data/hierarchy.json")
      .then((response) => response.json())
      .then((treeData: TreeNode) => {
        const convertedData = convertTreeToGraph(treeData);
        setGraphData(convertedData);
      })
      .catch((error) => console.error("Error loading graph data:", error));
  }, []);

  // Gestionnaire pour la touche espace
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();

        if (graphRef.current) {
          const currentData = graphRef.current.getGraphData();
          const nodesPositions = currentData.nodes
            .filter(
              (node: GraphNode) =>
                node.x !== undefined &&
                node.y !== undefined &&
                node.z !== undefined
            )
            .map((node: GraphNode) => ({
              id: node.id,
              name: node.name,
              position: {
                x: node.x,
                y: node.y,
                z: node.z,
              },
            }));

          const dataStr = JSON.stringify(nodesPositions, null, 2);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `nodes-positions-${new Date().toISOString()}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          console.log(
            `${nodesPositions.length} positions de nœuds exportées !`
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [0, 0, 1000],
          fov: 75,
          near: 0.1,
          far: 10000,
        }}
      >
        <Stats />
        <color attach="background" args={["#000119"]} />
        <ambientLight intensity={2} />
        <pointLight position={[10, 10, 10]} />
        <CustomGraph
          ref={graphRef}
          graphData={graphData}
          onNodeClick={(node) => {
            console.log("Nœud cliqué:", node);
          }}
        />
        <FlyControls movementSpeed={1200} rollSpeed={0.5} dragToLook={true} />
        <GamepadControls />
        <CameraSync />
        {/* <EffectComposer>
          <Bloom
            intensity={19}
            luminanceThreshold={0.02}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer> */}
      </Canvas>
    </div>
  );
}
