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
  arcHeight = 0.5 // Paramètre d'intensité de la courbe (défaut : 0.5)
) => {
  // Calculate source and target positions
  const sourcePos = new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z);
  const targetPos = new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z);

  // Calculate direction vectors
  const directVector = new THREE.Vector3()
    .subVectors(targetPos, sourcePos)
    .normalize();

  // Calculer la distance entre les deux points
  const distance = sourcePos.distanceTo(targetPos);

  // Créer le point de contrôle pour la courbe de Bézier quadratique
  // Calculer le point médian entre les deux points
  const midPoint = new THREE.Vector3()
    .addVectors(sourcePos, targetPos)
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
    .add(perpendicularVector.multiplyScalar(distance / 50 * arcHeight));

  // Créer la courbe de Bézier avec les positions ajustées
  const curve = new THREE.QuadraticBezierCurve3(
    sourcePos,
    controlPoint,
    targetPos
  );

  // Distance fixe depuis les nœuds en unités réelles
  const FIXED_DISTANCE_FROM_NODE = 12.0; // Distance fixe en unités (à ajuster selon les besoins)

  // Initialiser les variables pour stocker les résultats
  let startT = 0, endT = 1;

  // Calculer le nombre de points en fonction de la distance
  const MIN_POINTS = 32; // Minimum de points pour les courtes distances
  const MAX_POINTS = 64; // Maximum de points pour les longues distances
  const POINTS_PER_UNIT = 10; // Facteur de points par unité de distance
  
  // Calculer le nombre de points basé sur la distance
  let numPoints = Math.round(distance * POINTS_PER_UNIT);
  
  // Appliquer les limites min/max
  numPoints = Math.max(MIN_POINTS, Math.min(numPoints, MAX_POINTS));
  
  // S'assurer que c'est un nombre pair
  if (numPoints % 2 !== 0) numPoints++;

  // Cas spécial: si FIXED_DISTANCE_FROM_NODE est 0, utiliser les points exacts des nœuds
  if (FIXED_DISTANCE_FROM_NODE === 0) {
    return {
      points: [sourcePos, ...curve.getPoints(numPoints - 2), targetPos],
      curve: curve,
    };
  }

  // ---- Nouvelle approche pour garantir une distance constante ----
  // Générer un grand nombre de points pour l'approximation
  const allPoints = curve.getPoints(numPoints * 2);
  
  // Trouver le premier point qui est à FIXED_DISTANCE_FROM_NODE du nœud source
  // et le dernier point qui est à FIXED_DISTANCE_FROM_NODE du nœud cible
  let startIndex = 0;
  let endIndex = allPoints.length - 1;
  
  // Trouver le point de départ (à distance constante du nœud source)
  for (let i = 0; i < allPoints.length; i++) {
    const distanceFromSource = allPoints[i].distanceTo(sourcePos);
    if (distanceFromSource >= FIXED_DISTANCE_FROM_NODE) {
      startIndex = i;
      
      // Calculer le paramètre t approximatif pour ce point
      startT = i / (allPoints.length - 1);
      break;
    }
  }
  
  // Trouver le point d'arrivée (à distance constante du nœud cible)
  for (let i = allPoints.length - 1; i >= 0; i--) {
    const distanceFromTarget = allPoints[i].distanceTo(targetPos);
    if (distanceFromTarget >= FIXED_DISTANCE_FROM_NODE) {
      endIndex = i;
      
      // Calculer le paramètre t approximatif pour ce point
      endT = i / (allPoints.length - 1);
      break;
    }
  }
  
  // S'assurer que les points trouvés sont valides
  const validRange = startIndex < endIndex;
  
  // Générer les points de la courbe entre startPoint et endPoint
  let trimmedPoints = [];
  
  if (validRange) {
    // Utiliser les paramètres t trouvés pour générer un ensemble de points bien distribués
    const steps = numPoints;
    const tStep = (endT - startT) / (steps - 1);
    
    for (let i = 0; i < steps; i++) {
      const t = startT + i * tStep;
      trimmedPoints.push(curve.getPoint(t));
    }
  } else {
    // Fallback au cas où la courbe est trop courte pour les distances demandées
    console.warn("Courbe trop courte pour les distances demandées - utilisation de 70% de la courbe");
    trimmedPoints = allPoints.slice(
      Math.floor(allPoints.length * 0.15),
      Math.ceil(allPoints.length * 0.85)
    );
  }
  
  // Retourner les points tronqués et la courbe complète
  return {
    points: trimmedPoints,
    curve: curve, // Retourner également la courbe pour calculer la tangente
  };
};
