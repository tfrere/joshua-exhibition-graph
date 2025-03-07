import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useRef, useEffect } from "react";
import { useControls, folder, button } from "leva";
import { ForceGraphUI } from "./components/ForceGraph";
import CustomForceGraph from "./components/CustomForceGraph";
import PostsRenderer from "../../components/PostsRenderer";
import { useData } from "../../contexts/DataContext";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";
import { DEFAULT_FLIGHT_CONFIG } from "./utils/advancedCameraControls";
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
    // Paramètres de l'algorithme Voronoi
    perlinScale: 0.05,
    perlinAmplitude: 12, // Augmenté pour plus de variation 3D
    dilatationFactor: 1.8,
    // Coloration des posts
    useUniqueColorsPerCharacter: true,
    // Paramètres du flowfield
    useFlowfield: true,
    flowFrames: 100,
    flowScale: 0.02,
    flowStrength: 5,
    // Paramètres de normalisation sphérique
    normalizeInSphere: true,
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

  // Ajouter des contrôles pour le graphe dans le panneau Leva
  const graphControls = useControls({
    "Contrôles du Graphe": folder({
      "Paramètres 3D": folder({
        chargeStrength: {
          value: -100,
          min: -300,
          max: -10,
          step: 10,
          label: "Force de répulsion"
        },
        linkDistance: {
          value: 60,
          min: 10,
          max: 150,
          step: 5,
          label: "Distance des liens"
        },
        zStrength: {
          value: 2.0,
          min: 0,
          max: 5,
          step: 0.1,
          label: "Force Z (3D)"
        },
        simulationSpeed: {
          value: 0.5,
          min: 0.1,
          max: 1.0,
          step: 0.05,
          label: "Vitesse de simulation"
        },
        onChange: () => {
          if (forceGraphRef.current) {
            console.log("Mise à jour des paramètres 3D du graphe");
          }
        }
      }),
      "Stabiliser manuellement": button(() => {
        if (forceGraphRef.current) {
          forceGraphRef.current.stabilize();
          console.log("Graphe stabilisé manuellement");
        }
      }),
      "Mettre à jour les positions après stabilisation": button(() => {
        // Vérifier que les données ne sont pas en cours de chargement avant de mettre à jour
        if (isLoadingGraph || isLoadingPosts) {
          console.warn("Impossible de mettre à jour les positions : chargement des données en cours");
          return;
        }
        
        // Vérifier si le graphe est stabilisé
        if (forceGraphRef.current && forceGraphRef.current.isStabilized()) {
          console.log("Mise à jour des positions des posts après stabilisation du graphe");
          // Récupérer les positions actuelles des nœuds
          const currentNodes = forceGraphRef.current.getNodesPositions();
          updatePostsPositions({
            ...DEFAULT_POSTS_SPATIAL_CONFIG,
            // Fournir les positions des nœuds à jour
            customNodes: currentNodes
          });
        } else {
          console.warn("Le graphe n'est pas encore stabilisé");
        }
      }),
    }),
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
            console.log(`Récupération de ${currentNodes.length} nœuds pour la spatialisation`);
            updatePostsPositions({
              ...DEFAULT_POSTS_SPATIAL_CONFIG,
              customNodes: currentNodes
            });
            positionsUpdatedOnceRef.current = true;
          } else {
            // Forcer la stabilisation puis mettre à jour
            console.log("Stabilisation du graphe puis mise à jour des positions...");
            forceGraphRef.current.stabilize();
            // La mise à jour sera déclenchée par le callback onGraphStabilized
          }
        } else {
          console.warn("Référence du graphe non disponible, mise à jour classique...");
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

        {/* Nouveau composant de graphe personnalisé */}
        <CustomForceGraph 
          ref={forceGraphRef}
          nodeSize={5}
          linkWidth={0.5}
          chargeStrength={graphControls.chargeStrength}
          centerStrength={0.05}
          linkStrength={0.7}
          linkDistance={graphControls.linkDistance}
          zStrength={graphControls.zStrength}
          simulationSpeed={graphControls.simulationSpeed}
          collisionStrength={5}
          cooldownTime={10000}
          onGraphStabilized={() => {
            console.log("Le graphe est stabilisé, mise à jour des positions des posts...");
            // Mise à jour automatique des positions lorsque le graphe est stabilisé
            if (!positionsUpdatedOnceRef.current) {
              const currentNodes = forceGraphRef.current.getNodesPositions();
              updatePostsPositions({
                ...DEFAULT_POSTS_SPATIAL_CONFIG,
                customNodes: currentNodes
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
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default WorkPage;
