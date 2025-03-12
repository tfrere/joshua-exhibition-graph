import React, { useRef, useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// Composant pour le texte affiché le long du lien
const LinkText = ({
  points,
  linkColor,
  relationType,
  depth,
  textBackgroundColor = "rgba(0,0,0,0.2)", // Couleur du fond du texte
  textSize = 1, // Taille du texte
  textOpacity = 0.9, // Opacité du texte
}) => {
  const textRef = useRef();

  // Calculer la position et l'orientation du texte
  const textData = useMemo(() => {
    if (points.length < 5 || !relationType) return null;

    // Position à mi-chemin du lien (on prend un point qui est à peu près au milieu)
    const textPosition = points[Math.floor(points.length / 2)];

    // On calcule la direction locale à cette position
    const prevPoint = points[Math.floor(points.length / 2) - 1];
    const nextPoint = points[Math.floor(points.length / 2) + 1];

    // Direction dans laquelle orienter le texte
    const direction = new THREE.Vector3()
      .subVectors(nextPoint, prevPoint)
      .normalize();

    // Créer un repère orthonormé
    let right = new THREE.Vector3(1, 0, 0);
    if (Math.abs(direction.dot(right)) > 0.9) {
      right = new THREE.Vector3(0, 1, 0);
    }

    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    right = new THREE.Vector3().crossVectors(direction, up).normalize();

    // Matrice pour aligner le texte le long du lien
    const matrix = new THREE.Matrix4().makeBasis(
      direction, // Axe X aligné sur la direction du lien
      up, // Axe Y vers le haut
      right // Axe Z perpendiculaire
    );
    const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

    // Décalage vers le haut pour éviter que le texte ne chevauche le lien
    const offsetPosition = textPosition.clone().add(up.multiplyScalar(1));

    return {
      position: offsetPosition,
      rotation: rotation,
    };
  }, [points, relationType]);

  if (!textData || !relationType) return null;

  // Augmenter légèrement la luminosité de la couleur du texte pour plus de contraste
  const textColor = new THREE.Color(linkColor).convertSRGBToLinear();
  textColor.multiplyScalar(1.2); // Augmenter la luminosité de 20%

  return (
    <Text
      ref={textRef}
      position={textData.position}
      rotation={textData.rotation}
      fontSize={textSize}
      font={"/fonts/caveat.ttf"}
      color={textColor.getStyle()}
      anchorX="center"
      anchorY="middle"
      depthTest={false}
      renderOrder={2}
      transparent
      opacity={textOpacity}
      billboardAxis="y" // Le texte pivotera autour de l'axe Y pour faire face à la caméra
      outlineWidth={0.05} // Contour léger
      outlineColor="#000000" // Contour noir
      outlineOpacity={0.5} // Semi-transparent
      backgroundColor={textBackgroundColor} // Fond légèrement transparent
      backgroundOpacity={0.6} // Opacité du fond
      padding={0.2} // Padding pour aérer le texte dans son cadre
    >
      {relationType}
    </Text>
  );
};

export default LinkText;
