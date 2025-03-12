import * as THREE from "three";

// Fonction pour calculer la tangente à une courbe de Bézier quadratique en un point t (0 ≤ t ≤ 1)
export const calculateBezierTangent = (p0, p1, p2, t) => {
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

// Fonction utilitaire pour calculer les points de la courbe du lien
export const calculateLinkPoints = (
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
