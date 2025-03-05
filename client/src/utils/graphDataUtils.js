/**
 * Utility functions to transform raw data into a format compatible with r3f-forcegraph
 */

/**
 * Normalise le nom d'une source pour éviter les duplications
 * @param {string} source - Nom de la source à normaliser
 * @returns {string} Nom normalisé
 */
function normalizeSourceName(source) {
  if (!source) return "";

  // Convertir en minuscules et supprimer les espaces en début/fin
  let normalized = source.trim().toLowerCase();

  // Remplacer les variantes connues
  const replacements = {
    wikipedia: "wikipedia",
    wiki: "wikipedia",
    bluwiki: "bluwiki",
    mail: "email",
    email: "email",
    "e-mail": "email",
    "anime news network": "anime-news-network",
    animenewsnetwork: "anime-news-network",
    "anime-news-network": "anime-news-network",
  };

  // Vérifier si la source correspond à une des variantes connues
  for (const [variant, standardName] of Object.entries(replacements)) {
    if (normalized === variant || normalized.includes(variant)) {
      return standardName;
    }
  }

  // Si aucune correspondance n'est trouvée, retourner la chaîne normalisée
  return normalized;
}

/**
 * Generate graph data from raw data
 * @param {Array} rawData - Raw data from the JSON file
 * @param {Object} options - Options for data generation
 * @param {boolean} options.includePosts - Whether to include posts as nodes
 * @returns {Object} Graph data with nodes and links
 */
