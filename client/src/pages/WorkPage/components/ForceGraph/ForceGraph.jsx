import {
  useEffect,
  useRef,
  useState,
  createContext,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useThree } from "@react-three/fiber";
import R3fForceGraph from "r3f-forcegraph";
import { useData } from "../../../../contexts/DataContext";
import {
  createNodeObject,
  createLinkObject,
  updateLinkPosition,
} from "./utils/nodeUtils";
import { Html } from "@react-three/drei";
import * as d3 from "d3";

// Contexte pour l'affichage d'informations UI (simplifié)
export const ForceGraphContext = createContext(null);

// Fonction utilitaire pour exporter des données JSON en fichier téléchargeable
const exportJsonFile = (data, filename) => {
  // Convertir les données en chaîne JSON formatée
  const jsonString = JSON.stringify(data, null, 2);

  // Créer un blob avec le contenu JSON
  const blob = new Blob([jsonString], { type: "application/json" });

  // Créer une URL pour le blob
  const url = URL.createObjectURL(blob);

  // Créer un élément <a> pour le téléchargement
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // Ajouter l'élément au DOM, cliquer dessus, puis le supprimer
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libérer l'URL
  URL.revokeObjectURL(url);
};

// Composant UI simplifié
export const ForceGraphUI = ({ graphRef }) => {
  // Accéder à l'état global pour connaître l'état d'animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cameraMode, setCameraMode] = useState("orbit");
  const { graphData, postsData } = useData();
  const [showExportButton, setShowExportButton] = useState(false);

  // Fonction pour nettoyer les données avant export
  const cleanForExport = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    // Créer une copie sans référence
    const cleanObj = Array.isArray(obj) ? [...obj] : { ...obj };

    // Supprimer les clés non désirées
    if (!Array.isArray(cleanObj)) {
      delete cleanObj.__threeObj;
      delete cleanObj.__indexArrayBuffer;
      delete cleanObj.__colorArrayBuffer;
      delete cleanObj.__lineHighlightArrayBuffer;

      // Supprimer toutes les clés commençant par __ (objets internes)
      Object.keys(cleanObj).forEach((key) => {
        if (key.startsWith("__")) {
          delete cleanObj[key];
        }
      });
    }

    // Nettoyer récursivement les sous-objets
    if (Array.isArray(cleanObj)) {
      return cleanObj.map((item) => cleanForExport(item));
    } else {
      // Nettoyer chaque propriété de l'objet qui est aussi un objet
      Object.keys(cleanObj).forEach((key) => {
        if (cleanObj[key] && typeof cleanObj[key] === "object") {
          cleanObj[key] = cleanForExport(cleanObj[key]);
        }
      });
      return cleanObj;
    }
  };

  // Fonction pour exporter les données spatiales
  const handleExportData = () => {
    // 1. Exporter les noeuds et liens spatialisés avec positions les plus récentes
    if (graphRef && graphRef.current && graphRef.current.getNodesPositions) {
      // Utiliser la méthode getNodesPositions du graphe pour avoir les positions les plus récentes
      const spatializedNodes = graphRef.current.getNodesPositions();

      const spatializedNodesAndLinks = {
        nodes: spatializedNodes,
        links: graphData.links.map((link) => ({
          source:
            typeof link.source === "object" ? link.source.id : link.source,
          target:
            typeof link.target === "object" ? link.target.id : link.target,
          value: link.value || 1,
        })),
      };

      // Nettoyer les données avant l'export
      const cleanedData = cleanForExport(spatializedNodesAndLinks);

      console.log(
        "Exportation de spatialized_nodes_and_links.json avec",
        cleanedData.nodes.length,
        "noeuds"
      );
      exportJsonFile(cleanedData, "spatialized_nodes_and_links.json");
    } else if (graphData && graphData.nodes && graphData.links) {
      // Fallback si la référence n'est pas disponible
      const spatializedNodesAndLinks = {
        nodes: graphData.nodes.map((node) => ({
          id: node.id,
          slug: node.slug,
          x: node.x,
          y: node.y,
          z: node.z,
          isJoshua: node.isJoshua,
          type: node.type,
          // Inclure toutes les autres propriétés directement
          biography: node.biography,
          mostViralContent: node.mostViralContent,
          displayName: node.displayName,
          aliases: node.aliases,
          fictionOrImpersonation: node.fictionOrImpersonation,
          platform: node.platform,
          thematic: node.thematic,
          career: node.career,
          genre: node.genre,
          polarisation: node.polarisation,
          cercle: node.cercle,
          politicalSphere: node.politicalSphere,
          sources: node.sources,
          totalPosts: node.totalPosts,
          hasEnoughPostsToUseInFrequencyPosts:
            node.hasEnoughPostsToUseInFrequencyPosts,
          hasEnoughTextToMakeWordcloud: node.hasEnoughTextToMakeWordcloud,
          topWords: node.topWords,
        })),
        links: graphData.links.map((link) => ({
          source:
            typeof link.source === "object" ? link.source.id : link.source,
          target:
            typeof link.target === "object" ? link.target.id : link.target,
          value: link.value || 1,
        })),
      };

      // Nettoyer les données avant l'export
      const cleanedData = cleanForExport(spatializedNodesAndLinks);

      console.log(
        "Exportation de spatialized_nodes_and_links.json avec méthode de secours"
      );
      exportJsonFile(cleanedData, "spatialized_nodes_and_links.json");
    }

    // 2. Exporter les posts spatialisés
    if (postsData && postsData.length > 0) {
      const spatializedPosts = postsData.map((post) => ({
        id: post.id,
        slug: post.slug,
        content: post.content,
        date: post.date,
        x: post.coordinates.x,
        y: post.coordinates.y,
        z: post.coordinates.z,
        isJoshuaCharacter: post.isJoshuaCharacter,
        color: post.color,
      }));

      // Nettoyer les données avant l'export
      const cleanedPosts = cleanForExport(spatializedPosts);

      console.log(
        "Exportation de spatialized_posts.json avec",
        cleanedPosts.length,
        "posts"
      );
      exportJsonFile(cleanedPosts, "spatialized_posts.json");
    }

    // Afficher un message de confirmation
    alert("Exportation des données terminée !");
  };

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

  // Afficher le bouton d'export une fois que les données sont chargées et spatialisées
  useEffect(() => {
    if (
      graphData &&
      graphData.nodes &&
      graphData.nodes.length > 0 &&
      graphData.nodes[0].x !== undefined &&
      postsData &&
      postsData.length > 0 &&
      postsData[0].coordinates &&
      postsData[0].coordinates.x !== undefined
    ) {
      setShowExportButton(true);
    }
  }, [graphData, postsData]);

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

      {/* Bouton d'exportation des données spatiales */}
      {showExportButton && (
        <button
          onClick={handleExportData}
          style={{
            marginTop: "15px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            padding: "8px 12px",
            textAlign: "center",
            textDecoration: "none",
            display: "inline-block",
            fontSize: "14px",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Exporter données spatialisées
        </button>
      )}
    </div>
  );
};

