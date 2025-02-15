import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import ForceGraph from "r3f-forcegraph";

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
}

interface GraphLink {
  source: number;
  target: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const MAX_NODES = 1000;

// Function to convert tree data to graph format
const convertTreeToGraph = (treeData: TreeNode): GraphData => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  let nodeCount = 0;

  const processNode = (node: TreeNode): boolean => {
    if (nodeCount >= MAX_NODES) return false;

    nodes.push({
      id: node.uid,
      name: node.name || `Node ${node.uid}`,
      depth: node.depth,
    });
    nodeCount++;

    if (node.children) {
      for (const child of node.children) {
        if (nodeCount >= MAX_NODES) break;

        const shouldContinue = processNode(child);
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

  processNode(treeData);
  console.log(
    `Graph généré avec ${nodes.length} nœuds et ${links.length} liens`
  );
  return { nodes, links };
};

export default function Graph() {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });

  useEffect(() => {
    fetch("/data/hierarchy.json")
      .then((response) => response.json())
      .then((treeData: TreeNode) => {
        const convertedData = convertTreeToGraph(treeData);
        setGraphData(convertedData);
      })
      .catch((error) => console.error("Error loading graph data:", error));
  }, []);

  useFrame(() => {
    // @ts-ignore
    fgRef.current?.tickFrame();
  });

  return (
    <ForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeColor={(node: GraphNode) => {
        const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeead"];
        return colors[node.depth % colors.length];
      }}
      linkColor={() => "rgba(255,255,255,1)"}
      nodeRelSize={8}
      linkWidth={2}
      linkDirectionalParticles={0}
      linkDirectionalParticleWidth={4}
      linkDirectionalParticleSpeed={0.005}
      linkDirectionalParticleColor={() => "rgba(255,255,255,1)"}
      d3VelocityDecay={0.3}
      d3AlphaDecay={0.01}
      warmupTicks={100}
      cooldownTicks={50}
      nodeResolution={8}
    />
  );
}
