import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useData } from "../contexts/DataContext";
import { useControls, folder } from "leva";

// Type de données pour les posts (pour référence)
/**
 * @typedef {Object} Post
 * @property {string} id - ID unique du post
 * @property {Object} coordinates - Coordonnées 3D du post
 * @property {number} coordinates.x - Position X
 * @property {number} coordinates.y - Position Y
 * @property {number} coordinates.z - Position Z
 * @property {Array} color - Couleur RGB du post
 */

const SIZE = 2;

/**
 * Composant pour le rendu ultra-optimisé des posts
 */
export function PostsRenderer() {
  const { postsData, isLoadingPosts } = useData();
  const pointsRef = useRef();
  const { camera } = useThree();

  // Ajouter un contrôle Leva pour la taille des points dans un groupe dédié
  const { pointSize } = useControls({
    "Posts Renderer": folder({
      pointSize: {
        value: SIZE,
        min: 0.5,
        max: 10,
        step: 0.5,
        label: "Taille des points",
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
    if (!postsData || postsData.length === 0) return [null, null];

    // Afficher au maximum 40000 points
    const maxPoints = Math.min(postsData.length, 40000);

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
      const post = postsData[i];
      const i3 = i * 3;

      // Position
      positions[i3] = post.coordinates.x;
      positions[i3 + 1] = post.coordinates.y;
      positions[i3 + 2] = post.coordinates.z;

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

      // Taille (légèrement aléatoire pour plus de variété)
      sizes[i] = 10 + Math.random() * 5;
    }

    // Ajouter les attributs à la géométrie
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Créer le matériau
    const mat = new THREE.PointsMaterial({
      size: pointSize,
      sizeAttenuation: true,
      map: pointTexture,
      alphaTest: 0.1,
      transparent: true,
      vertexColors: true,
    });

    return [geo, mat];
  }, [postsData, pointTexture, pointSize]);

  // Optimisation: réduire la taille des points quand ils sont loin de la caméra
  useFrame(() => {
    if (pointsRef.current) {
      // Mise à jour dynamique des tailles en fonction de la distance
      const positions = pointsRef.current.geometry.attributes.position.array;
      const sizes = pointsRef.current.geometry.attributes.size.array;
      const count = sizes.length;

      const cameraPosition = camera.position;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];

        // Calculer la distance au carré (plus rapide que sqrt)
        const distanceSq =
          (x - cameraPosition.x) * (x - cameraPosition.x) +
          (y - cameraPosition.y) * (y - cameraPosition.y) +
          (z - cameraPosition.z) * (z - cameraPosition.z);

        // Ajuster la taille en fonction de la distance, en utilisant le pointSize comme base
        sizes[i] = Math.min(
          pointSize + 500 / (1 + distanceSq / 10000),
          pointSize * 1.5
        );
      }

      pointsRef.current.geometry.attributes.size.needsUpdate = true;

      // Mettre à jour la taille globale des points
      if (pointsRef.current.material.size !== pointSize) {
        pointsRef.current.material.size = pointSize;
        pointsRef.current.material.needsUpdate = true;
      }
    }
  });

  useEffect(() => {
    if (postsData && postsData.length > 0) {
      console.log(`postsData chargés (${postsData.length} points)`);
    }
  }, [postsData]);

  // Ne rien afficher pendant le chargement ou si pas de données
  if (
    isLoadingPosts ||
    !postsData ||
    postsData.length === 0 ||
    !geometry ||
    !material
  ) {
    return null;
  }

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export default PostsRenderer;
