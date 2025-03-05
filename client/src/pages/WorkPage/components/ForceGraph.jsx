import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import R3fForceGraph from "r3f-forcegraph";
import { useData } from "../../../contexts/DataContext";
import {
  createNodeObject,
  createLinkObject,
  updateLinkPosition,
} from "../utils/nodeUtils";

const ForceGraphComponent = () => {
  const { graphData, isLoadingGraph, graphError } = useData();
  const fgRef = useRef();
  const { camera } = useThree();

  // Function to generate random graph data (used as fallback when error loading)
  const generateRandomGraph = () => {
    // Créer d'abord les nœuds
    const nodes = [...Array(10).keys()].map((i) => ({
      id: i === 0 ? "central-joshua" : `node-${i}`,
      name: i === 0 ? "Joshua Goldberg" : `Node ${i}`,
      type:
        i === 0
          ? "central-joshua"
          : i % 3 === 0
          ? "source"
          : i % 2 === 0
          ? "character"
          : "contact",
      isJoshua: i === 0 || i === 5,
      slug:
        i === 0
          ? "real-joshua-goldberg"
          : i === 5
          ? "joshua-alt"
          : i % 2 === 0
          ? `char-${i}`
          : null,
    }));

    // Créer ensuite les liens, en s'assurant que tous les personnages Joshua sont connectés au nœud central
    const links = [];

    // D'abord, ajouter des liens aléatoires
    for (let i = 0; i < 15; i++) {
      const source = Math.floor(Math.random() * 10);
      const target = Math.floor(Math.random() * 10);
      if (source !== target) {
        links.push({
          source: nodes[source].id,
          target: nodes[target].id,
          value: Math.random(),
        });
      }
    }

    // Ensuite, s'assurer que tous les personnages avec isJoshua=true sont connectés au nœud central
    nodes.forEach((node, index) => {
      if (index > 0) {
        // Ignorer le nœud central lui-même
        if (
          node.isJoshua ||
          node.slug === "real-joshua-goldberg" ||
          node.slug === "joshua-alt"
        ) {
          // Vérifier si le lien n'existe pas déjà
          const linkExists = links.some(
            (link) =>
              (link.source === "central-joshua" && link.target === node.id) ||
              (link.target === "central-joshua" && link.source === node.id)
          );

          if (!linkExists) {
            links.push({
              source: "central-joshua",
              target: node.id,
              value: 0.8, // Lien fort pour les personnages Joshua
            });
          }
        }
      }
    });

    return { nodes, links };
  };

  // Déterminer quelles données afficher (données réelles ou données de secours)
  const displayData =
    graphError || !graphData ? generateRandomGraph() : graphData;

  useEffect(() => {
    // Position camera to see the graph
    camera.position.z = 200;

    // Add animation/rotation
    const animate = () => {
      if (fgRef.current) {
        fgRef.current.tickFrame();
      }
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      // Clean up animation
      if (fgRef.current) {
        fgRef.current.pauseAnimation();
      }
    };
  }, [camera]);

  // Afficher le statut de chargement
  if (isLoadingGraph && (!displayData || displayData.nodes.length === 0)) {
    console.log("Chargement des données du graphe...");
  }

  // Afficher l'état d'erreur
  if (graphError) {
    console.error("Échec du chargement des données du graphe:", graphError);
  }

  return (
    <R3fForceGraph
      ref={fgRef}
      graphData={displayData}
      nodeLabel="name"
      nodeRelSize={5}
      linkWidth={1}
      linkOpacity={0.5}
      showNavInfo={false}
      cooldownTicks={3000}
      cooldownTime={3000}
      backgroundColor="#000000"
      nodeThreeObject={(node) => createNodeObject(node)}
      linkThreeObject={(link) => {
        // Créer une position temporaire pour les liens, sera mise à jour à chaque frame
        const pos = {
          source: { x: 0, y: 0, z: 0 },
          target: { x: 0, y: 0, z: 0 },
        };
        return createLinkObject(link, pos.source, pos.target);
      }}
      linkPositionUpdate={(linkObj, { start, end }, link) => {
        updateLinkPosition(linkObj, start, end);
        return true; // Indique que nous avons géré la mise à jour nous-mêmes
      }}
      d3VelocityDecay={0.3} // Légère réduction pour une animation plus fluide
      d3AlphaDecay={0.02} // Réduction pour que le graphe trouve une position stable plus lentement
      linkDirectionalParticles={0}
      linkDirectionalParticleWidth={1.5}
      linkDirectionalParticleSpeed={0.008}
      onNodeClick={(node) => {
        // Zoom sur le nœud lorsqu'il est cliqué
        const distance = 50;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        camera.position.set(
          node.x * distRatio,
          node.y * distRatio,
          node.z * distRatio
        );
      }}
    />
  );
};

export default ForceGraphComponent;
