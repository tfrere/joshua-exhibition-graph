import { Canvas } from "@react-three/fiber";
import { Stats, OrbitControls, Text } from "@react-three/drei";
import { useEffect, useState, useRef } from "react";
import { useControls, folder } from "leva";
import PostsRenderer from "./components/PostRenderer/PostsRenderer.jsx";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { spatializePostsAroundJoshuaNodes } from "./components/PostRenderer/utils/voronoiPass.js";
import { normalizePostsInSphere } from "./components/PostRenderer/utils/spherizePass.js";
import { animatePostsInFlowfield } from "./components/PostRenderer/utils/flowfieldPass.js";
import { applyRadialDisplacement } from "./components/PostRenderer/utils/smoothDisplacementPass.js";
// import { applyRadialDisplacement } from "./components/PostRenderer/utils/displacementPass.js";
import { spatializePostsAroundJoshuaNodesVND } from "./components/PostRenderer/utils/voronoiWithDisplacementPass.js";
import { spatializePostsWithVolumetricDistribution } from "./components/PostRenderer/utils/volumetricVoronoiPass.js";

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
function generateColorFromCharacter(
  character,
  saturation = 0.8,
  luminance = 0.6
) {
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
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

// Composant simple pour afficher les nœuds comme des sphères rouges
const SimpleNodes = ({ nodes }) => {
  if (!nodes || nodes.length === 0) return null;

  return (
    <group>
      {nodes.map((node) => {
        // Générer une couleur basée sur le slug du personnage
        const nodeColor = node.isJoshua
          ? "red"
          : node.slug
          ? new THREE.Color(...generateColorFromCharacter(node.slug))
          : "white";

        return (
          <group
            key={node.id}
            position={[node.x || 0, node.y || 0, node.z || 0]}
          >
            {/* Sphère du personnage */}
            <mesh>
              <sphereGeometry args={[2, 16, 16]} />
              <meshBasicMaterial color={nodeColor} />
            </mesh>

            {/* Nom du personnage au-dessus de la sphère */}
            <Text
              position={[0, 4, 0]} // Position au-dessus de la sphère
              fontSize={1.5}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.1}
              outlineColor="#000000"
            >
              {node.name || node.slug || node.id || ""}
            </Text>
          </group>
        );
      })}
    </group>
  );
};

/**
 * Composant pour visualiser les cellules de Voronoi en 3D comme elles sont calculées dans l'algorithme de spatialisation
 * @param {Object} props - Propriétés du composant
 * @param {Array} props.nodes - Nœuds du graphe représentant les centres des cellules Voronoi
 * @param {boolean} props.visible - Si true, affiche les cellules
 * @param {number} props.opacity - Opacité des cellules (défaut: 0.1)
 */
