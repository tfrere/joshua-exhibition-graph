import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useRef, useEffect, useState, useCallback } from "react";
import { useControls, folder, button } from "leva";
import { ForceGraphUI } from "./components/ForceGraph/ForceGraph.jsx";
import ForceGraph from "./components/ForceGraph/ForceGraph.jsx";
import PostsRenderer from "./components/PostRenderer/PostsRenderer.jsx";
import { useData } from "../../contexts/DataContext.jsx";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// Fonction utilitaire pour télécharger un fichier JSON
const downloadJSON = (content, fileName) => {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const WorkPostPage = () => {
  const {
    isLoadingGraph,
    isLoadingPosts,
    updatePostsPositions,
    graphData,
    postsData,
  } = useData();
  const forceGraphRef = useRef(null);
  const positionsUpdatedOnceRef = useRef(false);

  // Utiliser useRef au lieu de useState pour éviter les re-rendus
  const graphInstanceRef = useRef(null);

  // Utiliser useCallback pour stabiliser cette fonction
  const getGraphRef = useCallback((instance) => {
    if (instance) {
      console.log("Référence du graphe obtenue");
      graphInstanceRef.current = instance;
    }
  }, []);

  // Configuration par défaut pour la spatialisation des posts
  const DEFAULT_POSTS_SPATIAL_CONFIG = {
    joshuaOnly: true,
    preserveOtherPositions: true,
    // Paramètres de positionnement
    radius: 60,
    minDistance: 40,
    verticalSpread: 1.5, // Augmentation pour une meilleure distribution verticale
    horizontalSpread: 1.5,

    // === PASSE 1: VORONOI (bvoronoi) ===
    // Cette passe applique une dilatation des positions autour des nœuds
    // centraux avec un effet voronoi, qui crée des clusters distincts
    useVoronoi: true, // Active/désactive la passe bvoronoi
    perlinScale: 0.05,
    perlinAmplitude: 1, // Augmenté pour plus de variation 3D
    dilatationFactor: 1.2,

    // Coloration des posts
    useUniqueColorsPerCharacter: true,

    // === PASSE 2: FLOWFIELD ===
    // Cette passe anime les positions des posts à travers un champ de vecteurs
    // pour créer des motifs organiques et naturels
    useFlowfield: false, // Active/désactive la passe flowfield
    flowFrames: 100,
    flowScale: 0.02,
    flowStrength: 5,

    // === PASSE 3: SPHERIZATION ===
    // Cette passe normalise les positions dans une sphère pour assurer
    // une distribution homogène et contenir l'ensemble dans un volume défini
    normalizeInSphere: false, // Active/désactive la passe spherization
    sphereRadius: 250,
    volumeExponent: 2 / 3, // 1/3 donne une distribution uniforme dans le volume
    minRadius: 0, // Distance minimum depuis le centre (10% du rayon)
    jitter: 0.2, // 20% de variation aléatoire pour éviter les motifs trop réguliers

    // === PASSE 4: DISPLACEMENT ===
    // Cette passe applique un déplacement radial basé sur du bruit de Perlin
    // pour créer une texture organique à la surface de la sphère
    useDisplacement: false, // Active/désactive la passe displacement
    displacementIntensity: 15, // Intensité du déplacement
    displacementFrequency: 0.08, // Fréquence du bruit de Perlin
    displacementSeed: 42, // Valeur de graine pour le bruit
    displacementMinRadius: 0, // Rayon minimal à préserver
  };

  // Fonction pour exporter les données spatialisées
  const exportSpatializedData = () => {
    console.log("Début de l'exportation...");
    console.log("État actuel des données:");
    console.log("- graphData:", graphData);
    console.log("- postsData:", postsData);
    console.log("- graphInstance:", graphInstanceRef.current);

    // Vérifier si les données sont disponibles
    const hasGraphData =
      graphData && graphData.nodes && graphData.nodes.length > 0;
    const hasPostsData =
      postsData && Array.isArray(postsData) && postsData.length > 0;

    if (!hasGraphData) {
      console.warn("Aucune donnée de graphe à exporter");
      alert(
        "Attention: Aucune donnée de graphe disponible. Les données exportées seront vides."
      );
    }

    if (!hasPostsData) {
      console.warn("Aucune donnée de posts à exporter");
      alert(
        "Attention: Aucune donnée de posts disponible. Les données exportées seront vides."
      );
    }

    // Procéder à l'exportation même si les données sont vides (créer des fichiers vides)
    try {
      console.log("Démarrage de l'export...");

      // Création de l'export des nœuds et liens
      // ------------------------------------------------
      let nodesWithPositions = [];
      let links = [];

      // 1. Tenter d'utiliser la référence du graphe si disponible
      const useGraphRef =
        graphInstanceRef.current &&
        typeof graphInstanceRef.current.getNodesPositions === "function";

      if (useGraphRef) {
        console.log("Utilisation de la référence du graphe pour l'exportation");
        try {
          // Récupérer les positions des noeuds directement depuis le graphe
          nodesWithPositions = graphInstanceRef.current.getNodesPositions();
          console.log(
            `Récupéré ${
              nodesWithPositions?.length || 0
            } noeuds depuis la référence du graphe`
          );
        } catch (err) {
          console.error("Erreur lors de la récupération des noeuds:", err);
          nodesWithPositions = [];
        }
      }

      // 2. Si les noeuds sont vides, utiliser la méthode de secours avec les données du contexte
      if (!nodesWithPositions || nodesWithPositions.length === 0) {
        console.log("Méthode de secours pour les noeuds");

        if (hasGraphData) {
          nodesWithPositions = graphData.nodes.map((node) => {
            // Créer un objet qui contient toutes les propriétés du nœud
            return {
              id: node.id,
              group: node.group || 0,
              name: node.name || "",
              x: node.coordinates?.x ?? node.x ?? 0,
              y: node.coordinates?.y ?? node.y ?? 0,
              z: node.coordinates?.z ?? node.z ?? 0,
              value: node.value || 1,
              type: node.type,
              isJoshua: node.isJoshua,
              // Inclure toutes les autres propriétés directement
              slug: node.slug,
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
            };
          });
          console.log(
            `Récupéré ${nodesWithPositions.length} noeuds depuis graphData`
          );
        }
      }

      // // 3. Préparer les liens depuis graphData
      // if (graphData && graphData.links && graphData.links.length > 0) {
      //   links = graphData.links.map((link) => {
      //     // Extraction des IDs de source et cible
      //     const source =
      //       typeof link.source === "object" ? link.source.id : link.source;
      //     const target =
      //       typeof link.target === "object" ? link.target.id : link.target;

      //     return {
      //       source: source,
      //       target: target,
      //       value: link.value || 1,
      //       // Propriétés additionnelles sans le préfixe underscore
      //       isDirect: link._isDirect || link.isDirect,
      //       relationType: link._relationType || link.relationType,
      //       mediaImpact: link._mediaImpact || link.mediaImpact,
      //       virality: link._virality || link.virality,
      //       mediaCoverage: link._mediaCoverage || link.mediaCoverage,
      //       linkType: link._linkType || link.linkType,
      //     };
      //   });
      //   console.log(`Récupéré ${links.length} liens depuis graphData`);
      // } else {
      //   console.log("Aucun lien disponible dans graphData");
      // }

      // // 4. Exporter le premier fichier (noeuds et liens)
      // const spatializedNodesAndLinks = {
      //   nodes: nodesWithPositions || [],
      //   links: links || [],
      // };

      // console.log(
      //   `COMMENTEE POUR LINSTANT : Export des nœuds: ${nodesWithPositions.length}, liens: ${links.length}`
      // );
      // downloadJSON(
      //   spatializedNodesAndLinks,
      //   "spatialized_nodes_and_links.data.json"
      // );

      // Création de l'export des posts
      // ------------------------------------------------
      let spatializedPosts = [];

      // 5. Préparer les données des posts si disponibles
      if (hasPostsData) {
        spatializedPosts = postsData.map((post) => {
          const coords = post.coordinates || {};

          return {
            id: post.id,
            postUID: post.postUID || post.id, // Ajout de postUID, avec fallback sur id si non disponible
            slug: post.slug || "",
            impact: post.impact || 0,
            x: coords.x || 0,
            y: coords.y || 0,
            z: coords.z || 0,
            // isJoshuaCharacter supprimé
          };
        });
        console.log(`Préparé ${spatializedPosts.length} posts pour l'export`);
      }

      // 6. Exporter le deuxième fichier (posts)
      console.log(`Export des posts: ${spatializedPosts.length}`);
      downloadJSON(spatializedPosts, "spatialized_posts.data.json");

      // 7. Afficher un message de confirmation
      alert(`Exportation terminée!
- Noeuds: ${nodesWithPositions.length}
- Liens: ${links.length} 
- Posts: ${spatializedPosts.length}`);
    } catch (error) {
      console.error("Erreur pendant l'exportation:", error);
      alert(`Erreur pendant l'exportation: ${error.message}`);
    }
  };

  // Configurer tous les contrôles avec Leva en dehors de la fonction de render
  const levaControls = useControls({
    debug: true,
    backgroundColor: "#000000",

    // Options de spatialisation
    spatialisation: folder({
      // Options pour la passe Voronoi
      voronoi: folder({
        useVoronoi: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.useVoronoi,
          label: "Activer Voronoi",
        },
        perlinScale: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.perlinScale,
          min: 0.01,
          max: 0.2,
          step: 0.01,
          label: "Échelle Perlin",
        },
        perlinAmplitude: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.perlinAmplitude,
          min: 0,
          max: 20,
          step: 0.5,
          label: "Amplitude Perlin",
        },
        dilatationFactor: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.dilatationFactor,
          min: 0.5,
          max: 3,
          step: 0.1,
          label: "Facteur de dilatation",
        },
      }),

      // Options pour la passe Flowfield
      flowfield: folder({
        useFlowfield: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.useFlowfield,
          label: "Activer Flowfield",
        },
        flowFrames: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.flowFrames,
          min: 10,
          max: 200,
          step: 10,
          label: "Nombre de frames",
        },
        flowScale: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.flowScale,
          min: 0.001,
          max: 0.1,
          step: 0.001,
          label: "Échelle du flow",
        },
        flowStrength: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.flowStrength,
          min: 0.1,
          max: 20,
          step: 0.1,
          label: "Force du flow",
        },
      }),

      // Options pour la passe Spherization
      spherization: folder({
        normalizeInSphere: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.normalizeInSphere,
          label: "Activer Sphérisation",
        },
        sphereRadius: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.sphereRadius,
          min: 50,
          max: 500,
          step: 10,
          label: "Rayon de la sphère",
        },
        volumeExponent: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.volumeExponent,
          min: 0.1,
          max: 1,
          step: 0.05,
          label: "Exposant volumique",
        },
        jitter: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.jitter,
          min: 0,
          max: 0.5,
          step: 0.05,
          label: "Variation aléatoire",
        },
      }),

      // Options pour la passe Displacement
      displacement: folder({
        useDisplacement: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.useDisplacement,
          label: "Activer Displacement",
        },
        displacementIntensity: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.displacementIntensity,
          min: 0,
          max: 50,
          step: 1,
          label: "Intensité",
        },
        displacementFrequency: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.displacementFrequency,
          min: 0.01,
          max: 0.5,
          step: 0.01,
          label: "Fréquence",
        },
        displacementSeed: {
          value: DEFAULT_POSTS_SPATIAL_CONFIG.displacementSeed,
          min: 1,
          max: 100,
          step: 1,
          label: "Seed",
        },
      }),

      // Bouton pour appliquer les modifications
      appliquer: button(() => {
        console.log("Application des paramètres de spatialisation");
        if (graphInstanceRef.current) {
          const nodes = graphInstanceRef.current.getNodesPositions();
          updatePostsPositions({
            ...DEFAULT_POSTS_SPATIAL_CONFIG,
            // Substituer les valeurs des contrôles Leva
            useVoronoi: levaControls.useVoronoi,
            perlinScale: levaControls.perlinScale,
            perlinAmplitude: levaControls.perlinAmplitude,
            dilatationFactor: levaControls.dilatationFactor,

            useFlowfield: levaControls.useFlowfield,
            flowFrames: levaControls.flowFrames,
            flowScale: levaControls.flowScale,
            flowStrength: levaControls.flowStrength,

            normalizeInSphere: levaControls.normalizeInSphere,
            sphereRadius: levaControls.sphereRadius,
            volumeExponent: levaControls.volumeExponent,
            jitter: levaControls.jitter,

            useDisplacement: levaControls.useDisplacement,
            displacementIntensity: levaControls.displacementIntensity,
            displacementFrequency: levaControls.displacementFrequency,
            displacementSeed: levaControls.displacementSeed,

            customNodes: nodes,
          });
        } else {
          updatePostsPositions({
            ...DEFAULT_POSTS_SPATIAL_CONFIG,
            // Substituer les valeurs des contrôles Leva
            useVoronoi: levaControls.useVoronoi,
            perlinScale: levaControls.perlinScale,
            perlinAmplitude: levaControls.perlinAmplitude,
            dilatationFactor: levaControls.dilatationFactor,

            useFlowfield: levaControls.useFlowfield,
            flowFrames: levaControls.flowFrames,
            flowScale: levaControls.flowScale,
            flowStrength: levaControls.flowStrength,

            normalizeInSphere: levaControls.normalizeInSphere,
            sphereRadius: levaControls.sphereRadius,
            volumeExponent: levaControls.volumeExponent,
            jitter: levaControls.jitter,

            useDisplacement: levaControls.useDisplacement,
            displacementIntensity: levaControls.displacementIntensity,
            displacementFrequency: levaControls.displacementFrequency,
            displacementSeed: levaControls.displacementSeed,
          });
        }
      }),
    }),
  });

  const { debug, backgroundColor, cameraConfig } = levaControls;

  // Mettre à jour automatiquement les positions des posts après le chargement des données
  useEffect(() => {
    // Vérifier que ni le graphe ni les posts ne sont en cours de chargement
    if (
      !isLoadingGraph &&
      !isLoadingPosts &&
      !positionsUpdatedOnceRef.current
    ) {
      console.log(
        "Données entièrement chargées, planification de la mise à jour des positions..."
      );

      // Attendre que le rendu du graphe soit terminé avant de mettre à jour
      const timer = setTimeout(() => {
        console.log("Vérification de la stabilisation du graphe...");
        // Ne mettre à jour que si la référence du graphe est disponible
        if (forceGraphRef.current) {
          // Vérifier si le graphe est déjà stabilisé
          if (forceGraphRef.current.isStabilized()) {
            console.log("Graphe déjà stabilisé, mise à jour des positions...");
            const currentNodes = forceGraphRef.current.getNodesPositions();
            console.log(
              `Récupération de ${currentNodes.length} nœuds pour la spatialisation`
            );
            updatePostsPositions({
              ...DEFAULT_POSTS_SPATIAL_CONFIG,
              customNodes: currentNodes,
            });
            positionsUpdatedOnceRef.current = true;
          } else {
            // Forcer la stabilisation puis mettre à jour
            console.log(
              "Stabilisation du graphe puis mise à jour des positions..."
            );
            forceGraphRef.current.stabilize();
            // La mise à jour sera déclenchée par le callback onGraphStabilized
          }
        } else {
          console.warn(
            "Référence du graphe non disponible, mise à jour classique..."
          );
          updatePostsPositions(DEFAULT_POSTS_SPATIAL_CONFIG);
          positionsUpdatedOnceRef.current = true;
        }
      }, 5000); // Attendre 5 secondes pour être sûr que le graphe est rendu

      return () => clearTimeout(timer);
    }
  }, [isLoadingGraph, isLoadingPosts, updatePostsPositions]);

  return (
    <div className="canvas-container">
      {/* Bouton d'exportation */}
      <button
        className="export-button"
        onClick={exportSpatializedData}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "10px 15px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        Exporter les données JSON
      </button>

      {/* Canvas 3D avec les éléments 3D uniquement */}
      <Canvas camera={{ position: [0, 0, 500] }}>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        <OrbitControls enablePan={true} enableZoom={true} makeDefault={true} />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        <ForceGraph ref={getGraphRef} />
        <PostsRenderer />
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.5}
          />
          {/* <Pixelation
            granularity={3} // pixel granularity
          /> */}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default WorkPostPage;
