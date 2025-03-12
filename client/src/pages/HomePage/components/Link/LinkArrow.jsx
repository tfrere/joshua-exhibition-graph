import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { calculateBezierTangent } from "./utils";

// Composant pour la flèche au bout du lien
const LinkArrow = ({
  points,
  linkColor,
  curve,
  depth,
  arrowSize = 1,
  opacity = 0.6,
  linkWidth = 1.5, // Récupérer la largeur de ligne
}) => {
  const arrowRef = useRef();

  // Calculer le système d'axes pour orienter correctement la flèche
  const arrowHelper = useMemo(() => {
    if (points.length < 2) return null;

    // Position à la fin du lien
    const endPosition = points[points.length - 1];

    // Direction : soit à partir de la tangente à la courbe (si disponible),
    // soit à partir des deux derniers points
    let direction;

    if (curve) {
      // Utiliser la tangente à la courbe de Bézier au point t=1 (fin de la courbe)
      direction = calculateBezierTangent(
        curve.v0, // Point de départ (ajusté)
        curve.v1, // Point de contrôle
        curve.v2, // Point d'arrivée (ajusté)
        1 // Paramètre t=1 pour la fin de la courbe
      );
    } else {
      // Utiliser la direction entre les deux derniers points si la courbe n'est pas disponible
      direction = new THREE.Vector3()
        .subVectors(points[points.length - 1], points[points.length - 2])
        .normalize();
    }

    // On crée un repère orthonormé pour orienter correctement notre flèche
    let right = new THREE.Vector3(1, 0, 0);
    if (Math.abs(direction.dot(right)) > 0.9) {
      right = new THREE.Vector3(0, 1, 0);
    }

    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    right = new THREE.Vector3().crossVectors(direction, up).normalize();

    // Créer une matrice de transformation complète
    const matrix = new THREE.Matrix4().makeBasis(right, direction, up);
    // Extraire la rotation en Euler à partir de la matrice
    const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

    return {
      position: endPosition,
      rotation: rotation,
    };
  }, [points, curve]);

  // Animation désactivée pour assurer la cohérence avec la ligne
  // useFrame((state) => {
  //   if (arrowRef.current) {
  //     const elapsedTime = state.clock.getElapsedTime();
  //     const initialDelay = 3; // 3 secondes
  //     const depthDelay = 0.3 * depth; // 300ms par depth

  //     // Calculer l'opacité cible en fonction de l'opacité de base
  //     const minOpacity = opacity * 0.8; // 80% de l'opacité fournie
  //     const maxOpacity = opacity; // 100% de l'opacité fournie

  //     const targetOpacity =
  //       elapsedTime < initialDelay + depthDelay
  //         ? minOpacity
  //         : THREE.MathUtils.lerp(
  //             minOpacity,
  //             maxOpacity,
  //             (elapsedTime - initialDelay - depthDelay) / 1
  //           );

  //     // Appliquer l'opacité à chaque ligne enfant
  //     arrowRef.current.children.forEach((line) => {
  //       if (line.material) {
  //         line.material.opacity = targetOpacity;
  //       }
  //     });
  //   }
  // });

  // Utiliser la même couleur que la ligne principale
  const arrowColor = linkColor;

  if (!arrowHelper) return null;

  // Création des points pour dessiner une flèche
  const createArrowPoints = () => {
    // Dimensions de base de la flèche
    const baseLength = 0.5 * arrowSize;
    const wingLength = 0.3 * arrowSize;
    const wingWidth = 0.15 * arrowSize;

    // Points pour dessiner une flèche (dans un repère local où la flèche pointe vers +Y)
    // Pointe de la flèche à l'origine
    const tip = new THREE.Vector3(0, 0, 0);
    // Points formant les ailes de la flèche
    const leftWing = new THREE.Vector3(-wingWidth, -wingLength, 0);
    const rightWing = new THREE.Vector3(wingWidth, -wingLength, 0);

    // Aile gauche
    const leftWingLine = [leftWing, tip];
    // Aile droite
    const rightWingLine = [rightWing, tip];

    return { leftWingLine, rightWingLine };
  };

  const { leftWingLine, rightWingLine } = createArrowPoints();

  return (
    <group
      ref={arrowRef}
      position={arrowHelper.position}
      rotation={arrowHelper.rotation}
    >
      {/* Aile gauche */}
      <line>
        <bufferGeometry attach="geometry">
          <float32BufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                leftWingLine[0].x,
                leftWingLine[0].y,
                leftWingLine[0].z,
                leftWingLine[1].x,
                leftWingLine[1].y,
                leftWingLine[1].z,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          attach="material"
          color={arrowColor}
          linewidth={linkWidth}
          transparent={true}
          opacity={opacity}
          linecap="round"
          linejoin="round"
        />
      </line>

      {/* Aile droite */}
      <line>
        <bufferGeometry attach="geometry">
          <float32BufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                rightWingLine[0].x,
                rightWingLine[0].y,
                rightWingLine[0].z,
                rightWingLine[1].x,
                rightWingLine[1].y,
                rightWingLine[1].z,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          attach="material"
          color={arrowColor}
          linewidth={linkWidth}
          transparent={true}
          opacity={opacity}
          linecap="round"
          linejoin="round"
        />
      </line>
    </group>
  );
};

export default LinkArrow;