const VoronoiCellsVisualizer = ({ nodes, visible = true, opacity = 0.1 }) => {
  // State pour stocker les segments de ligne
  const [voronoiEdges, setVoronoiEdges] = useState([]);

  // useEffect pour calculer les arêtes des cellules Voronoi de façon plus efficace
  useEffect(() => {
    if (!visible || !nodes || nodes.length === 0) return;

    console.log(
      "VoronoiCellsVisualizer: Démarrage du calcul pour",
      nodes.length,
      "noeuds"
    );

    // Filtrer les nœuds valides
    const validNodes = nodes.filter(
      (node) =>
        node &&
        typeof node.x === "number" &&
        typeof node.y === "number" &&
        typeof node.z === "number"
    );

    console.log(
      "VoronoiCellsVisualizer: Noeuds valides trouvés:",
      validNodes.length
    );

    if (validNodes.length < 2) {
      console.warn(
        "VoronoiCellsVisualizer: Pas assez de noeuds valides pour calculer les cellules"
      );
      return;
    }

    // Fonction pour calculer la distance au carré (plus rapide que sqrt)
    const distanceSq = (a, b) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      return dx * dx + dy * dy + dz * dz;
    };

    // Calculer le diamètre approximatif de l'espace pour limiter l'échantillonnage
    let centroid = { x: 0, y: 0, z: 0 };

    // Calculer le centroïde des nœuds
    for (const node of validNodes) {
      centroid.x += node.x;
      centroid.y += node.y;
      centroid.z += node.z;
    }

    centroid.x /= validNodes.length;
    centroid.y /= validNodes.length;
    centroid.z /= validNodes.length;

    // Trouver la distance maximale au centroïde
    let maxRadius = 0;
    for (const node of validNodes) {
      const dist = Math.sqrt(
        (node.x - centroid.x) ** 2 +
          (node.y - centroid.y) ** 2 +
          (node.z - centroid.z) ** 2
      );
      if (dist > maxRadius) maxRadius = dist;
    }

    // Ajouter une marge pour la sphère englobante
    const sphereRadius = maxRadius * 1.5;
    console.log(
      "VoronoiCellsVisualizer: Rayon de la sphère englobante:",
      sphereRadius
    );

    // Générer des nœuds virtuels sur la sphère pour fermer les cellules de Voronoi
    const virtualNodes = [];
    const numVirtualNodes = 32; // Nombre de nœuds virtuels

    // Générer des points sur la sphère en utilisant la méthode du nombre d'or
    // pour une distribution uniforme
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < numVirtualNodes; i++) {
      const y = 1 - (i / (numVirtualNodes - 1)) * 2; // de -1 à 1
      const radius = Math.sqrt(1 - y * y);

      const theta = (2 * Math.PI * i) / goldenRatio;

      virtualNodes.push({
        x: centroid.x + sphereRadius * radius * Math.cos(theta),
        y: centroid.y + sphereRadius * y,
        z: centroid.z + sphereRadius * radius * Math.sin(theta),
        isVirtual: true,
        id: `virtual_${i}`,
      });
    }

    console.log(
      "VoronoiCellsVisualizer: Nœuds virtuels générés:",
      virtualNodes.length
    );

    // Combiner les nœuds valides et virtuels
    const allNodes = [...validNodes, ...virtualNodes];

    // Tableau pour stocker les segments de ligne
    const edges = [];

    // Approche simplifiée : créer directement des lignes entre les noeuds réels pour visualiser le graphe
    for (let i = 0; i < validNodes.length; i++) {
      for (let j = i + 1; j < Math.min(i + 5, validNodes.length); j++) {
        edges.push({
          start: { x: validNodes[i].x, y: validNodes[i].y, z: validNodes[i].z },
          end: { x: validNodes[j].x, y: validNodes[j].y, z: validNodes[j].z },
        });
      }
    }

    console.log(
      "VoronoiCellsVisualizer: Ajout initial de",
      edges.length,
      "lignes de connexion entre noeuds"
    );

    // Approche simplifiée et améliorée : sélection des paires de nœuds les plus pertinentes
    // Limiter le nombre de paires à traiter pour améliorer les performances
    const maxPairs = 200; // Augmenté pour inclure les nœuds virtuels

    // Stocker toutes les paires avec leurs distances
    const allPairs = [];

    // Priorité aux paires contenant au moins un nœud réel
    for (let i = 0; i < validNodes.length; i++) {
      for (let j = 0; j < allNodes.length; j++) {
        if (validNodes[i] !== allNodes[j]) {
          const dist = distanceSq(validNodes[i], allNodes[j]);
          allPairs.push({
            i: i,
            j: j + (j >= validNodes.length ? -validNodes.length : 0),
            dist,
            isVirtual: j >= validNodes.length,
            nodeA: validNodes[i],
            nodeB: allNodes[j],
          });
        }
      }
    }

    // Ajouter quelques paires entre nœuds virtuels pour compléter les frontières
    for (let i = 0; i < virtualNodes.length; i++) {
      for (let j = i + 1; j < virtualNodes.length; j++) {
        if (i !== j) {
          const dist = distanceSq(virtualNodes[i], virtualNodes[j]);
          if (dist < sphereRadius * sphereRadius * 0.5) {
            // Seulement les nœuds virtuels proches
            allPairs.push({
              i: i + validNodes.length,
              j: j + validNodes.length,
              dist,
              isVirtual: true,
              nodeA: virtualNodes[i],
              nodeB: virtualNodes[j],
            });
          }
        }
      }
    }

    console.log(
      "VoronoiCellsVisualizer: Paires de noeuds candidates:",
      allPairs.length
    );

    // Trier les paires par distance croissante et priorité (réels > virtuels)
    allPairs.sort((a, b) => {
      // Priorité aux paires de nœuds réels
      if (a.isVirtual && !b.isVirtual) return 1;
      if (!a.isVirtual && b.isVirtual) return -1;
      // Ensuite par distance
      return a.dist - b.dist;
    });

    // Traiter les paires les plus pertinentes
    const pairsToProcess = allPairs.slice(0, maxPairs);
    console.log(
      "VoronoiCellsVisualizer: Paires à traiter:",
      pairsToProcess.length
    );

    for (const pair of pairsToProcess) {
      const siteA = pair.nodeA;
      const siteB = pair.nodeB;

      // Point médian entre les deux sites
      const midpoint = {
        x: (siteA.x + siteB.x) / 2,
        y: (siteA.y + siteB.y) / 2,
        z: (siteA.z + siteB.z) / 2,
      };

      // Calculer la direction normalisée de A vers B
      const distance = Math.sqrt(pair.dist);
      const normal = {
        x: (siteB.x - siteA.x) / distance,
        y: (siteB.y - siteA.y) / distance,
        z: (siteB.z - siteA.z) / distance,
      };

      // Créer des vecteurs orthogonaux au vecteur normal
      let u = { x: 0, y: 1, z: 0 };
      if (Math.abs(normal.y) > 0.9) {
        u = { x: 1, y: 0, z: 0 };
      }

      // Produit vectoriel pour obtenir un vecteur perpendiculaire à normal et u
      let v = {
        x: normal.y * u.z - normal.z * u.y,
        y: normal.z * u.x - normal.x * u.z,
        z: normal.x * u.y - normal.y * u.x,
      };

      // Maintenant, u doit être perpendiculaire à normal et v
      u = {
        x: normal.y * v.z - normal.z * v.y,
        y: normal.z * v.x - normal.x * v.z,
        z: normal.x * v.y - normal.y * v.x,
      };

      // Normaliser u et v
      const lengthU = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
      const lengthV = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

      u = { x: u.x / lengthU, y: u.y / lengthU, z: u.z / lengthU };
      v = { x: v.x / lengthV, y: v.y / lengthV, z: v.z / lengthV };

      // Pour les paires impliquant un nœud virtuel, s'assurer que le plan Voronoi est visible
      // en augmentant le rayon proportionnellement à la distance entre les nœuds
      let planeRadius = distance * 0.8;

      // Si c'est une paire avec un nœud virtuel, augmenter le rayon
      if (pair.isVirtual) {
        planeRadius = Math.min(distance * 0.9, sphereRadius * 0.5);
      }

      // Nombre de segments du cercle (plus pour les paires importantes)
      const segments = pair.isVirtual ? 8 : 12;
      const angleStep = (2 * Math.PI) / segments;

      let prevPoint = null;
      for (let s = 0; s <= segments; s++) {
        const angle = s * angleStep;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const point = {
          x: midpoint.x + planeRadius * (u.x * cos + v.x * sin),
          y: midpoint.y + planeRadius * (u.y * cos + v.y * sin),
          z: midpoint.z + planeRadius * (u.z * cos + v.z * sin),
        };

        // Contraindre le point à l'intérieur de la sphère globale si nécessaire
        const distToCenter = Math.sqrt(
          (point.x - centroid.x) ** 2 +
            (point.y - centroid.y) ** 2 +
            (point.z - centroid.z) ** 2
        );

        if (distToCenter > sphereRadius) {
          const scale = sphereRadius / distToCenter;
          point.x = centroid.x + (point.x - centroid.x) * scale;
          point.y = centroid.y + (point.y - centroid.y) * scale;
          point.z = centroid.z + (point.z - centroid.z) * scale;
        }

        if (prevPoint) {
          edges.push({
            start: prevPoint,
            end: point,
            isVirtual: pair.isVirtual,
          });
        }

        prevPoint = point;
      }
    }

    // Ajouter un cercle représentant la sphère englobante pour la visualisation
    const sphereSegments = 36;
    const sphereStep = (2 * Math.PI) / sphereSegments;

    // Ajouter trois grands cercles orthogonaux pour la sphère
    const planes = [
      { u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } }, // Plan XY
      { u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } }, // Plan XZ
      { u: { x: 0, y: 1, z: 0 }, v: { x: 0, y: 0, z: 1 } }, // Plan YZ
    ];

    for (const plane of planes) {
      let prevPoint = null;
      for (let s = 0; s <= sphereSegments; s++) {
        const angle = s * sphereStep;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const point = {
          x: centroid.x + sphereRadius * (plane.u.x * cos + plane.v.x * sin),
          y: centroid.y + sphereRadius * (plane.u.y * cos + plane.v.y * sin),
          z: centroid.z + sphereRadius * (plane.u.z * cos + plane.v.z * sin),
        };

        if (prevPoint) {
          edges.push({
            start: prevPoint,
            end: point,
            isOutline: true, // Marquer comme contour de la sphère
          });
        }

        prevPoint = point;
      }
    }

    console.log(
      "VoronoiCellsVisualizer: Total des segments générés:",
      edges.length
    );

    // Limiter le nombre de segments pour éviter de surcharger le navigateur
    const maxSegments = 2000; // Augmenté pour accommoder la sphère et les cellules
    if (edges.length > maxSegments) {
      // Au lieu d'un slicing aléatoire, prendre un segment sur n pour garder une représentation équilibrée
      const sampledEdges = [];

      // Conserver en priorité les segments non virtuels et le contour de la sphère
      const priorityEdges = edges.filter((e) => e.isOutline || !e.isVirtual);
      const secondaryEdges = edges.filter((e) => !e.isOutline && e.isVirtual);

      // Prendre tous les segments prioritaires dans la limite
      sampledEdges.push(...priorityEdges.slice(0, maxSegments * 0.7));

      // Distribuer le reste aux segments secondaires
      const remainingSlots = maxSegments - sampledEdges.length;
      if (remainingSlots > 0 && secondaryEdges.length > 0) {
        const ratioSecondary = Math.ceil(
          secondaryEdges.length / remainingSlots
        );
        for (let i = 0; i < secondaryEdges.length; i += ratioSecondary) {
          sampledEdges.push(secondaryEdges[i]);
        }
      }

      setVoronoiEdges(sampledEdges);
      console.log(
        "VoronoiCellsVisualizer: Segments limités à:",
        sampledEdges.length
      );
    } else {
      setVoronoiEdges(edges);
    }
  }, [nodes, visible]);

  // Ne rien afficher si le composant est invisible ou s'il n'y a pas de nœuds
  if (!visible || !nodes || nodes.length === 0) return null;

  // Si aucun segment n'a été généré, ajouter une sphère de débogage pour vérifier que le composant fonctionne
  if (voronoiEdges.length === 0) {
    console.warn(
      "VoronoiCellsVisualizer: Aucun segment généré, affichage d'une sphère de débogage"
    );
    return (
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[10, 16, 16]} />
        <meshBasicMaterial color="lime" />
      </mesh>
    );
  }

  return (
    <group>
      {/* Utiliser une seule géométrie pour toutes les lignes */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={voronoiEdges.length * 2}
            array={Float32Array.from(
              voronoiEdges.flatMap((edge) => [
                edge.start.x,
                edge.start.y,
                edge.start.z,
                edge.end.x,
                edge.end.y,
                edge.end.z,
              ])
            )}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={new THREE.Color(1, 1, 0)}
          transparent
          opacity={opacity * 3}
          linewidth={2}
        />
      </lineSegments>

      {/* Contour de la sphère englobante avec un matériau distinct */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={voronoiEdges.filter((e) => e.isOutline).length * 2}
            array={Float32Array.from(
              voronoiEdges
                .filter((e) => e.isOutline)
                .flatMap((edge) => [
                  edge.start.x,
                  edge.start.y,
                  edge.start.z,
                  edge.end.x,
                  edge.end.y,
                  edge.end.z,
                ])
            )}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={new THREE.Color(0, 1, 1)}
          transparent
          opacity={opacity * 4}
          linewidth={1}
        />
      </lineSegments>
    </group>
  );
};

const WorkPostPage = () => {
  const [postsData, setPostsData] = useState([]);
  const [nodesData, setNodesData] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingNodes, setIsLoadingNodes] = useState(true);
  const [processedPosts, setProcessedPosts] = useState([]);
  const [showVoronoiCells, setShowVoronoiCells] = useState(false);
  const orbitControlsRef = useRef();

  // Configuration par défaut pour la spatialisation des posts
  const DEFAULT_POSTS_SPATIAL_CONFIG = {
    // Paramètres généraux (utilisés principalement par la passe voronoi)
    joshuaOnly: false, // Traiter TOUS les posts, pas seulement ceux de Joshua
    preserveOtherPositions: false, // Ne pas préserver les positions existantes - on veut tout spatialiser
    radius: 60, // Augmenter le rayon pour plus d'espace
    minDistance: 10, // Réduire la distance minimale pour permettre plus de flexibilité
    verticalSpread: 1.0, // Équilibrer la répartition verticale
    horizontalSpread: 1.0, // Équilibrer la répartition horizontale

    // Paramètre de coloration (utilisé par spatializePostsAroundJoshuaNodes)
    useUniqueColorsPerCharacter: true,

    // Option pour mettre à jour la visualisation après chaque passe (expérimental)
    updateAfterEachPass: false,

    // Passes de traitement dans l'ordre d'exécution
    passes: [
      {
        name: "voronoi",
        enabled: false, // Désactiver la passe voronoi standard
        config: {
          secondPass: false,
          perlinScale: 0.05,
          perlinAmplitude: 1,
          dilatationFactor: 1.2,
        },
      },
      {
        name: "vnp",
        enabled: false, // Désactiver la passe VND
        config: {
          secondPass: true,
          perlinScale: 0.0,
          perlinAmplitude: 0.0,
          dilatationFactor: 0.9,
          thirdPass: false,
          displacementIntensity: 0,
          displacementFrequency: 0.0,
          displacementSeed: 42,

          maxAttempts: 800,
          cellPadding: 0.001,
          distributionStrategy: "inverse",
          fallbackStrategy: "extreme",

          weightField: "none",
          useStrictSlugMatching: true,
          inverseDistanceWeight: 3.0,
          boundaryPreference: 0.9,

          useVolumetricRadius: true,
          volumeExponent: 3.0,
          distanceFunction: "inverse",

          antiClusteringFactor: 1.0,
          randomizationPreservesVolume: true,
          densityEqualization: true,
          probabilityCurve: "cubic",
          innerRadiusCutoff: 0.7,
        },
      },
      {
        name: "volumetric",
        enabled: true, // Activer la nouvelle méthode de spatialisation volumétrique
        config: {
          globalSphereRadius: 200, // Rayon de la sphère globale
          proportionalVolume: true, // Volumes proportionnels au nombre de posts
          perlinScale: 0.03, // Échelle du bruit de Perlin pour la variation
          perlinAmplitude: 5, // Amplitude du bruit de Perlin
          minCharacterDistance: 20, // Distance minimale entre caractères
          useStrictSlugMatching: true, // Permettre la correspondance par ID si nécessaire
          firstPass: true,  // Répartition initiale des posts dans les volumes
          secondPass: true, // Vérification de la contrainte de la sphère globale
          thirdPass: true,  // Application du bruit de Perlin pour la variation
          fourthPass: true, // Uniformisation itérative de la densité
          fifthPass: true,  // Perturbation finale pour casser l'aspect cubique
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
        enabled: true,
        config: {
          intensity: 10,
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
        newPost.color = generateColorFromCharacter(newPost.slug);

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

          case "volumetric":
            console.log(
              `Spatialisation volumétrique avec rayon global ${pass.config.globalSphereRadius}, volumes proportionnels: ${pass.config.proportionalVolume}`
            );

            // Appliquer la spatialisation volumétrique
            processedPosts = spatializePostsWithVolumetricDistribution(
              processedPosts,
              nodes,
              {
                // Options générales
                joshuaOnly: options.joshuaOnly,
                preserveOtherPositions: options.preserveOtherPositions,

                // Options spécifiques à la spatialisation volumétrique
                globalSphereRadius: pass.config.globalSphereRadius,
                proportionalVolume: pass.config.proportionalVolume,
                perlinScale: pass.config.perlinScale,
                perlinAmplitude: pass.config.perlinAmplitude,
                minCharacterDistance: pass.config.minCharacterDistance,
                useStrictSlugMatching: pass.config.useStrictSlugMatching,
                
                // Options de contrôle des passes
                firstPass: pass.config.firstPass,
                secondPass: pass.config.secondPass,
                thirdPass: pass.config.thirdPass,
                fourthPass: pass.config.fourthPass,
                fifthPass: pass.config.fifthPass
              }
            );

            console.log(
              `Spatialisation volumétrique terminée, ${processedPosts.length} posts spatialisés`
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
  const { debug, backgroundColor, voronoiVisualization } = useControls({
    debug: true,
    backgroundColor: "#000000",
    voronoiVisualization: folder({
      showCells: {
        value: false,
        label: "Afficher les cellules",
        onChange: (value) => setShowVoronoiCells(value),
      },
      cellOpacity: {
        value: 0.1,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        label: "Opacité des cellules",
      },
    }),
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
        <OrbitControls
          ref={orbitControlsRef}
          enablePan={true}
          enableZoom={true}
          makeDefault={true}
        />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        {/* Nœuds simplifiés (sphères rouges) */}
        <SimpleNodes nodes={nodesData} />
        {/* Visualisation des cellules Voronoi */}
        {showVoronoiCells && (
          <VoronoiCellsVisualizer
            nodes={nodesData}
            visible={showVoronoiCells}
            opacity={voronoiVisualization?.cellOpacity ?? 0.1}
          />
        )}
        {/* Rendu des posts avec les positions traitées */}
        {processedPosts.length > 0 && (
          <PostsRenderer
            posts={processedPosts}
            isLoading={isLoadingPosts}
            orbitControlsRef={orbitControlsRef}
          />
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
