import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Node from "./Node/Node";
import Link from "./Link/Link";

// Main Graph component
const Graph = ({ data, postsData }) => {
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

  // S'assurer que data contient des posts en les extrayant de postsData du contexte
  // Si postsData est disponible dans props, l'utiliser
  const posts = postsData || [];

  // Calculer les profondeurs des nœuds
  const calculateNodeDepths = useMemo(() => {
    const depths = {};

    // Trouver le nœud Joshua ou un nœud central
    let rootNodeId = null;

    // Chercher le nœud marqué comme isJoshua ou un nœud avec un label spécifique
    for (const node of data.nodes) {
      if (node.isJoshua || node.label === "Joshua") {
        rootNodeId = node.id;
        break;
      }
    }

    // Si pas de nœud Joshua trouvé, utiliser le premier nœud comme racine
    if (rootNodeId === null && data.nodes.length > 0) {
      rootNodeId = data.nodes[0].id;
    }

    // Si toujours pas de nœud racine, retourner un objet vide
    if (rootNodeId === null) {
      return {};
    }

    // Attribuer une profondeur de 0 au nœud racine
    depths[rootNodeId] = 0;

    // Files d'attente pour l'algorithme BFS
    let queue = [rootNodeId];
    let visited = new Set([rootNodeId]);

    // Algorithme de parcours en largeur (BFS) pour calculer les profondeurs
    while (queue.length > 0) {
      const currentId = queue.shift();
      const currentDepth = depths[currentId];

      // Trouver tous les nœuds adjacents
      for (const link of data.links) {
        let neighborId = null;

        if (link.source === currentId) {
          neighborId = link.target;
        } else if (link.target === currentId) {
          neighborId = link.source;
        }

        // Si voisin trouvé et pas encore visité
        if (neighborId && !visited.has(neighborId)) {
          depths[neighborId] = currentDepth + 1;
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    return depths;
  }, [data.nodes, data.links]);

  // Log pour déboguer
  useEffect(() => {
    console.log("Graph - Données reçues:", data);
    console.log("Graph - Posts disponibles:", posts.length);
    if (posts.length > 0) {
      console.log("Graph - Exemple de post:", posts[0]);
    }
    console.log("Graph - Profondeurs des nœuds:", calculateNodeDepths);
  }, [data, posts, calculateNodeDepths]);

  return (
    <group>
      {/* Render all links */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        // Calculer la profondeur du lien en fonction des profondeurs des nœuds
        const sourceDepth = calculateNodeDepths[link.source] || 0;
        const targetDepth = calculateNodeDepths[link.target] || 0;

        // La profondeur du lien est la moyenne des profondeurs de ses extrémités
        const depth = Math.max(sourceDepth, targetDepth);

        // Utiliser ArcLink pour les liens courbes ou Link pour les liens droits
        // Vous pouvez choisir en fonction d'une propriété du lien ou d'une autre logique
        // Compostant ArcLink supprimé, utilisation de Link
        // const LinkComponent = link.style === "arc" ? ArcLink : Link;
        const LinkComponent = Link;

        return (
          <LinkComponent
            key={`link-${index}`}
            link={link}
            sourceNode={sourceNode}
            targetNode={targetNode}
            // Vous pouvez personnaliser l'intensité de l'arc pour les liens ArcLink
            // Gestion de l'arcHeight laissée dans le composant Link
            // arcHeight={link.arcHeight || 0.3}
            arcHeight={0.5}
            opacity={0.1}
            depth={depth}
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
            depth={calculateNodeDepths[node.id] || 0}
          />
        );
      })}
    </group>
  );
};

export default Graph;
