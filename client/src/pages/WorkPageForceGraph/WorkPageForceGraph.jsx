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
    // postsData non utilisé, commenté pour éviter l'erreur de linter
    // postsData,
  } = useData();
  const graphInstanceRef = useRef(null);
  const positionsUpdatedOnceRef = useRef(false);

  // Utiliser useCallback pour stabiliser cette fonction
  const getGraphRef = useCallback((instance) => {
    if (instance) {
      // console.log("Référence du graphe obtenue");
      console.log("[CYCLE DE VIE] Référence du graphe obtenue - Instance CustomForceGraph montée");
      graphInstanceRef.current = instance;
    }
  }, []);

  // Log du cycle de vie du composant
  useEffect(() => {
    console.log("[CYCLE DE VIE] WorkPageForceGraph monté - Démarrage de l'application");
    
    return () => {
      console.log("[CYCLE DE VIE] WorkPageForceGraph démonté - Nettoyage de l'application");
    };
  }, []);

  // Observer les changements dans graphData
  useEffect(() => {
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      console.log(`[CYCLE DE VIE] Données du graphe reçues: ${graphData.nodes.length} nœuds`);
    }
  }, [graphData]);

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
    if (!graphInstanceRef.current) {
      // console.log("Référence du graphe non disponible");
      console.log("[CYCLE DE VIE] Tentative d'export mais référence du graphe non disponible");
      return;
    }

    // console.log("Exportation des positions spatiales des nœuds");
    console.log("[CYCLE DE VIE] Exportation des positions spatiales des nœuds");
    const spatializedNodes = graphInstanceRef.current.getNodesPositions();
    downloadJSON(spatializedNodes, "exported-graph-positions.json");
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
      }, 10000); // Attendre 5 secondes pour être sûr que le graphe est rendu

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
          chargeStrength={-150}
          centerStrength={1}
          linkStrength={0.7}
          linkDistance={40}
          simulationSpeed={0.5}
          collisionStrength={0.01}
          cooldownTime={8000}
          onGraphStabilized={() => {
            console.log("[CYCLE DE VIE] Le graphe est stabilisé, mise à jour des positions des posts");
            
            // Mise à jour automatique des positions lorsque le graphe est stabilisé
            if (!positionsUpdatedOnceRef.current) {
              console.log("[CYCLE DE VIE] Récupération des positions finales des nœuds pour les posts");
              const currentNodes = graphInstanceRef.current.getNodesPositions();
              console.log(`[CYCLE DE VIE] ${currentNodes.length} nœuds récupérés avec leurs positions finales`);
              
              // Vérifier si les nœuds ont les propriétés requises pour la spatialisation
              if (currentNodes.length > 0) {
                const sampleNode = currentNodes[0];
                console.log(`[CYCLE DE VIE] Position finale du premier nœud: (${sampleNode.x.toFixed(2)}, ${sampleNode.y.toFixed(2)}, ${sampleNode.z.toFixed(2)})`);
              }
              
              console.log("[CYCLE DE VIE] Mise à jour des positions des posts avec les positions finales des nœuds");
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
