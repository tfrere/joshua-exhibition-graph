import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import ForceGraph from "r3f-forcegraph";
import { Vector3 } from "three";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../config";

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
  rootId: number;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: number;
  target: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const MAX_NODES = 40000;
const SOCKET_UPDATE_INTERVAL = 1000 / 10; // 10 fois par seconde pour le socket
const HYSTERESIS_DISTANCE = 20; // Augmenté pour plus de stabilité

// Function to convert tree data to graph format
const convertTreeToGraph = (treeData: TreeNode[]): GraphData => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  let nodeCount = 0;

  const processNode = (node: TreeNode, rootId: number): boolean => {
    if (nodeCount >= MAX_NODES) return false;

    nodes.push({
      id: node.uid,
      name: node.name || `Node ${node.uid}`,
      depth: node.depth,
      rootId,
    });
    nodeCount++;

    if (node.children) {
      for (const child of node.children) {
        if (nodeCount >= MAX_NODES) break;

        const shouldContinue = processNode(child, rootId);
        if (shouldContinue) {
          links.push({
            source: node.uid,
            target: child.uid,
          });
        }
      }
    }

    return true;
  };

  // Traiter chaque nœud racine
  for (const rootNode of treeData) {
    if (nodeCount >= MAX_NODES) break;
    processNode(rootNode, rootNode.uid);
  }

  console.log(
    `Graph généré avec ${nodes.length} nœuds et ${links.length} liens`
  );
  return { nodes, links };
};

export default forwardRef(function Graph(props, ref) {
  const fgRef = useRef<any>();
  const socketRef = useRef<any>(null);
  const { camera } = useThree();
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const tempVector = useRef(new Vector3());
  const lastClosestNode = useRef<GraphNode | null>(null);
  const lastUpdateTime = useRef(0);

  // Exposer les méthodes via la ref
  useImperativeHandle(ref, () => ({
    getGraphData: () => {
      if (fgRef.current) {
        return {
          nodes: graphData.nodes.map((node) => ({
            ...node,
            // Les propriétés x, y, z sont déjà mises à jour par le graphe
            x: node.x || 0,
            y: node.y || 0,
            z: node.z || 0,
          })),
          links: graphData.links,
        };
      }
      return graphData;
    },
  }));

  // Initialiser la connexion socket
  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    fetch("/data/merged_hierarchy.json")
      .then((response) => response.json())
      .then((treeData: TreeNode[]) => {
        const convertedData = convertTreeToGraph(treeData);
        setGraphData(convertedData);
      })
      .catch((error) => console.error("Error loading graph data:", error));
  }, []);

  useFrame((state) => {
    // Mettre à jour la simulation du graphe
    fgRef.current?.tickFrame();

    // Calculer le nœud le plus proche à chaque frame
    if (graphData.nodes.length > 0 && fgRef.current) {
      let newClosestNode = lastClosestNode.current;
      let minDistance = Infinity;

      // Position de la caméra
      const cameraPosition = camera.position;

      // Vérifier chaque nœud
      graphData.nodes.forEach((node: GraphNode) => {
        if (
          node.x !== undefined &&
          node.y !== undefined &&
          node.z !== undefined
        ) {
          tempVector.current.set(node.x, node.y, node.z);
          const distance = tempVector.current.distanceTo(cameraPosition);

          // Si c'est le nœud actuel, utiliser une distance d'hystérésis
          if (
            lastClosestNode.current &&
            node.id === lastClosestNode.current.id
          ) {
            if (distance < minDistance + HYSTERESIS_DISTANCE) {
              minDistance = distance;
              newClosestNode = node;
            }
          } else if (distance < minDistance) {
            minDistance = distance;
            newClosestNode = node;
          }
        }
      });

      // Mettre à jour le nœud le plus proche
      if (newClosestNode && newClosestNode !== lastClosestNode.current) {
        lastClosestNode.current = newClosestNode;
      }

      // Envoyer les données via socket moins fréquemment
      const currentTime = state.clock.getElapsedTime() * 1000;
      if (
        currentTime - lastUpdateTime.current >= SOCKET_UPDATE_INTERVAL &&
        lastClosestNode.current &&
        lastClosestNode.current.x !== undefined &&
        lastClosestNode.current.y !== undefined &&
        lastClosestNode.current.z !== undefined
      ) {
        lastUpdateTime.current = currentTime;

        if (socketRef.current) {
          socketRef.current.emit("updateState", {
            cameraPosition: [
              camera.position.x,
              camera.position.y,
              camera.position.z,
            ],
            cameraRotation: [
              camera.quaternion.x,
              camera.quaternion.y,
              camera.quaternion.z,
              camera.quaternion.w,
            ],
            closestNodeId: lastClosestNode.current.id,
            closestNodeName: lastClosestNode.current.name,
            closestNodePosition: [
              lastClosestNode.current.x,
              lastClosestNode.current.y,
              lastClosestNode.current.z,
            ],
          });
        }
      }
    }
  });

  return (
    <ForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeColor={(node: GraphNode) => {
        const rootColors = [
          "#ff6b6b",
          "#4ecdc4",
          "#45b7d1",
          "#96ceb4",
          "#ffeead",
          "#ff9a9e",
          "#81ecec",
          "#74b9ff",
          "#a8e6cf",
          "#dfe6e9",
          "#fab1a0",
          "#55efc4",
          "#0984e3",
          "#b2bec3",
          "#fd79a8",
          "#00cec9",
          "#6c5ce7",
          "#00b894",
          "#d63031",
          "#e17055",
        ];
        // Utiliser le rootId pour déterminer la couleur
        return rootColors[node.rootId % rootColors.length];
      }}
      linkColor={() => "rgba(255,255,255,1)"}
      linkOpacity={1}
      linkVisibility={false}
      nodeRelSize={1}
      linkWidth={0}
      linkDirectionalParticles={0}
      linkDirectionalParticleWidth={4}
      linkDirectionalParticleSpeed={0.005}
      linkDirectionalParticleColor={() => "rgba(255,255,255,.3)"}
      d3VelocityDecay={0.3}
      d3AlphaDecay={0.01}
      linkCurvature={0}
      warmupTicks={0}
      cooldownTicks={0}
      nodeResolution={8}
    />
  );
});
