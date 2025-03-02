import { Node, Link } from "../types/graph";

interface Character {
  slug: string;
  displayName: string;
  aliases: string[];
  isJoshua: boolean;
  "fiction / impersonation": string;
  thematic: string;
  career: string;
  genre: string;
  polarisation: string;
  cercle: string;
  politicalSphere: string;
  links: CharacterLink[];
  biography: string;
  posts: any[];
  sources: string[];
  totalPosts: number;
  hasEnoughPostsToUseInFrequencyPosts: boolean;
  hasEnoughTextToMakeWordcloud: boolean;
}

interface CharacterLink {
  type: "incoming" | "outgoing";
  target?: string;
  source?: string;
  isDirect: string;
  relationType: string;
  mediaImpact: string;
  virality: string;
  mediaCoverage: string;
  linkType: string;
}

interface Post {
  id: string;
  content: string;
  source: string;
  date?: string;
  // Add any other relevant post properties
}

export function generateGraphData(rawData: any) {
  // Vérifier que nous avons bien reçu un tableau
  if (!Array.isArray(rawData)) {
    console.error("Les données reçues ne sont pas un tableau:", rawData);
    return { nodes: [], links: [] };
  }

  console.log("Données brutes reçues:", rawData);

  const characters = rawData as Character[];
  const uniqueSources = new Set<string>();
  const characterSlugs = new Set(characters.map((c) => c.slug));

  // Collecter toutes les sources uniques
  characters.forEach((character) => {
    if (Array.isArray(character.sources)) {
      character.sources.forEach((source) => {
        if (source) uniqueSources.add(source);
      });
    } else {
      console.warn(
        `Sources manquantes pour ${character.displayName}:`,
        character.sources
      );
    }
  });

  console.log("Sources uniques trouvées:", Array.from(uniqueSources));
  console.log("Personnages uniques trouvés:", Array.from(characterSlugs));

  // Créer les nœuds pour les personnages
  const characterNodes: Node[] = characters.map((character) => {
    if (!character.slug || !character.displayName) {
      console.warn("Character invalide:", character);
    }
    return {
      id: `node-${character.slug}`,
      name: character.displayName || character.slug,
      type: "character",
      val: 20,
      color: "#333333",
      isJoshua: character.isJoshua,
      _thematic: character.thematic,
      _career: character.career,
      _genre: character.genre,
      _polarisation: character.polarisation,
      _sources: Array.isArray(character.sources) ? character.sources : [],
    };
  });

  // Créer les nœuds pour les sources
  const sourceNodes: Node[] = Array.from(uniqueSources).map((source) => ({
    id: `source-${source}`,
    name: source,
    type: "source",
    val: 15,
    color: "#996633",
  }));

  // Créer les nœuds pour les posts (décimés - 1 nœud pour 10 posts)
  const postNodes: Node[] = [];
  const postLinks: Link[] = [];

  characters.forEach((character) => {
    if (Array.isArray(character.posts) && character.posts.length > 0) {
      // Regrouper les posts par source
      const postsBySource: Record<string, Post[]> = {};

      character.posts.forEach((post) => {
        if (post.source) {
          if (!postsBySource[post.source]) {
            postsBySource[post.source] = [];
          }
          postsBySource[post.source].push(post);
        }
      });

      // Pour chaque source, décimer les posts (1 nœud pour 10 posts)
      Object.entries(postsBySource).forEach(([source, posts]) => {
        // Vérifier que la source existe dans notre ensemble de sources uniques
        if (!uniqueSources.has(source)) {
          return;
        }

        // Décimer les posts - prendre 1 post sur 30
        for (let i = 0; i < posts.length; i += 30) {
          const post = posts[i];
          const postId = `post-${character.slug}-${source}-${i}`;

          // Créer un nœud pour ce post
          postNodes.push({
            id: postId,
            name: "", // Pas de texte associé aux posts
            type: "post",
            val: 5, // Taille plus petite que les personnages et les sources
            color: "#6699CC", // Couleur différente pour les posts
            date: post.date,
            platform: source, // Ajouter la plateforme (source) au nœud
          });

          // Créer un lien entre ce post et son personnage (au lieu de sa source)
          postLinks.push({
            source: postId,
            target: `node-${character.slug}`,
            type: "post",
            value: 1,
          });
        }
      });
    }
  });

  // Combiner tous les nœuds
  const nodes = [...characterNodes, ...sourceNodes, ...postNodes];

  // Créer les liens entre les personnages
  const characterLinks: Link[] = characters.flatMap((character) => {
    if (!Array.isArray(character.links)) {
      console.warn(
        `Liens manquants pour ${character.displayName}:`,
        character.links
      );
      return [];
    }
    return character.links
      .filter((link) => {
        // Vérifier que la source et la cible existent
        const targetSlug = link.type === "outgoing" ? link.target : link.source;
        const isValid = targetSlug && characterSlugs.has(targetSlug);
        if (!isValid) {
          console.warn(
            `Lien ignoré pour ${character.displayName} -> ${targetSlug} (nœud cible non trouvé)`
          );
        }
        return isValid;
      })
      .map((link) => ({
        source: `node-${character.slug}`,
        target:
          link.type === "outgoing"
            ? `node-${link.target}`
            : `node-${link.source}`,
        type: link.relationType || "character",
        value: 1,
        // Propriétés supplémentaires qui peuvent être utilisées dans l'application mais ne font pas partie du type Link
        _isDirect: link.isDirect,
        _relationType: link.relationType,
        _mediaImpact: link.mediaImpact,
        _virality: link.virality,
        _mediaCoverage: link.mediaCoverage,
        _linkType: link.linkType,
      }));
  });

  // Créer les liens vers les sources
  const sourceLinks: Link[] = characters.flatMap((character) => {
    if (!Array.isArray(character.sources)) {
      return [];
    }
    return character.sources
      .filter((source) => source && uniqueSources.has(source))
      .map((source) => ({
        source: `node-${character.slug}`,
        target: `source-${source}`,
        type: "source",
        value: 1,
        // Propriétés supplémentaires
        _isDirect: "Direct",
        _relationType: "Source",
      }));
  });

  // Combiner tous les liens - uniquement les liens entre personnages et sources, et entre posts et sources
  // Les posts ne sont liés qu'à leur plateforme (source)
  const links = [...characterLinks, ...sourceLinks, ...postLinks];

  console.log("Résumé de la génération:", {
    personnages: characterNodes.length,
    sources: sourceNodes.length,
    posts: postNodes.length,
    liensPersonnages: characterLinks.length,
    liensSources: sourceLinks.length,
    liensPosts: postLinks.length,
  });

  return {
    nodes,
    links,
  };
}
