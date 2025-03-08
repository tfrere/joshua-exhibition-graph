import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useRef, useEffect, useCallback } from "react";
import { useControls } from "leva";
import CustomForceGraph from "./components/CustomForceGraph.jsx";
import PostsRenderer from "./components/PostRenderer/PostsRenderer.jsx";
import { useData } from "../../contexts/DataContext.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "../HomePage/components/AdvancedCameraController.jsx";
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

const WorkPage = () => {
  const {
    isLoadingGraph,
    isLoadingPosts,
    updatePostsPositions,
    graphData,
    postsData,
  } = useData();
  const graphInstanceRef = useRef(null);
  const positionsUpdatedOnceRef = useRef(false);

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
    perlinAmplitude: 12, // Augmenté pour plus de variation 3D
    dilatationFactor: 1.8,

    // Coloration des posts
    useUniqueColorsPerCharacter: true,

    // === PASSE 2: FLOWFIELD ===
    // Cette passe anime les positions des posts à travers un champ de vecteurs
    // pour créer des motifs organiques et naturels
    useFlowfield: true, // Active/désactive la passe flowfield
    flowFrames: 100,
    flowScale: 0.02,
    flowStrength: 5,

    // === PASSE 3: SPHERIZATION ===
    // Cette passe normalise les positions dans une sphère pour assurer
    // une distribution homogène et contenir l'ensemble dans un volume défini
    normalizeInSphere: true, // Active/désactive la passe spherization
    sphereRadius: 250,
    volumeExponent: 2 / 3, // 1/3 donne une distribution uniforme dans le volume
    minRadius: 0, // Distance minimum depuis le centre (10% du rayon)
    jitter: 0.2, // 20% de variation aléatoire pour éviter les motifs trop réguliers
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
          nodesWithPositions = graphData.nodes.map((node) => ({
            id: node.id,
            group: node.group || 0,
            name: node.name || "",
            x: node.coordinates?.x ?? node.x ?? 0,
            y: node.coordinates?.y ?? node.y ?? 0,
            z: node.coordinates?.z ?? node.z ?? 0,
            value: node.value || 1,
          }));
          console.log(
            `Récupéré ${nodesWithPositions.length} noeuds depuis graphData`
          );
        }
      }

      // 3. Préparer les liens depuis graphData
      if (graphData && graphData.links && graphData.links.length > 0) {
        links = graphData.links.map((link) => {
          // Extraction des IDs de source et cible
          const source =
            typeof link.source === "object" ? link.source.id : link.source;
          const target =
            typeof link.target === "object" ? link.target.id : link.target;

          return {
            source: source,
            target: target,
            value: link.value || 1,
            // Propriétés additionnelles sans le préfixe underscore
            isDirect: link._isDirect || link.isDirect,
            relationType: link._relationType || link.relationType,
            mediaImpact: link._mediaImpact || link.mediaImpact,
            virality: link._virality || link.virality,
            mediaCoverage: link._mediaCoverage || link.mediaCoverage,
            linkType: link._linkType || link.linkType,
          };
        });
        console.log(`Récupéré ${links.length} liens depuis graphData`);
      } else {
        console.log("Aucun lien disponible dans graphData");
      }

      // 4. Exporter le premier fichier (noeuds et liens)
      const spatializedNodesAndLinks = {
        nodes: nodesWithPositions || [],
        links: links || [],
      };

      console.log(
        `Export des nœuds: ${nodesWithPositions.length}, liens: ${links.length}`
      );
      downloadJSON(
        spatializedNodesAndLinks,
        "spatialized_nodes_and_links.data.json"
      );

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
    // Export supprimé des contrôles Leva
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
        if (graphInstanceRef.current) {
          // Vérifier si le graphe est déjà stabilisé
          if (graphInstanceRef.current.isStabilized()) {
            console.log("Graphe déjà stabilisé, mise à jour des positions...");
            const currentNodes = graphInstanceRef.current.getNodesPositions();
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
            graphInstanceRef.current.stabilize();
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

      {/* Bouton de debug pour forcer la spatialisation des posts */}
      <button
        className="spatialize-button"
        onClick={() => {
          console.log("Forçage manuel de la spatialisation des posts");
          if (graphInstanceRef.current) {
            const nodes = graphInstanceRef.current.getNodesPositions();
            console.log(`Utilisation de ${nodes.length} nœuds pour la spatialisation manuelle`);
            // Vérifie si les nœuds ont les propriétés requises
            if (nodes.length > 0) {
              console.log("Premier nœud:", {
                id: nodes[0].id,
                slug: nodes[0].slug,
                isJoshua: nodes[0].isJoshua,
                type: nodes[0].type,
                position: [nodes[0].x, nodes[0].y, nodes[0].z]
              });
            }
            updatePostsPositions({
              ...DEFAULT_POSTS_SPATIAL_CONFIG,
              customNodes: nodes,
            });
          } else {
            console.log("Aucune référence de graphe disponible, utilisation des paramètres par défaut");
            updatePostsPositions(DEFAULT_POSTS_SPATIAL_CONFIG);
          }
        }}
        style={{
          position: "absolute",
          top: "60px",
          right: "20px",
          padding: "10px 15px",
          backgroundColor: "#3f51b5",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        Forcer la spatialisation
      </button>

      {/* Canvas 3D avec les éléments 3D uniquement */}
      <Canvas camera={{ position: [0, 0, 500] }}>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          makeDefault={true}
        />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        {/* Contrôleur de caméra avancé avec modes orbite et vol */}
        <AdvancedCameraController config={cameraConfig} />
        <CustomForceGraph
          ref={getGraphRef}
          nodeSize={5}
          linkWidth={0.1}
          chargeStrength={-100}
          centerStrength={0.3}
          linkStrength={0.5}
          linkDistance={30}
          simulationSpeed={0.8}
          collisionStrength={1}
          cooldownTime={15000}
          onGraphStabilized={() => {
            console.log(
              "Le graphe est stabilisé, mise à jour des positions des posts..."
            );
            // Mise à jour automatique des positions lorsque le graphe est stabilisé
            if (!positionsUpdatedOnceRef.current) {
              console.log("Récupération des positions des nœuds depuis graphInstanceRef.current");
              const currentNodes = graphInstanceRef.current.getNodesPositions();
              console.log(`Récupéré ${currentNodes.length} nœuds avec leurs positions`);
              
              // Vérifier si les nœuds ont les propriétés requises pour la spatialisation
              if (currentNodes.length > 0) {
                const sampleNode = currentNodes[0];
                console.log("Exemple de nœud récupéré:", {
                  id: sampleNode.id,
                  slug: sampleNode.slug,
                  type: sampleNode.type,
                  isJoshua: sampleNode.isJoshua,
                  position: [sampleNode.x, sampleNode.y, sampleNode.z]
                });
              }
              
              console.log("Appel de updatePostsPositions avec les nœuds récupérés");
              updatePostsPositions({
                ...DEFAULT_POSTS_SPATIAL_CONFIG,
                customNodes: currentNodes,
              });
              positionsUpdatedOnceRef.current = true;
            }
          }}
        />
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

export default WorkPage;
