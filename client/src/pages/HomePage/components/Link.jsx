import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// Composant pour la ligne du lien (trait plein ou pointillé)
const LinkLine = ({
  points,
  isDashed,
  linkColor,
  linkWidth,
  dashSize,
  gapSize,
  depth,
}) => {
  const meshRef = useRef();

  // Create line geometry with line distances for dashed lines
  const lineGeometry = useMemo(() => {
    // Create a regular BufferGeometry from points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // For dashed lines, we need to add the LineDistances attribute
    if (isDashed) {
      // Calculate distances manually
      const distances = [];
      let cumulativeDistance = 0;

      for (let i = 0; i < points.length; i++) {
        if (i === 0) {
          distances.push(0);
        } else {
          // Add distance from previous point
          const distance = points[i].distanceTo(points[i - 1]);
          cumulativeDistance += distance;
          distances.push(cumulativeDistance);
        }
      }

      // Add LineDistances attribute to the geometry
      geometry.setAttribute(
        "lineDistance",
        new THREE.Float32BufferAttribute(distances, 1)
      );
    }

    return geometry;
  }, [points, isDashed]);
  // // Animation subtile
  // useFrame((state) => {
  //   if (meshRef.current) {
  //     const elapsedTime = state.clock.getElapsedTime();
  //     const initialDelay = 3; // 3 secondes
  //     const depthDelay = 0.6 * depth; // 300ms par depth

  //     if (elapsedTime < initialDelay + depthDelay) {
  //       meshRef.current.material.opacity = 0;
  //     } else {
  //       meshRef.current.material.opacity = THREE.MathUtils.lerp(
  //         0.6,
  //         1.0,
  //         (elapsedTime - initialDelay - depthDelay) / 1
  //       );
  //     }
  //   }
  // });
  return (
    <line ref={meshRef}>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      {isDashed ? (
        <lineDashedMaterial
          attach="material"
          color={linkColor}
          linewidth={linkWidth}
          transparent={true}
          opacity={0.4}
          dashSize={dashSize}
          gapSize={gapSize}
          scale={1} // Ajout d'un facteur de scale explicite
        />
      ) : (
        <lineBasicMaterial
          attach="material"
          color={linkColor}
          linewidth={linkWidth}
          transparent={true}
          opacity={0.4}
          linecap="round"
          linejoin="round"
        />
      )}
    </line>
  );
};

// Fonction pour calculer la tangente à une courbe de Bézier quadratique en un point t (0 ≤ t ≤ 1)
const calculateBezierTangent = (p0, p1, p2, t) => {
  // La dérivée d'une courbe de Bézier quadratique est:
  // P'(t) = 2(1-t)(p1-p0) + 2t(p2-p1)
  const mt = 1 - t;

  const tangent = new THREE.Vector3()
    .subVectors(p1, p0)
    .multiplyScalar(2 * mt)
    .add(new THREE.Vector3().subVectors(p2, p1).multiplyScalar(2 * t))
    .normalize();

  return tangent;
};

// Composant pour la flèche au bout du lien
const LinkArrow = ({ points, linkColor, curve, depth }) => {
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

    // On crée un repère orthonormé pour orienter correctement notre cône
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

  // Animation subtile
  useFrame((state) => {
    if (arrowRef.current) {
      const elapsedTime = state.clock.getElapsedTime();
      const initialDelay = 3; // 3 secondes
      const depthDelay = 0.3 * depth; // 300ms par depth

      if (elapsedTime < initialDelay + depthDelay) {
        arrowRef.current.material.opacity = 0.6;
      } else {
        arrowRef.current.material.opacity = THREE.MathUtils.lerp(
          0.6,
          1.0,
          (elapsedTime - initialDelay - depthDelay) / 1
        );
      }
    }
  });

  // Make arrow color slightly brighter for better visibility
  const arrowColor = new THREE.Color(linkColor).addScalar(0.2).getStyle();

  if (!arrowHelper) return null;

  return (
    <mesh
      ref={arrowRef}
      position={arrowHelper.position}
      rotation={arrowHelper.rotation}
    >
      <coneGeometry attach="geometry" args={[0.2, 0.5, 12]} />
      <meshBasicMaterial
        attach="material"
        color={arrowColor}
        transparent={true}
        opacity={0.9}
      />
    </mesh>
  );
};

