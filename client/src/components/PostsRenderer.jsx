import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { useData } from "../contexts/DataContext";

// Type de données pour les posts (pour référence)
/**
 * @typedef {Object} Post
 * @property {string} id - ID unique du post
 * @property {number} x - Position X
 * @property {number} y - Position Y
 * @property {number} z - Position Z
 * @property {string} content - Contenu du post
 * @property {string} [source] - Source du post
 * @property {string} [date] - Date du post
 */

/**
 * Composant pour le rendu optimisé des posts
 * @param {Object} props - Propriétés du composant
 * @param {Post[]} props.posts - Liste des posts à afficher
 */
export function PostsRenderer({ posts }) {
  const { postsData, isLoadingPosts, postsError } = useData();
  const instancedMeshRef = useRef();
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#6699cc",
        emissiveIntensity: 0.5,
        toneMapped: false,
      }),
    []
  );

  useEffect(() => {
    console.log("postsData", postsData);
  }, [postsData]);

  // Utiliser la technique des instances pour améliorer les performances
  return (
    isLoadingPosts && (
      <Instances
        limit={50000} // Limite du nombre d'instances
        ref={instancedMeshRef}
        geometry={sphereGeometry}
        material={material}
      >
        {postsData.map((post) => (
          <Instance
            key={post.id}
            position={[post.x, post.y, post.z]}
            scale={[2, 2, 2]}
          />
        ))}
      </Instances>
    )
  );
}

export default PostsRenderer;

/**
 * Composant pour optimiser le rendu en ne rendant que les objets visibles
 */
export function FrustumCuller() {
  const { camera } = useThree();
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(() => {
    // Mettre à jour la matrice de projection
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Parcourir tous les objets de la scène et les masquer s'ils sont hors du champ de vision
    camera.updateMatrixWorld();
  });

  return null;
}