export function generateGraphData(rawData, options = {}) {
  // Default value for includePosts option
  const includePosts =
    options.includePosts !== undefined ? options.includePosts : false;

  // Check if we received an array
  if (!Array.isArray(rawData)) {
    console.error("The received data is not an array:", rawData);
    return { nodes: [], links: [] };
  }

  console.log("Raw data received:", rawData);
  console.log("Options:", { includePosts });

  const characters = rawData;
  const uniqueSources = new Set();
  // Utiliser une Map pour suivre les mappings de normalisation
  const sourceNormalizationMap = new Map();
  const characterSlugs = new Set(characters.map((c) => c.slug));

  // Collect all unique sources with normalization
  characters.forEach((character) => {
    if (Array.isArray(character.sources)) {
      character.sources.forEach((source) => {
        if (source) {
          const normalizedSource = normalizeSourceName(source);
          // Stocker la relation entre le nom original et le nom normalisé
          sourceNormalizationMap.set(source, normalizedSource);
          uniqueSources.add(normalizedSource);
        }
      });
    } else {
      console.warn(
        `Missing sources for ${character.displayName}:`,
        character.sources
      );
    }
  });

  console.log("Unique normalized sources found:", Array.from(uniqueSources));
  console.log("Unique characters found:", Array.from(characterSlugs));

  // Create nodes for characters
  const characterNodes = characters.map((character) => {
    if (!character.slug || !character.displayName) {
      console.warn("Invalid character:", character);
    }
    return {
      id: `node-${character.slug}`,
      slug: character.slug,
      name: character.displayName || character.slug,
      type: "character",
      val: 20,
      color: character.isJoshua ? "#FF5733" : "#333333", // Highlight Joshua characters
      isJoshua: character.isJoshua,
      _thematic: character.thematic,
      _career: character.career,
      _genre: character.genre,
      _polarisation: character.polarisation,
      _sources: Array.isArray(character.sources)
        ? character.sources.map((src) => sourceNormalizationMap.get(src) || src)
        : [],
    };
  });

  // Create nodes for sources (using normalized names)
  const sourceNodes = Array.from(uniqueSources).map((source) => ({
    id: `source-${source}`,
    name: source,
    slug: source,
    type: "source",
    val: 15,
    color: "#996633",
  }));

  // Create a central Joshua node
  const centralJoshuaNode = {
    id: "central-joshua",
    name: "Joshua Goldberg (Central)",
    slug: "real-joshua-goldberg",
    type: "central-joshua",
    val: 30, // Bigger than other nodes
    color: "#FF0000", // Red color for central node
    isJoshua: true,
  };

  // Add the central node
  characterNodes.push(centralJoshuaNode);

  // Create nodes for posts (decimated - 1 node for 10 posts)
  const postNodes = [];
  const postLinks = [];

  // Only process posts if the option is enabled
  if (includePosts) {
    characters.forEach((character) => {
      if (Array.isArray(character.posts) && character.posts.length > 0) {
        // Group posts by source
        const postsBySource = {};

        character.posts.forEach((post) => {
          if (post.source) {
            // Utiliser le nom normalisé de la source
            const normalizedSource =
              sourceNormalizationMap.get(post.source) ||
              normalizeSourceName(post.source);

            if (!postsBySource[normalizedSource]) {
              postsBySource[normalizedSource] = [];
            }
            postsBySource[normalizedSource].push(post);
          }
        });

        // For each source, decimate the posts (1 node for 30 posts)
        Object.entries(postsBySource).forEach(([source, posts]) => {
          // Check if the source exists in our set of unique sources
          if (!uniqueSources.has(source)) {
            return;
          }

          // Decimate posts - take 1 post out of 30
          for (let i = 0; i < posts.length; i += 30) {
            const post = posts[i];
            const postId = `post-${character.slug}-${source}-${i}`;

            // Create a node for this post
            postNodes.push({
              id: postId,
              name: "", // No text associated with posts
              slug: `post-${character.slug}-${source}-${i}`,
              type: "post",
              val: 5, // Smaller size than characters and sources
              color: "#6699CC", // Different color for posts
              date: post.date,
              platform: source, // Add the platform (source) to the node
            });

            // Create a link between this post and its character
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
  }

  // Combine all nodes
  const nodes = [...characterNodes, ...sourceNodes, ...postNodes];

  // Create links between characters
  const characterLinks = characters.flatMap((character) => {
    if (!Array.isArray(character.links)) {
      console.warn(
        `Missing links for ${character.displayName}:`,
        character.links
      );
      return [];
    }
    return character.links
      .filter((link) => {
        // Check that source and target exist
        const targetSlug = link.type === "outgoing" ? link.target : link.source;
        const isValid = targetSlug && characterSlugs.has(targetSlug);
        if (!isValid) {
          console.warn(
            `Ignored link for ${character.displayName} -> ${targetSlug} (target node not found)`
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
        // Additional properties that can be used in the application but are not part of the Link type
        _isDirect: link.isDirect,
        _relationType: link.relationType,
        _mediaImpact: link.mediaImpact,
        _virality: link.virality,
        _mediaCoverage: link.mediaCoverage,
        _linkType: link.linkType,
      }));
  });

  // Create links to sources
  const sourceLinks = characters.flatMap((character) => {
    if (!Array.isArray(character.sources)) {
      return [];
    }
    return character.sources
      .filter((source) => {
        // Utiliser le nom normalisé
        const normalizedSource =
          sourceNormalizationMap.get(source) || normalizeSourceName(source);
        return normalizedSource && uniqueSources.has(normalizedSource);
      })
      .map((source) => {
        // Utiliser le nom normalisé pour l'ID de la cible
        const normalizedSource =
          sourceNormalizationMap.get(source) || normalizeSourceName(source);
        return {
          source: `node-${character.slug}`,
          target: `source-${normalizedSource}`,
          type: "source",
          value: 1,
          // Additional properties
          _isDirect: "Direct",
          _relationType: "Source",
        };
      });
  });

  // Create special links to central Joshua node from all isJoshua characters and real-joshua-goldberg
  const joshuaLinks = characters
    .filter(
      (character) =>
        character.isJoshua || character.slug === "real-joshua-goldberg"
    )
    .map((character) => ({
      source: "central-joshua",
      target: `node-${character.slug}`,
      type: "joshua-connection",
      value: 2, // Stronger connection
      _relationType: "Joshua Identity",
    }));

  // Combine all links - only links between characters and sources, and between posts and characters if the option is enabled
  const links = [
    ...characterLinks,
    ...sourceLinks,
    ...joshuaLinks,
    ...(includePosts ? postLinks : []),
  ];

  console.log("Generation summary:", {
    characters: characterNodes.length,
    sources: sourceNodes.length,
    posts: includePosts ? postNodes.length : 0,
    characterLinks: characterLinks.length,
    sourceLinks: sourceLinks.length,
    joshuaLinks: joshuaLinks.length,
    postLinks: includePosts ? postLinks.length : 0,
  });

  return {
    nodes,
    links,
  };
}

/**
 * Load graph data from a JSON file
 * @param {string} url - URL of the JSON file
 * @param {Object} options - Options for data generation
 * @returns {Promise<Object>} Promise resolving to graph data
 */
export async function loadGraphData(url, options = {}) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return generateGraphData(data, options);
  } catch (error) {
    console.error("Error loading graph data:", error);
    return { nodes: [], links: [] };
  }
}
