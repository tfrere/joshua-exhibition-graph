import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useRef, useEffect, useState, useCallback } from "react";
import { useControls, folder, button } from "leva";
import PostsRenderer from "./components/PostRenderer/PostsRenderer.jsx";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { spatializePostsAroundJoshuaNodes } from "./components/PostRenderer/utils/voronoiPass.js";
import { normalizePostsInSphere } from "./components/PostRenderer/utils/spherizePass.js";
import { animatePostsInFlowfield } from "./components/PostRenderer/utils/flowfieldPass.js";
import { applyRadialDisplacement } from "./components/PostRenderer/utils/displacementPass.js";
import { spatializePostsAroundJoshuaNodesVND } from "./components/PostRenderer/utils/voronoiWithDisplacementPass.js";

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

// Fonction simple pour charger un fichier JSON
const loadJSON = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Erreur lors du chargement de ${url}:`, error);
    return null;
  }
};

/**
 * Génère une couleur unique basée sur une chaîne (comme un identifiant character)
 * @param {string|number} character - L'identifiant du personnage
 * @param {number} saturation - Saturation de la couleur (0-1, défaut: 0.8)
 * @param {number} luminance - Luminosité de la couleur (0-1, défaut: 0.5)
 * @returns {Array} Tableau RGB normalisé [r, g, b] avec des valeurs entre 0 et 1
 */
function generateColorFromCharacter(character, saturation = 0.8, luminance = 0.6) {
  if (!character) {
    // Couleur par défaut si pas de character
    return [0.8, 0.8, 0.8]; // Gris clair
  }
  
  // Convertir le character en chaîne si ce n'est pas déjà le cas
  const charString = String(character);
  
  // Calculer un nombre de hachage simple pour la chaîne
  let hash = 0;
  for (let i = 0; i < charString.length; i++) {
    hash = charString.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convertir le hash en une valeur de teinte (0-360)
  const hue = Math.abs(hash % 360);
  
  // Convertir HSL en RGB
  const h = hue / 360;
  const s = saturation;
  const l = luminance;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // Niveaux de gris
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [r, g, b];
}

// Composant simple pour afficher les nœuds comme des sphères rouges
const SimpleNodes = ({ nodes }) => {
  if (!nodes || nodes.length === 0) return null;

  return (
    <group>
      {nodes.map((node) => (
        <mesh key={node.id} position={[node.x || 0, node.y || 0, node.z || 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="red" />
        </mesh>
      ))}
    </group>
  );
};

const WorkPostPage = () => {
  const [postsData, setPostsData] = useState([]);
  const [nodesData, setNodesData] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingNodes, setIsLoadingNodes] = useState(true);
  const [processedPosts, setProcessedPosts] = useState([]);

  // Configuration par défaut pour la spatialisation des posts
  const DEFAULT_POSTS_SPATIAL_CONFIG = {
    // Paramètres généraux (utilisés principalement par la passe voronoi)
    joshuaOnly: false, // Traiter TOUS les posts, pas seulement ceux de Joshua
    preserveOtherPositions: false, // Ne pas préserver les positions existantes - on veut tout spatialiser
    radius: 60,
    minDistance: 40,
    verticalSpread: 1.5,
    horizontalSpread: 1.5,

    // Paramètre de coloration (utilisé par spatializePostsAroundJoshuaNodes)
    useUniqueColorsPerCharacter: true,

    // Option pour mettre à jour la visualisation après chaque passe (expérimental)
    updateAfterEachPass: false,

    // Passes de traitement dans l'ordre d'exécution
    passes: [
      {
        name: "voronoi",
        enabled: false, // Activer la passe voronoi pour spatialiser tous les posts
        config: {
          secondPass: false, // Activer la passe 2 (voronoi)
          perlinScale: 0.05,
          perlinAmplitude: 1,
          dilatationFactor: 1.2,
        },
      },
      {
        name: "vnp",
        enabled: true, // Activer la passe voronoi pour spatialiser tous les posts
        config: {
          secondPass: true, // Activer la passe 2 (voronoi)
          perlinScale: 0.05,
          perlinAmplitude: 1,
          dilatationFactor: 1.2,
          thirdPass: false, // Activer la passe 3 (displacement)
          displacementIntensity: 10,
          displacementFrequency: 0.05,
          displacementSeed: 42,
        },
      },
      {
        name: "flowfield",
        enabled: false, // Désactiver flowfield pour le moment
        config: {
          frames: 100,
          flowScale: 0.02,
          flowStrength: 5,
        },
      },
      {
        name: "spherize",
        enabled: false, // Désactiver spherize pour le moment
        config: {
          sphereRadius: 250,
          volumeExponent: 2 / 3,
          minRadius: 0,
          jitter: 0.2,
        },
      },
      {
        name: "displacement",
        enabled: false,
        config: {
          intensity: 1000,
          frequency: 0.2,
          seed: 42,
          minRadius: 5,
        },
      },
    ],
  };

  // Charger les données au chargement du composant
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingPosts(true);
      setIsLoadingNodes(true);

      // Charger les nœuds
      const nodesAndLinks = await loadJSON(
        "/data/spatialized_nodes_and_links.data.json"
      );
      if (nodesAndLinks && nodesAndLinks.nodes) {
        setNodesData(nodesAndLinks.nodes);
      }
      setIsLoadingNodes(false);

      // Charger les posts
      const posts = await loadJSON("/data/posts.data.json");
      if (posts) {
        setPostsData(posts);
      }
      setIsLoadingPosts(false);
    };

    fetchData();
  }, []);

  // Traiter les posts lorsque les données sont chargées
  useEffect(() => {
    const processPosts = async () => {
      if (
        isLoadingPosts ||
        isLoadingNodes ||
        postsData.length === 0 ||
        nodesData.length === 0
      ) {
        return;
      }

      console.log("Démarrage du traitement des posts...");
      await processPostsWithPasses(
        postsData,
        nodesData,
        DEFAULT_POSTS_SPATIAL_CONFIG,
        setProcessedPosts
      );
    };

    processPosts();
  }, [isLoadingPosts, isLoadingNodes, postsData, nodesData]);

  // Fonction pour traiter les posts avec les différentes passes
  const processPostsWithPasses = async (
    posts,
    nodes,
    options,
    updateCallback
  ) => {
    try {
      console.log("=== DÉBUT DU PROCESSUS DE SPATIALISATION AVEC PASSES ===");
      console.log(
        `Démarrage avec ${posts.length} posts et ${nodes.length} nœuds`
      );

      // Initialiser tous les posts avec des coordonnées par défaut si nécessaire
      let processedPosts = posts.map((post) => {
        // Créer une copie profonde pour éviter de modifier les originaux
        const newPost = JSON.parse(JSON.stringify(post));

        // Assurer que les coordonnées sont définies
        if (newPost.x === undefined) newPost.x = 0;
        if (newPost.y === undefined) newPost.y = 0;
        if (newPost.z === undefined) newPost.z = 0;

        // Initialiser avec des coordonnées aléatoires dans une petite zone
        // pour éviter que tous les posts démarrent à 0,0,0
        newPost.x += (Math.random() * 2 - 1) * 10;
        newPost.y += (Math.random() * 2 - 1) * 10;
        newPost.z += (Math.random() * 2 - 1) * 10;
        
        // Attribuer une couleur basée sur le character
        newPost.color = generateColorFromCharacter(newPost.character);

        return newPost;
      });

      console.log(
        `Posts initialisés avec des coordonnées de base et des couleurs basées sur le character: ${processedPosts.length}`
      );
      if (processedPosts.length > 0) {
        console.log("Premier post:", {
          id: processedPosts[0].id,
          coords: {
            x: processedPosts[0].x,
            y: processedPosts[0].y,
            z: processedPosts[0].z,
          },
        });
      }

      // Tableau de passes à exécuter
      const passes = options.passes || [];
      console.log(
        `Traitement séquentiel de ${passes.length} passes configurées`
      );

      // Exécuter chaque passe dans l'ordre défini
      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];

        // Ignorer les passes désactivées
        if (!pass.enabled) {
          console.log(
            `Passe "${pass.name}" [${i + 1}/${
              passes.length
            }] désactivée - ignorée`
          );
          continue;
        }

        console.log(
          `=== EXÉCUTION DE LA PASSE "${pass.name}" [${i + 1}/${
            passes.length
          }] ===`
        );

        // Exécuter la passe appropriée en fonction de son nom
        console.log("pass.name", pass.name);
        switch (pass.name.toLowerCase()) {
          case "voronoi":
            console.log(
              `Spatialisation voronoi avec échelle ${pass.config.perlinScale}, amplitude ${pass.config.perlinAmplitude}, dilatation ${pass.config.dilatationFactor}, deux phases: ${pass.config.secondPass}`
            );

            // Appliquer la spatialisation voronoi
            processedPosts = spatializePostsAroundJoshuaNodes(
              processedPosts,
              nodes,
              {
                // Options générales
                joshuaOnly: options.joshuaOnly,
                preserveOtherPositions: options.preserveOtherPositions,
                radius: options.radius,
                minDistance: options.minDistance,
                verticalSpread: options.verticalSpread,
                horizontalSpread: options.horizontalSpread,

                // Options spécifiques à voronoi
                perlinScale: pass.config.perlinScale,
                perlinAmplitude: pass.config.perlinAmplitude,
                dilatationFactor: pass.config.dilatationFactor,
                secondPass:
                  pass.config.secondPass !== undefined
                    ? pass.config.secondPass
                    : true,
                thirdPass:
                  pass.config.thirdPass !== undefined
                    ? pass.config.thirdPass
                    : true,
                useVoronoi: true,
              }
            );

            console.log(
              `Voronoi terminé, ${processedPosts.length} posts spatialisés`
            );
            break;

          case "vnp":
            console.log(
              `Spatialisation vnp avec échelle ${pass.config.perlinScale}, amplitude ${pass.config.perlinAmplitude}, dilatation ${pass.config.dilatationFactor}, deux phases: ${pass.config.secondPass}`
            );

            // Appliquer la spatialisation voronoi
            processedPosts = spatializePostsAroundJoshuaNodesVND(
              processedPosts,
              nodes,
              {
                // Options générales
                joshuaOnly: options.joshuaOnly,
                preserveOtherPositions: options.preserveOtherPositions,
                radius: options.radius,
                minDistance: options.minDistance,
                verticalSpread: options.verticalSpread,
                horizontalSpread: options.horizontalSpread,

                // Options spécifiques à voronoi
                perlinScale: pass.config.perlinScale,
                perlinAmplitude: pass.config.perlinAmplitude,
                dilatationFactor: pass.config.dilatationFactor,
                // Options pour la Phase 3 de displacement
                displacementIntensity: pass.config.displacementIntensity,
                displacementFrequency: pass.config.displacementFrequency,
                displacementSeed: pass.config.displacementSeed,
                secondPass:
                  pass.config.secondPass !== undefined
                    ? pass.config.secondPass
                    : true,
                thirdPass:
                  pass.config.thirdPass !== undefined
                    ? pass.config.thirdPass
                    : true,
                useVoronoi: true,
              }
            );

            console.log(
              `Voronoi terminé, ${processedPosts.length} posts spatialisés`
            );
            break;

          case "flowfield":
            console.log(
              `Animation flowfield avec ${pass.config.frames} frames, échelle ${pass.config.flowScale}, force ${pass.config.flowStrength}`
            );

            {
              // S'assurer que frames est un nombre positif
              const frames = Math.max(1, parseInt(pass.config.frames) || 10);
              console.log(`Nombre de frames final pour flowfield: ${frames}`);

              processedPosts = await animatePostsInFlowfield(processedPosts, {
                frames: frames,
                flowScale: pass.config.flowScale,
                flowStrength: pass.config.flowStrength,
              });
            }

            console.log(
              `Flowfield terminé, ${processedPosts.length} posts traités`
            );
            break;

          case "spherize":
            console.log(
              `Normalisation sphérique avec rayon ${pass.config.sphereRadius}, exposant ${pass.config.volumeExponent}`
            );

            processedPosts = normalizePostsInSphere(processedPosts, {
              sphereRadius: pass.config.sphereRadius,
              volumeExponent: pass.config.volumeExponent,
              minRadius: pass.config.minRadius,
              jitter: pass.config.jitter,
            });

            console.log(
              `Sphérisation terminée, ${processedPosts.length} posts traités`
            );
            break;

          case "displacement":
            console.log(`--------> DÉMARRAGE DU DÉPLACEMENT RADIAL <--------`);
            console.log(
              `Paramètres de déplacement: 
              - Intensité: ${pass.config.intensity || 10}
              - Fréquence: ${pass.config.frequency || 0.05}
              - Seed: ${pass.config.seed || 42}
              - Min Radius: ${pass.config.minRadius || 0}`
            );

            try {
              processedPosts = await applyRadialDisplacement(processedPosts, {
                intensity: pass.config.intensity || 10,
                frequency: pass.config.frequency || 0.05,
                seed: pass.config.seed || 42,
                center: pass.config.center || { x: 0, y: 0, z: 0 },
                minRadius: pass.config.minRadius || 0,
              });
            } catch (error) {
              console.error(
                "ERREUR lors de l'application du déplacement radial:",
                error
              );
            }

            console.log(
              `Déplacement terminé, ${processedPosts.length} posts traités`
            );
            break;

          default:
            console.warn(`Passe inconnue: ${pass.name} - ignorée`);
            break;
        }
      }

      console.log(`=== TRAITEMENT COMPLET: ${processedPosts.length} posts ===`);

      // Mettre à jour avec les posts traités
      if (updateCallback) {
        updateCallback(processedPosts);
      }

      return processedPosts;
    } catch (error) {
      console.error("Erreur dans processPostsWithPasses:", error);
      return posts;
    }
  };

  // Fonction pour exporter les données spatialisées
  const exportSpatializedData = () => {
    if (processedPosts.length === 0 || nodesData.length === 0) {
      alert(
        "Aucune donnée à exporter. Veuillez attendre le chargement des données."
      );
      return;
    }

    try {
      // Exporter les posts traités
      console.log(`Export des posts: ${processedPosts.length}`);
      const spatializedPosts = processedPosts.map((post) => {
        // Prendre directement les coordonnées à plat
        return {
          id: post.id,
          postUID: post.postUID || post.id,
          slug: post.slug || "",
          impact: post.impact || 0,
          x: post.x || 0,
          y: post.y || 0,
          z: post.z || 0,
        };
      });

      downloadJSON(spatializedPosts, "spatialized_posts.data.json");

      alert(`Exportation terminée!\n- Posts: ${spatializedPosts.length}`);
    } catch (error) {
      console.error("Erreur pendant l'exportation:", error);
      alert(`Erreur pendant l'exportation: ${error.message}`);
    }
  };

  // Configurer tous les contrôles avec Leva en dehors de la fonction de render
  const { debug, backgroundColor } = useControls({
    debug: true,
    backgroundColor: "#000000",
  });

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

      {/* Indicateur de chargement */}
      {(isLoadingPosts || isLoadingNodes) && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            fontSize: "20px",
            zIndex: 1000,
          }}
        >
          Chargement des données...
        </div>
      )}

      {/* Canvas 3D avec les éléments 3D uniquement */}
      <Canvas camera={{ position: [0, 0, 500] }}>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        <OrbitControls enablePan={true} enableZoom={true} makeDefault={true} />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        {/* Nœuds simplifiés (sphères rouges) */}
        <SimpleNodes nodes={nodesData} />
        {/* Rendu des posts avec les positions traitées */}
        {processedPosts.length > 0 && (
          <PostsRenderer posts={processedPosts} isLoading={isLoadingPosts} />
        )}
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

export default WorkPostPage;
