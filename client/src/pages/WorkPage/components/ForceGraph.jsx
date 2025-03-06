import { useEffect, useRef, useState, createContext } from "react";
import { useThree } from "@react-three/fiber";
import R3fForceGraph from "r3f-forcegraph";
import { useData } from "../../../contexts/DataContext";
import {
  createNodeObject,
  createLinkObject,
  updateLinkPosition,
} from "../utils/nodeUtils";
import { Html } from "@react-three/drei";

// Contexte pour l'affichage d'informations UI (simplifié)
export const ForceGraphContext = createContext(null);

// Composant UI simplifié
export const ForceGraphUI = () => {
  // Accéder à l'état global pour connaître l'état d'animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cameraMode, setCameraMode] = useState("orbit");

  // Écouter l'état d'animation et le mode exposés par le contrôleur de caméra
  useEffect(() => {
    // Créer une fonction pour écouter l'état d'animation et le mode
    const checkCameraState = () => {
      if (window.__cameraAnimating !== undefined) {
        setIsTransitioning(window.__cameraAnimating);
      }
      if (window.__cameraMode !== undefined) {
        setCameraMode(window.__cameraMode);
      }
    };

    // Vérifier régulièrement l'état d'animation
    const intervalId = setInterval(checkCameraState, 100);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        color: "white",
        padding: "10px",
        background: "rgba(0,0,0,0.5)",
        borderRadius: "5px",
        fontSize: "14px",
        zIndex: 1000,
        maxWidth: "300px",
      }}
    >
      <div style={{ marginBottom: "8px" }}>
        <strong>
          Mode: {cameraMode === "flight" ? "Vol libre" : "Orbite"}
        </strong>{" "}
        <span style={{ opacity: 0.7, fontSize: "12px" }}>
          (TAB pour changer)
        </span>
      </div>

      {isTransitioning ? (
        <div style={{ color: "#ffcc00" }}>Transition en cours...</div>
      ) : (
        <>
          {cameraMode === "flight" ? (
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              <p>
                <strong>Commandes de vol:</strong>
                <br />
                ZQSD/Flèches: Mouvement
                <br />
                E/Espace: Monter | C/Shift: Descendre
                <br />
                Q/E: Rotation | Z/X: Tangage | R/F: Roulis
              </p>
            </div>
          ) : (
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              <p>
                Utilisez ESPACE pour naviguer entre les positions prédéfinies
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Composant principal du graphe 3D - simplifié sans gestion de caméra ni nœuds
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

    // Créer ensuite les liens
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

    // Ensuite, s'assurer que tous les personnages Joshua sont connectés au nœud central
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

  // Vérifier si les données sont vraiment disponibles et complètes
  const dataIsReady =
    !isLoadingGraph &&
    displayData &&
    displayData.nodes &&
    displayData.links &&
    displayData.nodes.length > 0 &&
    displayData.links.length > 0;

  useEffect(() => {
    // Add animation/rotation
    let animationFrameId;

    const animate = () => {
      if (fgRef.current && dataIsReady) {
        fgRef.current.tickFrame();
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    if (dataIsReady) {
      animate();
    }

    return () => {
      // Clean up animation
      cancelAnimationFrame(animationFrameId);
    };
  }, [camera, dataIsReady]);

  // Afficher l'état de chargement directement dans la scène 3D
  if (!dataIsReady) {
    return (
      <Html center>
        <div style={{ color: "white", fontSize: "18px", textAlign: "center" }}>
          Chargement du graphe en cours...
        </div>
      </Html>
    );
  }

  // Afficher l'état d'erreur directement dans la scène 3D
  if (graphError) {
    return (
      <Html center>
        <div style={{ color: "red", fontSize: "18px", textAlign: "center" }}>
          Erreur de chargement: {graphError}
        </div>
      </Html>
    );
  }

  // Dans le contexte 3D, ne retourner que des éléments 3D !
  return (
    <ForceGraphContext.Provider value={{}}>
      <R3fForceGraph
        ref={fgRef}
        graphData={displayData}
        nodeLabel="name"
        linkOpacity={1}
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
        linkDirectionalParticles={0}
      />
    </ForceGraphContext.Provider>
  );
};

export default ForceGraphComponent;
