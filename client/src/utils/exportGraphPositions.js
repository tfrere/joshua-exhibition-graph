/**
 * Utilitaire pour exporter les positions actuelles du graphe
 * Ce script peut être utilisé pour sauvegarder l'état du graphe après un agencement manuel
 */

/**
 * Exporte les positions actuelles des nœuds d'un graphe dans un format JSON.
 * Cette fonction est conçue pour être appelée depuis le composant ForceGraph.
 * 
 * @param {Object} graphRef - Référence au composant ForceGraph
 * @returns {Object} Données du graphe avec positions des noeuds
 */
export function exportGraphPositions(graphRef) {
  if (!graphRef || !graphRef.current) {
    console.error("Référence au graphe non valide");
    return null;
  }

  try {
    // Récupérer les données du graphe
    const graphData = graphRef.current.graphData();
    
    if (!graphData || !graphData.nodes) {
      console.error("Données du graphe non disponibles");
      return null;
    }
    
    // Créer une copie des données avec seulement les informations essentielles
    const simplifiedData = {
      nodes: graphData.nodes.map(node => ({
        id: node.id,
        slug: node.slug,
        type: node.type,
        x: node.x,
        y: node.y,
        z: node.z
      })),
      // Inclure les liens pour référence, mais sans les positions
      links: graphData.links.map(link => ({
        source: typeof link.source === 'object' ? link.source.id : link.source,
        target: typeof link.target === 'object' ? link.target.id : link.target,
        type: link.type,
        value: link.value
      }))
    };
    
    return simplifiedData;
  } catch (error) {
    console.error("Erreur lors de l'exportation des positions du graphe :", error);
    return null;
  }
} 