// Composant principal du graphe 3D - simplifié sans gestion de caméra ni nœuds
const ForceGraphComponent = forwardRef((props, ref) => {
  const { graphData, isLoadingGraph, graphError } = useData();
  const fgRef = useRef();

  // Exposer des méthodes via la référence
  useImperativeHandle(
    ref,
    () => ({
      // Méthode pour récupérer les positions des noeuds
      getNodesPositions: () => {
        console.log(
          "Récupération des positions des noeuds depuis la référence"
        );
        if (!fgRef.current || !graphData || !graphData.nodes) {
          console.warn(
            "Impossible de récupérer les positions des noeuds - références manquantes"
          );
          return [];
        }

        try {
          // Accéder au graphe interne pour récupérer les positions
          const graphInstance = fgRef.current;
          console.log("Contenu de fgRef.current:", graphInstance);

          // Vérifier si le graphInstance a déjà des objets avec des positions
          if (graphInstance.__nodeObjects) {
            console.log("Utilisation des nodeObjects internes");
            const nodeObjects = graphInstance.__nodeObjects;

            // Utiliser directement les nœuds du graphData qui sont déjà fusionnés
            // et ajouter les positions du graphInstance
            return graphData.nodes.map((node) => {
              const nodeObj = nodeObjects[node.id];

              // Si le nœud a un objet associé avec position dans le graphe, l'utiliser
              if (nodeObj && nodeObj.position) {
                return {
                  ...node, // Conserver toutes les propriétés du nœud fusionné
                  x: nodeObj.position.x,
                  y: nodeObj.position.y,
                  z: nodeObj.position.z,
                };
              }

              // Fallback aux données du graphe d3
              if (
                graphInstance.graphData &&
                graphInstance.graphData.nodes &&
                graphInstance.graphData.nodes.length > 0
              ) {
                const d3Node = graphInstance.graphData.nodes.find(
                  (n) => n.id === node.id
                );
                if (d3Node) {
                  return {
                    ...node, // Conserver toutes les propriétés du nœud fusionné
                    x: d3Node.x || node.x || 0,
                    y: d3Node.y || node.y || 0,
                    z: d3Node.z || node.z || 0,
                  };
                }
              }

              // Dernier recours: utiliser les données disponibles dans le nœud
              return {
                ...node,
                x: node.x || node.coordinates?.x || 0,
                y: node.y || node.coordinates?.y || 0,
                z: node.z || node.coordinates?.z || 0,
              };
            });
          }

          // Méthode de secours - si la méthode précédente ne fonctionne pas
          console.log("Utilisation des coordonnées existantes dans graphData");
          return graphData.nodes.map((node) => {
            return {
              ...node, // Utiliser directement les nœuds fusionnés
              x: node.x || node.coordinates?.x || 0,
              y: node.y || node.coordinates?.y || 0,
              z: node.z || node.coordinates?.z || 0,
            };
          });
        } catch (error) {
          console.error("Erreur lors de la récupération des positions:", error);
          console.log(
            "Utilisation de la méthode de secours avec les données du contexte"
          );

          // Dernier recours: utiliser les données du contexte directement
          return graphData.nodes.map((node) => {
            return {
              ...node, // Utiliser directement les nœuds fusionnés
              x: node.x || node.coordinates?.x || 0,
              y: node.y || node.coordinates?.y || 0,
              z: node.z || node.coordinates?.z || 0,
            };
          });
        }
      },

      // Indique si le graphe est stabilisé
      isStabilized: () => {
        return fgRef.current
          ? !fgRef.current.d3Force("simulation")?.alpha()
          : false;
      },

      // Force la stabilisation du graphe
      stabilize: () => {
        if (fgRef.current) {
          const simulation = fgRef.current.d3Force("simulation");
          if (simulation) {
            simulation.alpha(0); // Set alpha to 0 to stop the simulation
            simulation.stop();
          }
        }
      },
    }),
    [graphData]
  ); // Ajouter graphData comme dépendance pour s'assurer que les méthodes sont mises à jour

  // Déterminer quelles données afficher (données réelles ou données de secours)
  const displayData = graphError || !graphData ? null : graphData;

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
  }, [dataIsReady]);

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
        // Paramètres de force pour un graphe plus aéré
        d3AlphaDecay={0.1} // Valeur réduite pour ralentir la stabilisation (défaut: 0.0228)
        d3VelocityDecay={0.1} // Valeur réduite pour moins de friction (défaut: 0.4)
        d3AlphaMin={0.01} // Valeur légèrement augmentée pour une meilleure convergence (défaut: 0)
        // Force de répulsion entre les nœuds augmentée
        forceEngine="ngraph"
        dagMode="lr"
        d3Force={(engine) => {
          engine
            .force("charge")
            .strength(10) // Force de répulsion augmentée (valeur négative plus élevée)
            .distanceMax(100); // Distance maximale d'effet de la répulsion

          // Ajouter une force de collision pour éviter que les nœuds se chevauchent trop
          engine.force("collision", d3.forceCollide().radius(1));
        }}
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
});

export default ForceGraphComponent;
