import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useControls, folder } from "leva";

// Type de données pour les posts (pour référence)
/**
 * @typedef {Object} Post
 * @property {string} id - ID unique du post
 * @property {number} x - Position X
 * @property {number} y - Position Y
 * @property {number} z - Position Z
 * @property {Array} color - Couleur RGB du post
 * @property {number} impact - Valeur d'impact du post (1-1000)
 */

const SIZE = 0.125;
const MIN_IMPACT_SIZE = 10;
const MAX_IMPACT_SIZE = 50;

// Vertex shader qui utilise l'attribut size pour les points
const vertexShader = `
  attribute float size;
  varying vec3 vColor;
  
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader pour les points avec une texture circulaire
const fragmentShader = `
  uniform sampler2D pointTexture;
  varying vec3 vColor;
  
  void main() {
    gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
    if (gl_FragColor.a < 0.3) discard;
  }
`;

/**
 * Composant pour le rendu ultra-optimisé des posts
 */
export function PostsRenderer({ posts, isLoading }) {
  const pointsRef = useRef();
  const { camera } = useThree();

  // Référence pour conserver les tailles originales basées sur l'impact
  const originalSizesRef = useRef(null);

  // Ajouter un contrôle Leva pour la taille des points dans un groupe dédié
  const { pointSize, useImpactSize } = useControls({
    "Posts Renderer": folder({
      pointSize: {
        value: SIZE,
        min: 0.1,
        max: 1,
        step: 0.1,
        label: "Taille des points",
      },
      useImpactSize: {
        value: true,
        label: "Utiliser la valeur d'impact pour la taille",
      },
    }),
  });

  // Créer la texture pour les particules
  const pointTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,180,120,0.8)");
    gradient.addColorStop(1, "rgba(255,180,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Créer les géométries et matériaux une seule fois
  const [geometry, material] = useMemo(() => {
    console.log("Création de la géométrie initiale...");

    if (!posts || posts.length === 0) {
      console.warn("Aucun post disponible pour la création de la géométrie");
      return [null, null];
    }

    // Afficher au maximum 50000 points
    const maxPoints = Math.min(posts.length, 50000);
    console.log(
      `Création d'une géométrie pour ${maxPoints} points sur ${posts.length} posts`
    );

    try {
      // Créer la géométrie des points
      const geo = new THREE.BufferGeometry();

      // Positions (3 valeurs par point: x, y, z)
      const positions = new Float32Array(maxPoints * 3);

      // Couleurs (3 valeurs par point: r, g, b)
      const colors = new Float32Array(maxPoints * 3);

      // Tailles (1 valeur par point)
      const sizes = new Float32Array(maxPoints);

      // Créer un nouveau tableau pour stocker les tailles originales basées sur l'impact
      const originalSizes = new Float32Array(maxPoints);
      originalSizesRef.current = originalSizes;

      // Remplir les tableaux avec des valeurs initiales
      for (let i = 0; i < maxPoints; i++) {
        const post = posts[i];
        const i3 = i * 3;

        if (!post) continue;

        // Position (coordonnées à plat avec valeur par défaut à 0)
        positions[i3] =
          typeof post.x === "number" && !isNaN(post.x) ? post.x : 0;
        positions[i3 + 1] =
          typeof post.y === "number" && !isNaN(post.y) ? post.y : 0;
        positions[i3 + 2] =
          typeof post.z === "number" && !isNaN(post.z) ? post.z : 0;

        // Couleur (utiliser la couleur du post si disponible ou une couleur par défaut)
        if (post.color && Array.isArray(post.color) && post.color.length >= 3) {
          colors[i3] = post.color[0];
          colors[i3 + 1] = post.color[1];
          colors[i3 + 2] = post.color[2];
        } else {
          colors[i3] = 1.0; // R
          colors[i3 + 1] = 0.6; // G
          colors[i3 + 2] = 0.2; // B
        }

        // Taille basée sur l'impact si disponible et activé, sinon légèrement aléatoire
        let baseSize;
        if (
          useImpactSize &&
          post.impact !== undefined &&
          !isNaN(post.impact) &&
          post.impact > 0
        ) {
          // Limiter l'impact entre 1 et 500
          const impactValue = Math.max(1, Math.min(500, post.impact));
          // Conversion logarithmique de l'impact en taille pour une meilleure distribution visuelle
          // (les valeurs extrêmes sont moins disproportionnées)
          const normalizedImpact = Math.log(impactValue) / Math.log(500);
          // Mise à l'échelle entre MIN_IMPACT_SIZE et MAX_IMPACT_SIZE
          baseSize =
            MIN_IMPACT_SIZE +
            normalizedImpact * (MAX_IMPACT_SIZE - MIN_IMPACT_SIZE);
        } else {
          // Taille standard avec légère variation aléatoire si impact non utilisé
          baseSize = 10 + Math.random() * 5;
        }

        // Stocker la taille originale et l'utiliser pour la taille initiale
        originalSizes[i] = baseSize;
        sizes[i] = baseSize * pointSize; // Multiplier par pointSize dès le début
      }

      // Ajouter les attributs à la géométrie
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      // Créer un matériau de shader personnalisé qui utilise l'attribut size
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          pointTexture: { value: pointTexture },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        vertexColors: true,
      });

      console.log("Géométrie initiale créée avec succès");

      // Log d'un échantillon pour vérification
      if (posts[0]) {
        console.log("Premier post (initialisation):", {
          original: { x: posts[0].x, y: posts[0].y, z: posts[0].z },
          dans_buffer: {
            x: positions[0],
            y: positions[1],
            z: positions[2],
          },
        });
      }

      return [geo, mat];
    } catch (error) {
      console.error("Erreur lors de la création de la géométrie:", error);
      return [null, null];
    }
  }, [pointTexture, useImpactSize, pointSize]); // On inclut pointSize ici car c'est utilisé pour l'initialisation

  // Mettre à jour les positions lorsque les posts changent
  useEffect(() => {
    if (!geometry || !posts || posts.length === 0) {
      return;
    }

    try {
      console.log("Mise à jour des positions dans la géométrie...");

      // Vérifier que l'attribut position existe
      if (!geometry.attributes.position) {
        console.error("L'attribut position n'existe pas dans la géométrie");
        return;
      }

      // Récupérer directement le tableau de l'attribut position pour le modifier
      const positionArray = geometry.attributes.position.array;

      // Vérifier que le tableau existe
      if (!positionArray) {
        console.error("Le tableau de positions n'existe pas");
        return;
      }

      // Limiter à la taille actuelle du tableau de positions
      const maxPoints = Math.min(posts.length, positionArray.length / 3);

      console.log(
        `Mise à jour de ${maxPoints} points sur ${posts.length} posts`
      );

      // Mettre à jour les positions directement dans le tableau de l'attribut
      for (let i = 0; i < maxPoints; i++) {
        const post = posts[i];
        const i3 = i * 3;

        // Vérifier que le post existe et a des coordonnées valides
        if (post) {
          // Mettre à jour les coordonnées avec des valeurs par défaut à zéro si nécessaire
          positionArray[i3] =
            typeof post.x === "number" && !isNaN(post.x) ? post.x : 0;
          positionArray[i3 + 1] =
            typeof post.y === "number" && !isNaN(post.y) ? post.y : 0;
          positionArray[i3 + 2] =
            typeof post.z === "number" && !isNaN(post.z) ? post.z : 0;
        }
      }

      // Indiquer que l'attribut a été modifié
      geometry.attributes.position.needsUpdate = true;

      console.log("Positions mises à jour avec succès");

      // Log d'un échantillon pour vérification
      if (posts[0]) {
        console.log("Premier post:", {
          original: { x: posts[0].x, y: posts[0].y, z: posts[0].z },
          dans_buffer: {
            x: positionArray[0],
            y: positionArray[1],
            z: positionArray[2],
          },
        });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour des positions:", error);
    }
  }, [posts, geometry]);

  // Ne rien afficher pendant le chargement ou si pas de données
  if (isLoading || !posts || posts.length === 0 || !geometry || !material) {
    return null;
  }

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export default PostsRenderer;
