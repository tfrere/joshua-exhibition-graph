import { useRef, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// Type de données pour les posts (pour référence)
/**
 * @typedef {Object} Post
 * @property {string} id - ID unique du post
 * @property {string} slug - Slug du post
 * @property {string} content - Contenu du post
 *
 * Format 1: Coordonnées directement au niveau racine
 * @property {number} [x] - Position X
 * @property {number} [y] - Position Y
 * @property {number} [z] - Position Z
 *
 * Format 2: Coordonnées dans un objet imbriqué
 * @property {Object} [coordinates] - Coordonnées 3D du post
 * @property {number} [coordinates.x] - Position X
 * @property {number} [coordinates.y] - Position Y
 * @property {number} [coordinates.z] - Position Z
 *
 * @property {Array} color - Couleur RGB du post
 * @property {number} [impact] - Valeur d'impact du post (1-1000)
 * @property {boolean} [isJoshuaCharacter] - Indique si le post appartient à un personnage Joshua
 */

const SIZE = 0.125;
const MIN_IMPACT_SIZE = 10;
const MAX_IMPACT_SIZE = 50;
const USE_IMPACT_SIZE = true;

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
 * @param {Object} props - Propriétés du composant
 * @param {Array} props.data - Données des posts
 */
export function Posts({ data }) {
  const pointsRef = useRef();
  const { camera } = useThree();

  // Créer la texture pour les particules
  const pointTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Créer les géométries et matériaux une seule fois
  const [geometry, material] = useMemo(() => {
    if (!data || data.length === 0) return [null, null];

    // Afficher au maximum 40000 points
    const maxPoints = Math.min(data.length, 50000);

    // Créer la géométrie des points
    const geo = new THREE.BufferGeometry();

    // Positions (3 valeurs par point: x, y, z)
    const positions = new Float32Array(maxPoints * 3);

    // Couleurs (3 valeurs par point: r, g, b)
    const colors = new Float32Array(maxPoints * 3);

    // Tailles (1 valeur par point)
    const sizes = new Float32Array(maxPoints);

    // Remplir les tableaux
    for (let i = 0; i < maxPoints; i++) {
      const post = data[i];
      const i3 = i * 3;

      // Position
      // Gestion des deux formats de données possibles
      if (post) {
        // Format 1: Coordonnées directement au niveau racine
        if (
          post.x !== undefined &&
          post.y !== undefined &&
          post.z !== undefined
        ) {
          positions[i3] = post.x;
          positions[i3 + 1] = post.y;
          positions[i3 + 2] = post.z;
        }
        // Format 2: Coordonnées dans un objet 'coordinates'
        else if (post.coordinates && post.coordinates.x !== undefined) {
          positions[i3] = post.coordinates.x;
          positions[i3 + 1] = post.coordinates.y;
          positions[i3 + 2] = post.coordinates.z;
        }
        // Aucun format valide
        else {
          positions[i3] = 0;
          positions[i3 + 1] = 0;
          positions[i3 + 2] = 0;
          console.warn(`Post #${i} a des coordonnées manquantes ou invalides.`);
        }
      } else {
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;
      }

      // Couleur (utiliser la couleur du post si disponible ou une couleur par défaut)
      if (post.color && post.color.length >= 3) {
        colors[i3] = post.color[0];
        colors[i3 + 1] = post.color[1];
        colors[i3 + 2] = post.color[2];
      } else {
        colors[i3] = 1.0; // R
        colors[i3 + 1] = 0.6; // G
        colors[i3 + 2] = 0.2; // B
      }

      // Taille basée sur l'impact si disponible, sinon légèrement aléatoire
      let size;
      if (
        USE_IMPACT_SIZE &&
        post.impact !== undefined &&
        !isNaN(post.impact) &&
        post.impact > 0
      ) {
        // Limiter l'impact entre 1 et 500
        const impactValue = Math.max(1, Math.min(500, post.impact));
        // Conversion logarithmique de l'impact en taille pour une meilleure distribution visuelle
        const normalizedImpact = Math.log(impactValue) / Math.log(500);
        // Mise à l'échelle entre MIN_IMPACT_SIZE et MAX_IMPACT_SIZE
        size =
          MIN_IMPACT_SIZE +
          normalizedImpact * (MAX_IMPACT_SIZE - MIN_IMPACT_SIZE);
      } else {
        // Taille standard avec légère variation aléatoire si impact non utilisé
        size = 10 + Math.random() * 5;
      }

      sizes[i] = size * SIZE; // Appliquer le facteur de taille global
    }

    // Ajouter les attributs à la géométrie
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    // geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
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

    return [geo, mat];
  }, [data, pointTexture]);

  // Ne rien afficher si pas de données
  if (!data || data.length === 0 || !geometry || !material) {
    return null;
  }

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export default Posts;