// Composant pour le texte affiché le long du lien
const LinkText = ({ points, linkColor, relationType, depth }) => {
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

  return (
    <Text
      ref={textRef}
      position={textData.position}
      rotation={textData.rotation}
      fontSize={1}
      font={"/fonts/caveat.ttf"}
      color={linkColor}
      anchorX="center"
      anchorY="middle"
      depthTest={false}
      renderOrder={1}
      transparent
      opacity={0.9}
    >
      {relationType}
    </Text>
  );
};

// Fonction utilitaire pour calculer les points de la courbe du lien
const calculateLinkPoints = (
  sourceNode,
  targetNode,
  startOffset,
  endOffset,
  arcHeight = 0.5 // Paramètre d'intensité de la courbe (défaut : 0.5)
) => {
  // Calculate source and target positions
  const sourcePos = new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z);
  const targetPos = new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z);

  // Calculate direction vectors
  const directVector = new THREE.Vector3()
    .subVectors(targetPos, sourcePos)
    .normalize();

  // Apply offsets to start and end points
  const adjustedSourcePos = new THREE.Vector3()
    .copy(sourcePos)
    .add(directVector.clone().multiplyScalar(startOffset));

  const adjustedTargetPos = new THREE.Vector3()
    .copy(targetPos)
    .sub(directVector.clone().multiplyScalar(endOffset));

  // Calculer la distance entre les deux points
  const distance = adjustedSourcePos.distanceTo(adjustedTargetPos);

  // Créer le point de contrôle pour la courbe de Bézier quadratique
  // Calculer le point médian entre les deux points
  const midPoint = new THREE.Vector3()
    .addVectors(adjustedSourcePos, adjustedTargetPos)
    .multiplyScalar(0.5);

  // Créer un vecteur perpendiculaire au vecteur direct
  const perpendicularVector = new THREE.Vector3(
    directVector.z,
    directVector.y,
    -directVector.x
  );

  // Assurer que le vecteur perpendiculaire pointe "vers le haut" relativement à la scène
  const upVector = new THREE.Vector3(0, 1, 0);
  if (perpendicularVector.dot(upVector) < 0) {
    perpendicularVector.negate();
  }

  // Créer le point de contrôle en ajoutant un décalage dans la direction perpendiculaire
  // L'intensité de la courbe est proportionnelle à la distance entre les nœuds
  const controlPoint = new THREE.Vector3()
    .copy(midPoint)
    .add(perpendicularVector.multiplyScalar(distance * arcHeight));

  const translationVector = perpendicularVector
    .clone()
    .divideScalar((distance * arcHeight) / Math.PI / 2);

  // On applique cette translation aux trois points clés
  adjustedSourcePos.add(translationVector);
  controlPoint.add(translationVector);
  adjustedTargetPos.add(translationVector);

  // Créer la courbe de Bézier avec les positions ajustées
  const curve = new THREE.QuadraticBezierCurve3(
    adjustedSourcePos,
    controlPoint,
    adjustedTargetPos
  );

  // Générer plus de points pour une courbe plus lisse
  return {
    points: curve.getPoints(20),
    curve: curve, // Retourner également la courbe pour calculer la tangente
  };
};

// Composant ArcLink - Alternative au composant Link standard avec un arc
const Link = ({
  link,
  sourceNode,
  targetNode,
  depth = 0,
  dashSize = 3,
  gapSize = 3,
  startOffset = 10,
  endOffset = 10,
  arcHeight = 0.3, // Valeur par défaut plus élevée pour des arcs plus visibles
  linkWidth = 1.5,
}) => {
  // Determine if the link is dashed (indirect)
  const isDashed = link.isDirect === "Indirect";

  // Calculate link points with offsets
  const { points, curve } = useMemo(
    () =>
      calculateLinkPoints(
        sourceNode,
        targetNode,
        startOffset,
        endOffset,
        arcHeight
      ),
    [sourceNode, targetNode, startOffset, endOffset, arcHeight]
  );

  // Link color
  const linkColor = useMemo(() => {
    // Default color
    return link.color || "#ffffff";
  }, [link.color]);

  return (
    <group>
      {/* Line */}
      <LinkLine
        points={points}
        depth={depth}
        isDashed={isDashed}
        linkColor={linkColor}
        linkWidth={linkWidth}
        dashSize={dashSize}
        gapSize={gapSize}
      />

      {/* Arrow at the end of the link */}
      <LinkArrow
        points={points}
        linkColor={linkColor}
        curve={curve}
        depth={depth}
      />

      {/* Text label in the middle of the link */}
      {/* <LinkText
        points={points}
        linkColor={linkColor}
        relationType={link.type || "relation"}
        depth={depth}
      /> */}
    </group>
  );
};

export default Link;
