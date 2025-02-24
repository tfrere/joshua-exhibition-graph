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
      thematic: character.thematic,
      career: character.career,
      genre: character.genre,
      polarisation: character.polarisation,
      sources: Array.isArray(character.sources) ? character.sources : [],
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

  // Combiner tous les nœuds
  const nodes = [...characterNodes, ...sourceNodes];

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
        isDirect: link.isDirect,
        relationType: link.relationType,
        mediaImpact: link.mediaImpact,
        virality: link.virality,
        mediaCoverage: link.mediaCoverage,
        linkType: link.linkType,
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
        isDirect: "Direct",
        relationType: "Source",
        mediaImpact: "",
        virality: "",
        mediaCoverage: "",
        linkType: "source",
      }));
  });

  // Combiner tous les liens
  const links = [...characterLinks, ...sourceLinks];

  console.log("Résumé de la génération:", {
    personnages: characterNodes.length,
    sources: sourceNodes.length,
    liensPersonnages: characterLinks.length,
    liensSources: sourceLinks.length,
  });

  return {
    nodes,
    links,
  };
}
