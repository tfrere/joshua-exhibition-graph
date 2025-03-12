import { useRef, useMemo, useEffect, useState } from "react";
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
  varying float vHighlight;
  
  uniform vec3 mousePosition;
  uniform float radius;
  uniform bool isEditMode;
  
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Calculer la surbrillance basée sur la distance à la souris en mode édition
    if (isEditMode) {
      float dist = distance(position, mousePosition);
      vHighlight = dist < radius ? 1.0 - (dist / radius) : 0.0;
    } else {
      vHighlight = 0.0;
    }
  }
`;

// Fragment shader pour les points avec une texture circulaire
const fragmentShader = `
  uniform sampler2D pointTexture;
  varying vec3 vColor;
  varying float vHighlight;
  
  void main() {
    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
    // Utiliser directement la surbrillance pour mélanger avec du blanc pur
    vec3 finalColor = mix(vColor, vec3(1.0), vHighlight);
    gl_FragColor = vec4(finalColor, 1.0) * texColor;
    if (gl_FragColor.a < 0.3) discard;
  }
`;

/**
 * Composant pour le rendu ultra-optimisé des posts
 */
export function PostsRenderer({ posts, isLoading, orbitControlsRef }) {
  const pointsRef = useRef();
  const sphereRef = useRef();
  const { camera, raycaster, mouse, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const mousePositionRef = useRef(new THREE.Vector3());
  const lastMousePositionRef = useRef(new THREE.Vector3());

  // Référence pour conserver les tailles originales basées sur l'impact
  const originalSizesRef = useRef(null);
  const originalPositionsRef = useRef(null);

  // Ajouter des contrôles pour l'effet de répulsion et le mode d'édition
  const { pointSize, useImpactSize, radius, strength } = useControls({
    "Posts Renderer": folder({
      pointSize: {
        value: SIZE,
        min: 0.1,
        max: 1,
        step: 0.01,
        label: "Taille des points",
      },
      useImpactSize: {
        value: false,
        label: "Utiliser la valeur d'impact pour la taille",
      },
      editMode: {
        value: false,
        label: "Mode édition",
        onChange: (value) => {
          setIsEditMode(value);
          // Réinitialiser isDragging quand on désactive le mode édition
          if (!value) setIsDragging(false);
          // Activer/désactiver les contrôles de la caméra
          if (orbitControlsRef?.current) {
            orbitControlsRef.current.enabled = !value;
          }
        }
      },
      radius: {
        value: 50,
        min: 10,
        max: 200,
        step: 1,
        label: "Rayon de répulsion",
      },
      strength: {
        value: 50,
        min: 1,
        max: 200,
        step: 1,
        label: "Force de répulsion",
      }
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
          mousePosition: { value: new THREE.Vector3() },
          radius: { value: radius },
          isEditMode: { value: false }
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

      // Stocker les positions originales
      originalPositionsRef.current = positions.slice();

      return [geo, mat];
    } catch (error) {
      console.error("Erreur lors de la création de la géométrie:", error);
      return [null, null];
    }
  }, [pointTexture, useImpactSize, pointSize, radius]);

  // Mettre à jour les uniforms quand le mode d'édition change
  useEffect(() => {
    if (material) {
      material.uniforms.isEditMode.value = isEditMode;
    }
  }, [isEditMode, material]);

  // Mettre à jour les uniforms quand le rayon change
  useEffect(() => {
    if (material) {
      material.uniforms.radius.value = radius;
    }
  }, [radius, material]);

  // Créer un plan qui suit l'orientation de la caméra
  const updateMousePosition = (mousePosition) => {
    // Obtenir la direction de vue de la caméra
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Créer un plan perpendiculaire à la direction de la caméra
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(
      cameraDirection,
      new THREE.Vector3(0, 0, 0)
    );
    
    // Projeter le rayon de la souris sur ce plan
    raycaster.setFromCamera(mouse, camera);
    const intersect = raycaster.ray.intersectPlane(plane, mousePosition);
    
    return intersect;
  };

  // Animation et mise à jour des positions
  useFrame(() => {
    if (!geometry || !isEditMode) return;

    // Mettre à jour la position de la souris dans l'espace 3D
    const intersect = updateMousePosition(mousePositionRef.current);
    
    if (!intersect) return;

    // Mettre à jour la position de la sphère d'influence
    if (sphereRef.current) {
      sphereRef.current.position.copy(mousePositionRef.current);
    }

    // Mettre à jour la position de la souris dans le shader
    if (material) {
      material.uniforms.mousePosition.value.copy(mousePositionRef.current);
      material.uniformsNeedUpdate = true;  // Forcer la mise à jour des uniforms
    }

    if (!isDragging) return;

    // Calculer le déplacement de la souris
    const mouseDelta = mousePositionRef.current.clone().sub(lastMousePositionRef.current);

    const positions = geometry.attributes.position.array;
    const originalPositions = originalPositionsRef.current;
    
    if (!originalPositions) return;

    // Mettre à jour les positions des points
    for (let i = 0; i < positions.length; i += 3) {
      const pointPosition = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );

      // Calculer la distance entre le point et la souris
      const distance = pointPosition.distanceTo(lastMousePositionRef.current);

      // Déplacer les points qui sont dans le rayon d'influence
      if (distance < radius) {
        // Calculer un facteur d'influence basé sur la distance avec une fonction quadratique
        // (1 - x)² donne une courbe qui décroit plus rapidement vers les bords
        const normalizedDistance = distance / radius;
        const influence = Math.pow(1 - normalizedDistance, 2);
        
        // Appliquer le déplacement avec l'influence
        positions[i] += mouseDelta.x * influence * strength * 0.01;
        positions[i + 1] += mouseDelta.y * influence * strength * 0.01;
        positions[i + 2] += mouseDelta.z * influence * strength * 0.01;
      }
    }

    // Mettre à jour la dernière position de la souris
    lastMousePositionRef.current.copy(mousePositionRef.current);

    geometry.attributes.position.needsUpdate = true;
  });

  // Gestionnaires d'événements pour la souris
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (event) => {
      if (isEditMode && event.button === 0) {
        setIsDragging(true);
        // Initialiser la dernière position de la souris
        updateMousePosition(mousePositionRef.current);
        lastMousePositionRef.current.copy(mousePositionRef.current);
        event.stopPropagation();
      }
    };

    const handleMouseUp = (event) => {
      if (isEditMode && event.button === 0) {
        setIsDragging(false);
        // Mettre à jour les positions originales avec les positions actuelles
        if (geometry && originalPositionsRef.current) {
          const currentPositions = geometry.attributes.position.array;
          originalPositionsRef.current = currentPositions.slice();
        }
        event.stopPropagation();
      }
    };

    const handleMouseMove = (event) => {
      // Si on est en train de déplacer les posts, empêcher les contrôles de caméra
      if (isDragging) {
        event.stopPropagation();
      }
    };

    if (isEditMode) {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseUp);
    }

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [gl, isEditMode, isDragging, geometry]);

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

  return (
    <>
      <points ref={pointsRef} geometry={geometry} material={material} />
      {isEditMode && (
        <group ref={sphereRef}>
          {/* Cercle pour représenter le bord de la sphère face à la caméra */}
          <mesh>
            <ringGeometry args={[radius - 0.5, radius, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.2} side={THREE.FrontSide} />
          </mesh>
          {/* Point central */}
          <mesh>
            <sphereGeometry args={[2, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      )}
    </>
  );
}

export default PostsRenderer;
