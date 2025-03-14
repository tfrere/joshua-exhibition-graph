import React from "react";

// Composant pour afficher une sphère si aucune image SVG n'est disponible
const NodeSphere = ({ size, color, isSelected }) => {
  return (
    <>
      <sphereGeometry args={[size || 0.5, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.8}
        emissive={isSelected ? "#FFF" : "#FFF"}
        emissiveIntensity={0.5}
      />
    </>
  );
};

export default NodeSphere;
