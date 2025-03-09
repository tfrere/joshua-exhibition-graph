import React, { useState, useRef, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import MovableNode from "./MovableNode";

// Composant pour un simple trait entre deux nœuds
const SimpleLine = ({ sourceNode, targetNode, color = "#FFFFFF" }) => {
  const lineRef = useRef();

  // Mettre à jour la position de la ligne à chaque frame pour suivre les nœuds
  useFrame(() => {
    if (lineRef.current) {
      // Mettre à jour la géométrie de la ligne
      const points = [
        new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
        new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z),
      ];

      // Recréer la géométrie de la ligne avec les nouvelles positions
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lineRef.current.geometry.dispose();
      lineRef.current.geometry = geometry;
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry
        attach="geometry"
        args={[
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
            new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z),
          ]),
        ]}
      />
      <lineBasicMaterial
        attach="material"
        color={color}
        linewidth={1}
        transparent={true}
        opacity={0.6}
      />
    </line>
  );
};

// Composant principal du graphe
const MovableGraph = ({ data }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const controlsRef = useRef();
  const { camera } = useThree();

  // Gérer le clic sur un nœud
  const handleNodeClick = (node) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
    console.log(`Node clicked: ${node.label || node.name}`);
  };

  // Mettre à jour la position d'un nœud
  const updateNodePosition = (nodeId, newPosition) => {
    setNodePositions((prev) => ({
      ...prev,
      [nodeId]: newPosition,
    }));
  };

  // Créer une map pour accéder rapidement aux nœuds par ID
  const nodeMap = {};
  data.nodes.forEach((node) => {
    // Appliquer les positions personnalisées si elles existent
    if (nodePositions[node.id]) {
      node.x = nodePositions[node.id].x;
      node.y = nodePositions[node.id].y;
      node.z = nodePositions[node.id].z;
    }
    nodeMap[node.id] = node;
  });

  return (
    <group>
      {/* Contrôles de caméra */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        target={[0, 0, 0]}
      />

      {/* Rendu de tous les liens avec des traits simples */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        // Définir une couleur pour le lien (basée sur la relation ou une valeur par défaut)
        const linkColor = link.color || "#FFFFFF";

        return (
          <SimpleLine
            key={`link-${link.id || `${link.source}-${link.target}-${index}`}`}
            sourceNode={sourceNode}
            targetNode={targetNode}
            color={linkColor}
          />
        );
      })}

      {/* Rendu de tous les nœuds */}
      {data.nodes.map((node) => {
        node.size = 1;
        return (
          <MovableNode
            key={`node-${node.id}`}
            node={node}
            onClick={handleNodeClick}
            isSelected={selectedNode === node.id}
            onPositionUpdate={(newPos) => updateNodePosition(node.id, newPos)}
            controlsRef={controlsRef}
          />
        );
      })}
    </group>
  );
};

export default MovableGraph;
