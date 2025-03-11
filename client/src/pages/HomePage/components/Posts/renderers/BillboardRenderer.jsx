import {
  useRef,
  useMemo,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Renderer qui utilise des billboards avec gradient radial pour représenter les posts
 * Utilise des shaders personnalisés pour créer l'effet de billboard avec gradient
 */
export const BillboardRenderer = forwardRef(function BillboardRenderer(
  { data, SIZE = 1, MIN_IMPACT_SIZE = 20, MAX_IMPACT_SIZE = 80 },
  ref
) {
  const pointsRef = useRef();
  const { camera } = useThree();

  // Références pour stocker les positions et tailles originales
  const originalPositionsRef = useRef(null);
  const originalSizesRef = useRef(null);
  const positionsAttributeRef = useRef(null);
  const sizesAttributeRef = useRef(null);
  const colorsAttributeRef = useRef(null);

  // Exposer les méthodes de mise à jour via la référence
  useImperativeHandle(ref, () => ({
    // Pour être compatible avec l'API de instancedMesh
    setMatrixAt: (index, matrix) => {
      if (!positionsAttributeRef.current) return;

      // Extraire la position de la matrice
      const position = new THREE.Vector3();
      position.setFromMatrixPosition(matrix);

      // Mettre à jour la position
      const posArray = positionsAttributeRef.current.array;
      posArray[index * 3] = position.x;
      posArray[index * 3 + 1] = position.y;
      posArray[index * 3 + 2] = position.z;

      // Marquer l'attribut comme nécessitant une mise à jour
      positionsAttributeRef.current.needsUpdate = true;
    },

    // Pour être compatible avec l'API de instancedMesh
    setColorAt: (index, color) => {
      if (!colorsAttributeRef.current) return;

      // Mettre à jour la couleur
      const colorArray = colorsAttributeRef.current.array;
      colorArray[index * 3] = color.r;
      colorArray[index * 3 + 1] = color.g;
      colorArray[index * 3 + 2] = color.b;

      // Marquer l'attribut comme nécessitant une mise à jour
      colorsAttributeRef.current.needsUpdate = true;
    },

    // Méthode spécifique aux points pour mettre à jour la taille
    setSizeAt: (index, size) => {
      if (!sizesAttributeRef.current) return;

      // Mettre à jour la taille
      sizesAttributeRef.current.array[index] = size;

      // Marquer l'attribut comme nécessitant une mise à jour
      sizesAttributeRef.current.needsUpdate = true;
    },

    // Propriété instanceMatrix pour compatibilité
    instanceMatrix: {
      needsUpdate: false,
    },

    // Propriété instanceColor pour compatibilité
    instanceColor: {
      needsUpdate: false,
    },
  }));

  // Vertex shader amélioré: ajoute un facteur de taille plus important pour améliorer la visibilité
  const vertexShader = `
    attribute float size;
    varying vec3 vColor;
    
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      // Facteur de taille augmenté (400 au lieu de 300)
      gl_PointSize = size * (400.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Fragment shader amélioré: ajoute un effet de lueur pour améliorer la visibilité
  const fragmentShader = `
    uniform sampler2D pointTexture;
    varying vec3 vColor;
    
    void main() {
      // Récupérer la couleur et l'alpha depuis la texture
      vec4 texColor = texture2D(pointTexture, gl_PointCoord);
      
      // Augmenter l'intensité de la couleur pour plus de luminosité
      vec3 brightColor = vColor * 1.5;
      
      // Appliquer l'effet de lueur avec un alpha plus élevé
      gl_FragColor = vec4(brightColor, 1.0) * texColor;
      
      // Seuil d'alpha diminué pour montrer plus de pixels
      if (gl_FragColor.a < 0.2) discard;
    }
  `;

  // Créer la texture pour les particules avec un gradient amélioré
  const pointTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64; // Résolution plus élevée
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    // Gradient plus lumineux et plus contrasté
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);

    // Valeurs améliorées pour plus de visibilité
    gradient.addColorStop(0, "rgba(255,255,255,1)"); // Centre blanc pur
    gradient.addColorStop(0.3, "rgba(255,255,255,0.9)"); // Transition plus douce
    gradient.addColorStop(0.6, "rgba(200,200,200,0.6)"); // Zone intermédiaire plus visible
    gradient.addColorStop(1, "rgba(100,100,100,0)"); // Bords plus visibles

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    // Appliquer un effet de lueur
    ctx.globalCompositeOperation = "lighter";
    const glowGradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    glowGradient.addColorStop(0, "rgba(255,255,255,0.4)");
    glowGradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }, []);

  // Créer les géométries et matériaux
  const [geometry, material] = useMemo(() => {
    if (!data || data.length === 0) {
      return [null, null];
    }

    // Limiter à un nombre raisonnable de points
    const maxPoints = Math.min(data.length, 50000);

    // Créer la géométrie des points
    const geo = new THREE.BufferGeometry();

    // Positions (3 valeurs par point: x, y, z)
    const positions = new Float32Array(maxPoints * 3);
    const originalPositions = new Float32Array(maxPoints * 3);

    // Couleurs (3 valeurs par point: r, g, b)
    const colors = new Float32Array(maxPoints * 3);

    // Tailles (1 valeur par point)
    const sizes = new Float32Array(maxPoints);
    const originalSizes = new Float32Array(maxPoints);

    // Remplir les tableaux avec des valeurs initiales
    for (let i = 0; i < maxPoints; i++) {
      const post = data[i];
      const i3 = i * 3;

      if (!post) continue;

      // Déterminer la position
      let x = 0,
        y = 0,
        z = 0;

      // Format 1: Coordonnées directement au niveau racine
      if (
        post.x !== undefined &&
        post.y !== undefined &&
        post.z !== undefined
      ) {
        x = post.x;
        y = post.y;
        z = post.z;
      }
      // Format 2: Coordonnées dans un objet 'coordinates'
      else if (post.coordinates && post.coordinates.x !== undefined) {
        x = post.coordinates.x;
        y = post.coordinates.y;
        z = post.coordinates.z;
      }

      // Position
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Stocker les positions originales
      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;

      // Couleurs plus vives pour une meilleure visibilité
      // Utilisation de couleurs légèrement teintées plutôt que blanc pur
      // pour donner plus de profondeur visuelle
      colors[i3] = 1.0; // R
      colors[i3 + 1] = 0.95; // G légèrement réduit
      colors[i3 + 2] = 0.9; // B légèrement réduit pour une teinte chaude

      // Taille basée sur l'impact si disponible
      let baseSize;
      if (post.impact !== undefined && !isNaN(post.impact) && post.impact > 0) {
        // Limiter l'impact entre 1 et 500
        const impactValue = Math.max(1, Math.min(500, post.impact));
        // Conversion logarithmique de l'impact en taille
        const normalizedImpact = Math.log(impactValue) / Math.log(500);
        // Mise à l'échelle entre MIN_IMPACT_SIZE et MAX_IMPACT_SIZE
        baseSize =
          MIN_IMPACT_SIZE +
          normalizedImpact * (MAX_IMPACT_SIZE - MIN_IMPACT_SIZE);
      } else {
        // Taille standard augmentée
        baseSize = 15; // Augmenté par rapport à 10
      }

      // Stocker la taille originale et l'utiliser pour la taille initiale
      originalSizes[i] = baseSize;
      sizes[i] = baseSize * SIZE;
    }

    // Ajouter les attributs à la géométrie
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    const sizeAttr = new THREE.BufferAttribute(sizes, 1);

    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", colAttr);
    geo.setAttribute("size", sizeAttr);

    // Stocker les références aux attributs pour les mises à jour ultérieures
    positionsAttributeRef.current = posAttr;
    colorsAttributeRef.current = colAttr;
    sizesAttributeRef.current = sizeAttr;

    // Stocker les valeurs originales
    originalPositionsRef.current = originalPositions;
    originalSizesRef.current = originalSizes;

    // Créer un matériau de shader personnalisé qui utilise l'attribut size
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: pointTexture },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      // Blending amélioré pour une meilleure visibilité
      blending: THREE.AdditiveBlending,
      // Augmenter l'intensité de la luminosité
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });

    return [geo, mat];
  }, [data, pointTexture, SIZE, MIN_IMPACT_SIZE, MAX_IMPACT_SIZE]);

  // Effet pour journaliser l'initialisation
  useEffect(() => {
    console.log(
      "BillboardRenderer initialisé avec",
      data?.length || 0,
      "posts"
    );

    // Ici, informons le composant parent que nous sommes prêts à recevoir des mises à jour
    if (ref && typeof ref === "object" && ref.current) {
      ref.current.isReady = true;
    }

    return () => {
      console.log("BillboardRenderer démonté");
    };
  }, [data, ref]);

  // Ne rien afficher si pas de données ou composants non créés
  if (!data || data.length === 0 || !geometry || !material) {
    return null;
  }

  return <points ref={pointsRef} geometry={geometry} material={material} />;
});

export default BillboardRenderer;
