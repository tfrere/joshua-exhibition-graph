import React, { useState } from "react";
import { useFrame } from "@react-three/fiber";
import Node from "./Node";
import Link from "./Link";

// Main Graph component
const Graph = ({ data }) => {
  const [selectedNode, setSelectedNode] = useState(null);

  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
    console.log(`Node clicked: ${node.label}`);
  };

  // Create a lookup map for faster access to nodes by ID
  const nodeMap = {};
  data.nodes.forEach((node) => {
    nodeMap[node.id] = node;
  });

  return (
    <group>
      {/* Render all links */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        return (
          <Link
            key={`link-${link.id || `${link.source}-${link.target}-${index}`}`}
            link={link}
            sourceNode={sourceNode}
            targetNode={targetNode}
          />
        );
      })}

      {/* Render all nodes */}
      {data.nodes.map((node) => {
        node.size = 1.5;
        return (
          <Node
            key={`node-${node.id}`}
            node={node}
            onClick={handleNodeClick}
            isSelected={selectedNode === node.id}
          />
        );
      })}
    </group>
  );
};

export default Graph;
