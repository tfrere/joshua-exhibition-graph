import React, { useMemo } from "react";
import * as THREE from "three";
import LinkLine from "./LinkLine";
import LinkArrow from "./LinkArrow";
import LinkText from "./LinkText";
import { calculateLinkPoints } from "./utils";

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
  arrowSize = 10, // Taille de la flèche (facteur multiplicatif)
  opacity = 0.4, // Opacité commune pour la ligne et la flèche
  // Paramètres pour le texte
  textSize = 1,
  textOpacity = 0.9,
  textBackgroundColor = "rgba(0,0,0,0.2)",
}) => {
  // Determine if the link is dashed (indirect)
  const isDashed = link.isDirect === "Indirect";

  // Calculer le startOffset en fonction du type de noeud
  const actualStartOffset = useMemo(() => {
    // Si le noeud source est de type "central", on multiplie le startOffset par 3
    if (sourceNode.type === "central") {
      return startOffset * 2;
    }
    // Sinon, on utilise la valeur normale
    return startOffset;
  }, [sourceNode, startOffset]);

  // Calculate link points with offsets
  const { points, curve } = useMemo(
    () =>
      calculateLinkPoints(
        sourceNode,
        targetNode,
        arcHeight,
        actualStartOffset, // Utiliser la valeur calculée ici
        endOffset
      ),
    [sourceNode, targetNode, actualStartOffset, endOffset, arcHeight] // Mettre à jour les dépendances
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
        opacity={opacity}
      />

      {/* Arrow at the end of the link */}
      <LinkArrow
        points={points}
        linkColor={linkColor}
        curve={curve}
        depth={depth}
        arrowSize={arrowSize}
        opacity={opacity}
        linkWidth={linkWidth}
      />

      {/* Text label in the middle of the link */}
      {/* <LinkText
        points={points}
        linkColor={linkColor}
        relationType={link.type || "relation"}
        depth={depth}
        textSize={textSize}
        textOpacity={textOpacity}
        textBackgroundColor={textBackgroundColor}
      /> */}
    </group>
  );
};

export default Link;
