import {
  useEffect,
  useRef,
  useState,
  createContext,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useThree } from "@react-three/fiber";
import R3fForceGraph from "r3f-forcegraph";
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
export const ForceGraphUI = ({ graphRef, graphData, postsData }) => {
  // Accéder à l'état global pour connaître l'état d'animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cameraMode, setCameraMode] = useState("orbit");
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
  // Au lieu d'utiliser le contexte, utiliser les props
  // const { graphData, isLoadingGraph, graphError } = useData();
  const { graphData = { nodes: [], links: [] } } = props;
  const isLoadingGraph =
    !graphData || !graphData.nodes || graphData.nodes.length === 0;
  const graphError = props.graphError || null;

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

              // Propriétés de cluster à conserver
              const clusterProps = {
                cluster: node.cluster,
                offsetX: node.offsetX,
                offsetY: node.offsetY,
                offsetZ: node.offsetZ,
                // Conserver d'autres propriétés spécifiques au cluster si nécessaire
              };

              // Si le nœud a un objet associé avec position dans le graphe, l'utiliser
              if (nodeObj && nodeObj.position) {
                return {
                  ...node, // Conserver toutes les propriétés du nœud fusionné
                  ...clusterProps, // S'assurer que les propriétés de cluster sont préservées
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
                    ...clusterProps, // S'assurer que les propriétés de cluster sont préservées
                    x: d3Node.x || node.x || 0,
                    y: d3Node.y || node.y || 0,
                    z: d3Node.z || node.z || 0,
                  };
                }
              }

              // Dernier recours: utiliser les données disponibles dans le nœud
              return {
                ...node,
                ...clusterProps, // S'assurer que les propriétés de cluster sont préservées
                x: node.x || node.coordinates?.x || 0,
                y: node.y || node.coordinates?.y || 0,
                z: node.z || node.coordinates?.z || 0,
              };
            });
          }

          // Méthode de secours - si la méthode précédente ne fonctionne pas
          console.log("Utilisation des coordonnées existantes dans graphData");
          return graphData.nodes.map((node) => {
            // S'assurer que les propriétés de cluster sont préservées
            const clusterProps = {
              cluster: node.cluster,
              offsetX: node.offsetX,
              offsetY: node.offsetY,
              offsetZ: node.offsetZ,
              // Conserver d'autres propriétés spécifiques au cluster si nécessaire
            };

            return {
              ...node, // Utiliser directement les nœuds fusionnés
              ...clusterProps, // S'assurer que les propriétés de cluster sont préservées
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
            // S'assurer que les propriétés de cluster sont préservées
            const clusterProps = {
              cluster: node.cluster,
              offsetX: node.offsetX,
              offsetY: node.offsetY,
              offsetZ: node.offsetZ,
              // Conserver d'autres propriétés spécifiques au cluster si nécessaire
            };

            return {
              ...node, // Utiliser directement les nœuds fusionnés
              ...clusterProps, // S'assurer que les propriétés de cluster sont préservées
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

  // Définition des couleurs pour une référence constante
  const COLORS = {
    joshua: "#FF5733", // orange foncé pour Joshua
    character: "#3498DB", // bleu pour les personnages
    source: "#2ECC71", // vert pour les sources/plateformes
  };

  // Déterminer les connexions pour chaque nœud
  const getNodeConnections = useCallback(() => {
    if (!displayData || !displayData.nodes || !displayData.links) return {};

    const connections = {};

    // Initialiser le tableau de connexions pour chaque nœud
    displayData.nodes.forEach((node) => {
      connections[node.id] = [];
    });

    // Remplir les connexions basées sur les liens
    displayData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;

      if (connections[sourceId]) {
        connections[sourceId].push(targetId);
      }

      if (connections[targetId]) {
        connections[targetId].push(sourceId);
      }
    });

    return connections;
  }, [displayData]);

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
        linkOpacity={0.3}
        showNavInfo={false}
        cooldownTicks={1000}
        cooldownTime={5000}
        backgroundColor="#000000"
        // Paramètres ajustés pour gérer les mini-graphes
        d3AlphaDecay={0.01} // Valeur très faible pour donner plus de temps à la simulation
        d3VelocityDecay={0.5} // Plus de friction pour éviter que les nœuds ne s'éloignent trop
        d3AlphaMin={0.001}
        // Force de répulsion entre les nœuds réduite, graphe plus compact
        forceEngine="d3"
        dagMode={null}
        nodeRelSize={25} // Taille des nœuds relativement aux liens
        linkDirectionalParticles={0}
        // Utiliser notre propre positionnement initial des nœuds
        nodeVal={(node) => node.value || 1}
        nodeColor={(node) => {
          // Coloration basée sur le cluster pour distinguer les mini-graphes
          if (node.color) return node.color;

          const clusterColors = [
            "#e41a1c", // rouge
            "#377eb8", // bleu
            "#4daf4a", // vert
            "#984ea3", // violet
            "#ff7f00", // orange
            "#ffff33", // jaune
            "#a65628", // marron
            "#f781bf", // rose
            "#999999", // gris
            "#66c2a5", // turquoise
          ];

          if (node.cluster !== undefined) {
            return clusterColors[node.cluster % clusterColors.length];
          }

          return node.isJoshua
            ? COLORS.joshua
            : node.type === "platform"
            ? COLORS.source
            : COLORS.character;
        }}
        linkColor={(link) => {
          // Utiliser la couleur du nœud source pour le lien
          const sourceNode = displayData.nodes.find(
            (n) => n.id === link.source
          );
          if (sourceNode && sourceNode.cluster !== undefined) {
            const clusterColors = [
              "#e41a1c",
              "#377eb8",
              "#4daf4a",
              "#984ea3",
              "#ff7f00",
              "#ffff33",
              "#a65628",
              "#f781bf",
              "#999999",
              "#66c2a5",
            ];
            return clusterColors[sourceNode.cluster % clusterColors.length];
          }
          return "#aaaaaa";
        }}
        nodeAutoColorBy="cluster" // Coloration automatique par cluster
        // Positionnement initial des nœuds avec les offsets
        nodePositionUpdate={(node) => {
          // Si le nœud n'a pas encore de position définie
          if (
            node.x === undefined ||
            node.y === undefined ||
            node.z === undefined
          ) {
            if (
              node.offsetX !== undefined &&
              node.offsetY !== undefined &&
              node.offsetZ !== undefined
            ) {
              // Position initiale basée sur les offsets du cluster
              node.x = node.offsetX;
              node.y = node.offsetY;
              node.z = node.offsetZ;

              // Pour les plateformes, on ajoute une légère élévation (y) pour les placer "au-dessus"
              if (node.type === "platform") {
                node.y += 20; // Élever légèrement la plateforme
              }
              // Pour les caractères principaux (sans underscore dans l'ID), les placer au centre
              else if (node.type === "character" && !node.id.includes("_")) {
                // C'est un personnage central - le placer au centre de son cluster
              }
              // Pour les caractères secondaires (avec underscore dans l'ID), les placer en périphérie
              else if (node.type === "character") {
                // C'est un personnage connecté - créer une distribution radiale autour du centre
                const angle = Math.random() * Math.PI * 2; // Angle aléatoire
                const radius = 30 + Math.random() * 20; // Distance aléatoire du centre

                node.x += Math.cos(angle) * radius;
                node.z += Math.sin(angle) * radius;
              }

              // Ajouter une légère perturbation aléatoire pour éviter les superpositions
              node.x += (Math.random() - 0.5) * 10;
              node.y += (Math.random() - 0.5) * 10;
              node.z += (Math.random() - 0.5) * 10;
            }
          }
          return false; // ne pas remplacer la position calculée par force-directed algorithm
        }}
        d3Force={(engine) => {
          // Force de charge (répulsion entre nœuds)
          engine
            .force("charge")
            .strength((node) => (node.type === "platform" ? -30 : -40)) // Force de répulsion légèrement réduite pour les plateformes
            .distanceMax(100);

          // Force de centre pour maintenir le graphe dans le champ de vision
          engine.force("center").strength(0.05);

          // Force des liens pour garder les nœuds connectés ensemble
          engine.force("link").strength((link) => {
            // Identifier si un des nœuds est une plateforme
            const sourceNode = displayData.nodes.find(
              (n) =>
                n.id ===
                (typeof link.source === "object" ? link.source.id : link.source)
            );
            const targetNode = displayData.nodes.find(
              (n) =>
                n.id ===
                (typeof link.target === "object" ? link.target.id : link.target)
            );

            // Si le lien relie une plateforme et un personnage, force plus forte
            if (
              (sourceNode?.type === "platform" &&
                targetNode?.type === "character") ||
              (sourceNode?.type === "character" &&
                targetNode?.type === "platform")
            ) {
              return 0.7; // Force plus forte pour les liens plateforme-personnage
            }

            return 0.5; // Force standard pour les autres liens
          });

          // Force de collision pour éviter que les nœuds se superposent trop
          engine.force("collision", d3.forceCollide().radius(10).strength(0.7));

          // Force pour maintenir les plateformes en position intermédiaire entre les personnages
          engine.force("platformPositioning", (alpha) => {
            const connections = getNodeConnections();
            const strength = 0.2 * alpha;

            // Parcourir tous les nœuds de plateforme
            displayData.nodes.forEach((node) => {
              if (node.type !== "platform") return;

              // Récupérer tous les personnages connectés à cette plateforme
              const connectedCharacters =
                connections[node.id]?.filter((connId) => {
                  const connNode = displayData.nodes.find(
                    (n) => n.id === connId
                  );
                  return connNode && connNode.type === "character";
                }) || [];

              if (connectedCharacters.length < 2) return; // Besoin d'au moins 2 personnages

              // Calculer le centre entre les personnages connectés
              let centerX = 0,
                centerY = 0,
                centerZ = 0;
              let count = 0;

              connectedCharacters.forEach((charId) => {
                const charNode = displayData.nodes.find((n) => n.id === charId);
                if (
                  charNode &&
                  charNode.x !== undefined &&
                  charNode.y !== undefined &&
                  charNode.z !== undefined
                ) {
                  centerX += charNode.x;
                  centerY += charNode.y;
                  centerZ += charNode.z;
                  count++;
                }
              });

              if (count > 0) {
                centerX /= count;
                centerY /= count;
                centerZ /= count;

                // Déplacer la plateforme vers le centre des personnages, mais légèrement plus haut
                node.vx = (node.vx || 0) + (centerX - (node.x || 0)) * strength;
                node.vy =
                  (node.vy || 0) + (centerY + 15 - (node.y || 0)) * strength; // +15 pour élever légèrement
                node.vz = (node.vz || 0) + (centerZ - (node.z || 0)) * strength;
              }
            });
          });

          // Ajouter une force qui maintient les nœuds du même cluster ensemble
          engine.force("cluster", (alpha) => {
            const centroids = {};

            // Calculer les centres de chaque cluster
            displayData.nodes.forEach((node) => {
              if (node.cluster === undefined) return;

              if (!centroids[node.cluster]) {
                centroids[node.cluster] = { x: 0, y: 0, z: 0, count: 0 };
              }

              centroids[node.cluster].x += node.x || 0;
              centroids[node.cluster].y += node.y || 0;
              centroids[node.cluster].z += node.z || 0;
              centroids[node.cluster].count++;
            });

            // Normaliser les centroïdes
            Object.keys(centroids).forEach((cluster) => {
              const c = centroids[cluster];
              if (c.count > 0) {
                c.x /= c.count;
                c.y /= c.count;
                c.z /= c.count;
              }
            });

            // Appliquer une force pour attirer les nœuds vers le centre de leur cluster
            displayData.nodes.forEach((node) => {
              if (node.cluster === undefined) return;

              const centroid = centroids[node.cluster];
              if (!centroid) return;

              // Force réduite pour les plateformes pour leur permettre d'être positionnées entre les personnages
              const nodeStrength = node.type === "platform" ? 0.2 : 0.3;
              const strength = nodeStrength * alpha;

              node.vx =
                (node.vx || 0) + (centroid.x - (node.x || 0)) * strength;
              node.vy =
                (node.vy || 0) + (centroid.y - (node.y || 0)) * strength;
              node.vz =
                (node.vz || 0) + (centroid.z - (node.z || 0)) * strength;
            });
          });

          // Force de répulsion entre clusters
          engine.force("interCluster", (alpha) => {
            const repulsionStrength = 0.5 * alpha;
            const minDistance = 200; // Distance minimale entre centres de clusters

            // Calculer les centres de chaque cluster
            const centroids = {};
            displayData.nodes.forEach((node) => {
              if (node.cluster === undefined) return;

              if (!centroids[node.cluster]) {
                centroids[node.cluster] = { x: 0, y: 0, z: 0, count: 0 };
              }

              centroids[node.cluster].x += node.x || 0;
              centroids[node.cluster].y += node.y || 0;
              centroids[node.cluster].z += node.z || 0;
              centroids[node.cluster].count++;
            });

            // Normaliser les centroïdes
            Object.keys(centroids).forEach((cluster) => {
              const c = centroids[cluster];
              if (c.count > 0) {
                c.x /= c.count;
                c.y /= c.count;
                c.z /= c.count;
              }
            });

            // Appliquer répulsion entre clusters
            const clusters = Object.keys(centroids);
            for (let i = 0; i < clusters.length; i++) {
              for (let j = i + 1; j < clusters.length; j++) {
                const c1 = centroids[clusters[i]];
                const c2 = centroids[clusters[j]];

                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const dz = c2.z - c1.z;

                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (distance === 0) continue;

                // Calculer la force de répulsion
                const force = Math.min(
                  1,
                  Math.max(0, (minDistance - distance) / minDistance)
                );
                if (force <= 0) continue;

                const forceX = (dx / distance) * force * repulsionStrength;
                const forceY = (dy / distance) * force * repulsionStrength;
                const forceZ = (dz / distance) * force * repulsionStrength;

                // Appliquer la force à tous les nœuds des deux clusters
                displayData.nodes.forEach((node) => {
                  if (node.cluster === undefined) return;

                  if (node.cluster === parseInt(clusters[i])) {
                    node.vx = (node.vx || 0) - forceX;
                    node.vy = (node.vy || 0) - forceY;
                    node.vz = (node.vz || 0) - forceZ;
                  } else if (node.cluster === parseInt(clusters[j])) {
                    node.vx = (node.vx || 0) + forceX;
                    node.vy = (node.vy || 0) + forceY;
                    node.vz = (node.vz || 0) + forceZ;
                  }
                });
              }
            }
          });
        }}
        nodeThreeObject={(node) => createNodeObject(node)}
        linkThreeObject={(link) => {
          // Obtenir les positions réelles des nœuds
          const sourceNode =
            graphData.nodes.find((n) => n.id === link.source) || {};
          const targetNode =
            graphData.nodes.find((n) => n.id === link.target) || {};

          // Créer des positions avec des coordonnées par défaut mais valides
          const sourcePos = {
            x: sourceNode.x || 0,
            y: sourceNode.y || 0,
            z: sourceNode.z || 0,
            ...sourceNode, // Conserver les autres propriétés
          };

          const targetPos = {
            x: targetNode.x || 0,
            y: targetNode.y || 0,
            z: targetNode.z || 0,
            ...targetNode, // Conserver les autres propriétés
          };

          // Créer l'objet lien avec les positions des nœuds
          return createLinkObject(link, sourcePos, targetPos);
        }}
        linkPositionUpdate={(linkObj, { start, end }, link) => {
          // Log pour débogage

          // Mettre à jour la position du lien
          updateLinkPosition(linkObj, start, end);
          return true; // Indique que nous avons géré la mise à jour nous-mêmes
        }}
      />
    </ForceGraphContext.Provider>
  );
});

export default ForceGraphComponent;
