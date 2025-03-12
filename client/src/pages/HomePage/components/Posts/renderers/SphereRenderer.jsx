import { useRef, useEffect } from "react";
import * as THREE from "three";

/**
 * Renderer qui utilise des sphères pour représenter les posts
 * Conserve toute la logique d'animation mais change juste la géométrie
 *
 * @param {Object} props - Propriétés du composant
 * @param {Object} props.meshRef - Référence au maillage
 * @param {Array} props.data - Données des posts
 * @param {number} [props.SPHERE_SEGMENTS=8] - Nombre de segments pour la géométrie de la sphère
 * @param {number} [props.SIZE=0.125] - Taille de base des sphères
 * @param {number} [props.MIN_IMPACT_SIZE=10] - Taille minimale pour l'échelle d'impact
 * @param {number} [props.MAX_IMPACT_SIZE=50] - Taille maximale pour l'échelle d'impact
 */
export function SphereRenderer({
  meshRef,
  data,
  SPHERE_SEGMENTS = 6,
  SIZE = 0.125,
  MIN_IMPACT_SIZE = 7,
  MAX_IMPACT_SIZE = 40,
}) {
  // Référence interne si aucune n'est fournie
  const internalMeshRef = useRef();
  const actualMeshRef = meshRef || internalMeshRef;

  // Effet pour journaliser lorsque le renderer est monté
  useEffect(() => {
    console.log("SphereRenderer initialisé avec", data?.length || 0, "posts");
    return () => {
      console.log("SphereRenderer démonté");
    };
  }, [data]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={actualMeshRef}
      args={[null, null, data.length]}
      frustumCulled={false}
      renderOrder={10}
    >
      <sphereGeometry args={[0.05, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
      <meshLambertMaterial
        transparent={true}
        opacity={1}
        color="white"
        side={THREE.DoubleSide}
        toneMapped={false}
        depthWrite={true}
        depthTest={true}
      />
    </instancedMesh>
  );
}

export default SphereRenderer;
