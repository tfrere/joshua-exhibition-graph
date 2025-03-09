import React, { useState, useRef, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import MovableNode from "./MovableNode";

// Composant pour une ligne avec flèche directionnelle entre deux nœuds
const ArrowLine = ({ sourceNode, targetNode, color = "#FFFFFF" }) => {
  const lineRef = useRef();
  const arrowRef = useRef();
  const arrowSize = 1; // Taille de la flèche

  // Mettre à jour la position de la ligne et de la flèche à chaque frame
  useFrame(() => {
    if (lineRef.current && arrowRef.current) {
      // Points pour la ligne
      const sourcePoint = new THREE.Vector3(
        sourceNode.x,
        sourceNode.y,
        sourceNode.z
      );
      const targetPoint = new THREE.Vector3(
        targetNode.x,
        targetNode.y,
        targetNode.z
      );

      // Mettre à jour la géométrie de la ligne
      const points = [sourcePoint, targetPoint];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lineRef.current.geometry.dispose();
      lineRef.current.geometry = geometry;

      // Calculer la direction et position pour la flèche
      const direction = new THREE.Vector3()
        .subVectors(targetPoint, sourcePoint)
        .normalize();
      const arrowPosition = new THREE.Vector3().addVectors(
        sourcePoint,
        new THREE.Vector3().copy(direction).multiplyScalar(
          sourcePoint.distanceTo(targetPoint) * 0.7 // Positionner la flèche à 70% du chemin
        )
      );

      // Orienter la flèche dans la direction du lien
      arrowRef.current.position.copy(arrowPosition);

      // Calculer la rotation pour que la flèche pointe dans la bonne direction
      const quaternion = new THREE.Quaternion();
      // Rotation nécessaire pour que le cône pointe le long de l'axe Z
      quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), // Orientation par défaut du cône (axe Y)
        direction // Direction vers le nœud cible
      );
      arrowRef.current.setRotationFromQuaternion(quaternion);
    }
  });

  return (
    <group>
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
          opacity={0.8}
        />
      </line>
      <mesh
        ref={arrowRef}
        position={[
          sourceNode.x + (targetNode.x - sourceNode.x) * 0.7,
          sourceNode.y + (targetNode.y - sourceNode.y) * 0.7,
          sourceNode.z + (targetNode.z - sourceNode.z) * 0.7,
        ]}
      >
        <coneGeometry
          args={[arrowSize * 0.5, arrowSize, 8]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
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

      {/* Rendu de tous les liens avec des flèches directionnelles */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        // Définir une couleur pour le lien (basée sur la relation ou une valeur par défaut)
        const linkColor = link.color || "#FFFFFF";

        return (
          <ArrowLine
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
