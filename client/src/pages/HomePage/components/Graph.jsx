import React, { useState, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Node from "./Node";
import { Link, ArcLink } from "./Link";
import {
  activeNodeRef,
  joshuaNodesRef,
  updateActiveNode,
  initSocketSync,
} from "./activeNodeRef";

// Composant qui gère la détection du noeud le plus proche de la caméra
const NearestNodeDetector = ({ nodes }) => {
  const { camera } = useThree();
  const prevNearestNodeRef = React.useRef(null);
  // Limiter les mises à jour pour améliorer les performances
  const frameCountRef = React.useRef(0);
  const UPDATE_INTERVAL = 1; // Nombre de frames entre chaque mise à jour
  const targetPositionRef = useRef(new THREE.Vector3());

  // Initialiser la connexion socket
  useEffect(() => {
    initSocketSync();
  }, []);

  useFrame(() => {
    if (!nodes || nodes.length === 0) return;

    // Mettre à jour uniquement toutes les X frames pour optimiser les performances
    frameCountRef.current += 1;
    if (frameCountRef.current % UPDATE_INTERVAL !== 0) return;

    // Position de la caméra
    const cameraPosition = camera.position.clone();

    // Créer un point situé 20 unités devant la caméra dans la direction où elle regarde
    const targetPosition = new THREE.Vector3();

    // Direction dans laquelle la caméra regarde (vecteur unitaire)
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);

    // Calcul de la position cible: position caméra + (direction * distance)
    targetPosition.copy(cameraPosition);
    targetPosition.addScaledVector(cameraDirection, 50); // 20 unités devant dans la direction de la caméra

    // Mettre à jour la référence de position pour la sphère
    targetPositionRef.current.copy(targetPosition);

    // Debug visuel (optionnel)
    // console.log("Position caméra:", cameraPosition);
    // console.log("Position cible:", targetPosition);

    // Trouver le noeud le plus proche
    let nearestNode = null;
    let minDistance = Infinity;

    // Parcourir tous les noeuds avec isJoshua=true
    const joshuaNodes = [];

    nodes.forEach((node) => {
      // Vérifier si le nœud a la propriété isJoshua à true
      if (node.isJoshua !== true) return;

      const nodePosition = new THREE.Vector3(
        node.x || 0,
        node.y || 0,
        node.z || 0
      );

      // Éviter de créer des objets inutiles pour chaque frame
      const nodeWithPosition = {
        ...node,
        position: { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
      };

      joshuaNodes.push(nodeWithPosition);

      // Calculer la distance entre le point cible et le noeud
      const distance = targetPosition.distanceTo(nodePosition);

      // Mettre à jour le noeud le plus proche
      if (distance < minDistance) {
        minDistance = distance;
        nearestNode = node;
      }
    });

    // Mettre à jour le joshuaNodesRef moins fréquemment
    if (frameCountRef.current % (UPDATE_INTERVAL * 5) === 0) {
      joshuaNodesRef.current = joshuaNodes;
    }

    // Si le noeud le plus proche a changé, le logger et mettre à jour la référence partagée
    if (
      nearestNode &&
      (!prevNearestNodeRef.current ||
        prevNearestNodeRef.current.id !== nearestNode.id)
    ) {
      console.log("Noeud actif le plus proche:", nearestNode);
      prevNearestNodeRef.current = nearestNode;

      // Mettre à jour la référence partagée et envoyer via socket
      updateActiveNode(nearestNode);
    }
  });

  // Composant de la sphère cible
  const TargetSphere = () => {
    const sphereRef = useRef();

    // Mettre à jour la position de la sphère à chaque frame
    useFrame(() => {
      if (sphereRef.current) {
        sphereRef.current.position.copy(targetPositionRef.current);
      }
    });

    return (
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="red" transparent={true} opacity={0.7} />
      </mesh>
    );
  };

  // Rendu de la sphère cible
  return <TargetSphere />;
};

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
      {/* Détecteur de noeud le plus proche */}
      <NearestNodeDetector nodes={data.nodes} />

      {/* Render all links */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        // Utiliser ArcLink pour les liens courbes ou Link pour les liens droits
        // Vous pouvez choisir en fonction d'une propriété du lien ou d'une autre logique
        const LinkComponent = link.style === "arc" ? ArcLink : Link;

        return (
          <LinkComponent
            key={`link-${index}`}
            link={link}
            sourceNode={sourceNode}
            targetNode={targetNode}
            // Vous pouvez personnaliser l'intensité de l'arc pour les liens ArcLink
            arcHeight={link.arcHeight || 0.3}
          />
        );
      })}

      {/* Render all nodes */}
      {data.nodes.map((node) => {
        node.size = 1;
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
