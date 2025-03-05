import { Node, Link } from "../types/graph";

interface Post {
  uid: string;
  creationDate: string;
  content: string;
  platform: string;
  url: string;
  likes: number;
  shares: number;
  comments: number;
  displayName: string;
  sourceType: string;
}

export async function generateGraphData() {
  try {
    console.log("Début de la génération du graphe...");
    
    // Charger uniquement les posts
    const postsResponse = await fetch('/data/3_posts_flatlist.json');
    const allPosts: Post[] = await postsResponse.json();
    console.log(`Nombre total de posts chargés: ${allPosts.length}`);

    // Utiliser tous les posts sans échantillonnage
    console.log("Mode sans échantillonnage activé: tous les posts seront conservés");
    const posts = allPosts;
    
    // Créer un ensemble unique pour displayName
    const displayNames = new Set<string>();
    
    // Créer un ensemble unique pour les paires {displayName, sourceType}
    const displayNameSourceTypePairs = new Set<string>();
    
    // Créer une map pour stocker les sourceTypes par displayName
    const displayNameToSourceTypes = new Map<string, Set<string>>();
    
    posts.forEach(post => {
      displayNames.add(post.displayName);
      displayNameSourceTypePairs.add(`${post.displayName}|${post.sourceType}`);
      
      // Ajouter le sourceType à l'ensemble des sourceTypes pour ce displayName
      if (!displayNameToSourceTypes.has(post.displayName)) {
        displayNameToSourceTypes.set(post.displayName, new Set());
      }
      displayNameToSourceTypes.get(post.displayName)?.add(post.sourceType);
    });

    console.log(`Nombre de displayNames uniques: ${displayNames.size}`);
    console.log(`Nombre de paires {displayName, sourceType} uniques: ${displayNameSourceTypePairs.size}`);
    
    // Créer les nœuds pour les displayName (en rouge)
    const displayNameNodes: Node[] = Array.from(displayNames).map(name => ({
      id: `name-${name}`,
      name,
      type: "character",
      val: 30,
      color: "#ff0000" // Rouge
    }));

    // Créer les nœuds pour les paires {displayName, sourceType} (en bleu)
    const pairNodes: Node[] = Array.from(displayNameSourceTypePairs).map(pair => {
      const [name, sourceType] = pair.split("|");
      return {
        id: `pair-${pair}`,
        name: `${name} (${sourceType})`,
        type: "source",
        val: 20,
        color: "#0000ff" // Bleu
      };
    });

    // Créer les nœuds pour les posts (en orange)
    const postNodes: Node[] = posts.map(post => ({
      id: `post-${post.displayName}|${post.sourceType}|${post.creationDate}`,
      name: post.uid,
      type: "post",
      val: 10, // Plus petits que les autres nœuds
      color: "#ffa500" // Orange
    }));

    // Créer un nœud central unique (en vert)
    const centralNode: Node = {
      id: "central",
      name: "Nœud Central",
      type: "character",
      val: 50, // Plus grand que les autres nœuds
      color: "#00ff00" // Vert
    };

    console.log("Nœuds créés:");
    console.log(`- Nœud central (vert): 1`);
    console.log(`- Nœuds displayName (rouges): ${displayNameNodes.length}`);
    console.log(`- Nœuds {displayName, sourceType} (bleus): ${pairNodes.length}`);
    console.log(`- Nœuds posts (orange): ${postNodes.length}`);
    console.log(`- Total des nœuds: ${1 + displayNameNodes.length + pairNodes.length + postNodes.length}`);

    // Créer les liens entre displayName et leurs paires {displayName, sourceType}
    const links: Link[] = [];
    let centralLinksCreated = 0;
    let characterSourceLinksCreated = 0;
    let sourcePostLinksCreated = 0;
    let missingSourceNodeCount = 0;
    let missingTargetNodeCount = 0;
    
    // Liens central -> displayName
    displayNameNodes.forEach(node => {
      const link = {
        source: "central",
        target: node.id,
        type: "central-character",
        value: 1
      };
      links.push(link);
      centralLinksCreated++;
    });
    
    console.log(`Liens niveau 0 (central-character) créés: ${centralLinksCreated}`);
    
    // Liens displayName -> {displayName, sourceType}
    displayNameToSourceTypes.forEach((sourceTypes, displayName) => {
      sourceTypes.forEach(sourceType => {
        const link = {
          source: `name-${displayName}`,
          target: `pair-${displayName}|${sourceType}`,
          type: "character-source",
          value: 1
        };
        links.push(link);
        characterSourceLinksCreated++;
      });
    });
    
    console.log(`Liens niveau 1 (character-source) créés: ${characterSourceLinksCreated}`);

    // Liens {displayName, sourceType} -> posts
    posts.forEach(post => {
      const sourceNodeId = `pair-${post.displayName}|${post.sourceType}`;
      const targetNodeId = `post-${post.displayName}|${post.sourceType}|${post.creationDate}`;
      
      // Vérifier que les nœuds source et cible existent
      const sourceExists = pairNodes.some(node => node.id === sourceNodeId);
      const targetExists = postNodes.some(node => node.id === targetNodeId);
      
      if (sourceExists && targetExists) {
        const link = {
          source: sourceNodeId,
          target: targetNodeId,
          type: "source-post",
          value: 1
        };
        links.push(link);
        sourcePostLinksCreated++;
      } else {
        if (!sourceExists) missingSourceNodeCount++;
        if (!targetExists) missingTargetNodeCount++;
        
        console.warn("Nœuds manquants pour le lien niveau 2:", {
          sourceNodeId,
          targetNodeId,
          sourceExists,
          targetExists
        });
      }
    });

    console.log(`Liens niveau 2 (source-post) créés: ${sourcePostLinksCreated}`);
    console.log(`Liens niveau 2 non créés à cause de nœuds manquants: ${missingSourceNodeCount + missingTargetNodeCount}`);
    console.log(`- Nœuds source manquants: ${missingSourceNodeCount}`);
    console.log(`- Nœuds target manquants: ${missingTargetNodeCount}`);
    console.log(`Total des liens créés: ${centralLinksCreated + characterSourceLinksCreated + sourcePostLinksCreated}`);

    // Combiner tous les nœuds
    const nodes = [centralNode, ...displayNameNodes, ...pairNodes, ...postNodes];

    // Vérification finale de la cohérence
    const nodeIds = new Set(nodes.map(node => node.id));
    const linksWithMissingNodes = links.filter(
      link => !nodeIds.has(link.source as string) || !nodeIds.has(link.target as string)
    );
    
    console.log(`Vérification de cohérence: ${linksWithMissingNodes.length} liens référencent des nœuds inexistants`);
    if (linksWithMissingNodes.length > 0) {
      console.warn("Exemples de liens avec nœuds manquants:", linksWithMissingNodes.slice(0, 3));
    }

    // Log détaillé des nœuds et liens
    console.log("Détails de la génération:", {
      noeudsRouges: displayNameNodes.length,
      noeudsBleues: pairNodes.length,
      noeudsOrange: postNodes.length,
      totalNoeuds: nodes.length,
      liensNiveau1: links.filter(l => l.type === "character-source").length,
      liensNiveau2: links.filter(l => l.type === "source-post").length,
      totalLiens: links.length,
      exemplePairNode: pairNodes.length > 0 ? pairNodes[0] : null,
      exemplePostNode: postNodes.length > 0 ? postNodes[0] : null,
      exempleLien: links.length > 0 ? links[0] : null
    });

    // Log résumé pour "Données du graphe générées"
    const liensNiveau1Count = links.filter(l => l.type === "character-source").length;
    const liensNiveau2Count = links.filter(l => l.type === "source-post").length;
    console.log("Données du graphe générées:", {
      noeudsConnectés: nodeIds.size,
      noeudsTotal: nodes.length,
      liens: links.length,
      liensNiveau1: liensNiveau1Count,
      liensNiveau2: liensNiveau2Count,
      noeudsRouges: displayNameNodes.length,
      noeudsBleues: pairNodes.length,
      noeudsOrange: postNodes.length
    });

    return {
      nodes,
      links
    };
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    return {
      nodes: [],
      links: []
    };
  }
}
