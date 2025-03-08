import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useRef, useEffect } from "react";
import { useControls, folder, button } from "leva";
import { ForceGraphUI } from "./components/ForceGraph/ForceGraph.jsx";
import ForceGraph from "./components/ForceGraph/ForceGraph.jsx";
import CustomForceGraph from "./components/CustomForceGraph.jsx";
import PostsRenderer from "./components/PostRenderer/PostsRenderer.jsx";
import { useData } from "../../contexts/DataContext.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

const WorkPage = () => {
  const { isLoadingGraph, isLoadingPosts, updatePostsPositions } = useData();
  const forceGraphRef = useRef(null);
  const positionsUpdatedOnceRef = useRef(false);

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
    normalizeInSphere: false, // Active/désactive la passe spherization
    sphereRadius: 250,
    volumeExponent: 2 / 3, // 1/3 donne une distribution uniforme dans le volume
    minRadius: 0, // Distance minimum depuis le centre (10% du rayon)
    jitter: 0.2, // 20% de variation aléatoire pour éviter les motifs trop réguliers
  };

  // Configurer tous les contrôles avec Leva
  const { debug, backgroundColor, cameraConfig } = useControls({
    debug: true,
    backgroundColor: "#000000",
  });

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
      {/* Interface utilisateur en dehors du Canvas */}
      <ForceGraphUI />

      {/* Indicateur de connexion de manette */}
      <GamepadIndicator />

      {/* Canvas 3D avec les éléments 3D uniquement */}
      <Canvas camera={{ position: [0, 0, 500] }}>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        {/* Contrôleur de caméra avancé avec modes orbite et vol */}
        <AdvancedCameraController config={cameraConfig} />
        <CustomForceGraph
          ref={forceGraphRef}
          nodeSize={5}
          linkWidth={0.5}
          chargeStrength={-500}
          centerStrength={1}
          linkStrength={2}
          linkDistance={70}
          simulationSpeed={0.1}
          collisionStrength={5}
          cooldownTime={5000}
          onGraphStabilized={() => {
            console.log(
              "Le graphe est stabilisé, mise à jour des positions des posts..."
            );
            // Mise à jour automatique des positions lorsque le graphe est stabilisé
            if (!positionsUpdatedOnceRef.current) {
              const currentNodes = forceGraphRef.current.getNodesPositions();
              updatePostsPositions({
                ...DEFAULT_POSTS_SPATIAL_CONFIG,
                customNodes: currentNodes,
              });
              positionsUpdatedOnceRef.current = true;
            }
          }}
        />
        {/* <ForceGraph /> */}
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
