import { useRef, forwardRef, useImperativeHandle } from "react";
import { Vector3, Color, QuadraticBezierCurve3 } from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";

interface GraphNode {
  id: number;
  name: string;
  depth: number;
  x?: number;
  y?: number;
  z?: number;
  isLeaf?: boolean;
}

interface GraphLink {
  source: number;
  target: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface CustomGraphProps {
  graphData: GraphData;
  onNodeClick?: (node: GraphNode) => void;
}

const NODE_COLORS = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeead"].map(
  (color) => new Color(color)
);
const NODE_SIZE_BASE = 2;
const NODE_SIZE_DECAY = 0.85; // Réduction plus douce de la taille avec la profondeur
const HIGHLIGHT_COLOR = new Color("#ff0000");

export default forwardRef(function CustomGraph(
  { graphData, onNodeClick }: CustomGraphProps,
  ref
) {
  const nodesRef = useRef<{ [key: number]: Vector3 }>({});

  // Exposer les méthodes via la ref
  useImperativeHandle(ref, () => ({
    getGraphData: () => ({
      nodes: graphData.nodes.map((node) => ({
        ...node,
        x: nodesRef.current[node.id]?.x || node.x || 0,
        y: nodesRef.current[node.id]?.y || node.y || 0,
        z: nodesRef.current[node.id]?.z || node.z || 0,
      })),
      links: graphData.links,
    }),
  }));

  // Mettre à jour les positions des nœuds
  useFrame(() => {
    graphData.nodes.forEach((node) => {
      if (
        node.x !== undefined &&
        node.y !== undefined &&
        node.z !== undefined
      ) {
        if (!nodesRef.current[node.id]) {
          nodesRef.current[node.id] = new Vector3(node.x, node.y, node.z);
        } else {
          nodesRef.current[node.id].set(node.x, node.y, node.z);
        }
      }
    });
  });

  // Calculer la profondeur maximale pour l'échelle des nœuds
  const maxDepth = Math.max(...graphData.nodes.map((node) => node.depth));

  return (
    <group>
      {/* Rendu des liens */}
      {graphData.links.map((link) => {
        const sourceNode = graphData.nodes.find((n) => n.id === link.source);
        const targetNode = graphData.nodes.find((n) => n.id === link.target);

        if (!sourceNode || !targetNode) return null;
        if (
          !sourceNode.x ||
          !sourceNode.y ||
          !sourceNode.z ||
          !targetNode.x ||
          !targetNode.y ||
          !targetNode.z
        )
          return null;

        // Créer une ligne droite simple entre les nœuds
        const positions = new Float32Array([
          sourceNode.x,
          sourceNode.y,
          sourceNode.z,
          targetNode.x,
          targetNode.y,
          targetNode.z,
        ]);

        return (
          <line key={`${link.source}-${link.target}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={positions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#ffffff"
              opacity={0.5}
              transparent
              linewidth={1}
            />
          </line>
        );
      })}

      {/* Rendu des nœuds */}
      {graphData.nodes.map((node) => {
        if (!node.x || !node.y || !node.z) return null;

        // Calculer la taille du nœud en fonction de sa profondeur
        const nodeSize = NODE_SIZE_BASE * Math.pow(NODE_SIZE_DECAY, node.depth);
        const color = NODE_COLORS[node.depth % NODE_COLORS.length];
        const intensity = Math.max(0.4, 1 - node.depth / maxDepth);

        return (
          <group key={node.id}>
            <mesh
              position={[node.x, node.y, node.z]}
              onClick={(e) => {
                e.stopPropagation();
                if (onNodeClick) onNodeClick(node);
              }}
            >
              <sphereGeometry args={[nodeSize, 32, 32]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={intensity}
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>
            {!node.isLeaf && (
              <Text
                position={[node.x, node.y + nodeSize * 2, node.z]}
                fontSize={nodeSize * 2}
                color={color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.2}
                outlineColor="#000000"
              >
                {node.name}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
});
