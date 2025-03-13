import React from "react";
import TextScramble from "../../components/TextScramble";
import "../../components/TextScramble.css";

function ProfileDisplay({
  activeCharacterData,
  activePost,
  characterImageExists,
  visitedPosts,
  totalPosts,
  navigationMode,
  isCountingEnabled,
  activeNode,
  databaseData,
  mostImpactfulPost,
}) {
  // Vérifier que activeNode a des propriétés valides
  console.log("[ProfileDisplay] Received activeNode:", activeNode);

  // Fonction pour vérifier si un nœud est valide (reproduire la même logique que dans PostPage)
  const isValidNode = (node) => {
    return node && (node.name || node.label || node.id || node.type);
  };

  const isValidActiveNode = isValidNode(activeNode);
  console.log("[ProfileDisplay] isValidActiveNode:", isValidActiveNode);

  if (isValidActiveNode) {
    console.log("[ProfileDisplay] Node properties:", {
      name: activeNode.name,
      label: activeNode.label,
      id: activeNode.id,
      type: activeNode.type,
      isJoshua: activeNode.isJoshua,
    });
  }

  // Calculate visited percentage
  const visitedPercentage =
    totalPosts > 0 ? ((visitedPosts.length / totalPosts) * 100).toFixed(2) : 0;

  // Déterminer s'il faut afficher les informations du nœud au lieu du personnage
  const showNodeInfo = isValidActiveNode;

  // Déterminer si le nœud actif est un personnage
  const isNodeCharacter = activeNode && activeNode.type === "character";

  console.log("[ProfileDisplay] showNodeInfo:", showNodeInfo);
  console.log("[ProfileDisplay] isNodeCharacter:", isNodeCharacter);
  console.log("[ProfileDisplay] mostImpactfulPost:", mostImpactfulPost);

  // Pour les nœuds de type "character", chercher les infos dans databaseData
  let characterBiography = null;
  if (isNodeCharacter && databaseData && activeNode.id) {
    // Chercher la correspondance par slug (id du nœud)
    const matchedCharacter = databaseData.find(
      (char) => char.slug === activeNode.id
    );
    if (matchedCharacter) {
      console.log(
        "[ProfileDisplay] Found matching character in database:",
        matchedCharacter.slug
      );
      characterBiography = matchedCharacter.biography;
    }
  }

  // Déterminer si le nœud actif est un journaliste ou du FBI
  const isJournalistOrFBI =
    activeNode &&
    (activeNode.isJoshua === false || // Un nœud est journaliste si isJoshua est false
      (activeNode.name && activeNode.name.toLowerCase().includes("fbi")) ||
      (activeNode.label && activeNode.label.toLowerCase().includes("fbi")));

  console.log("[ProfileDisplay] isJournalistOrFBI:", isJournalistOrFBI);
  console.log(
    "[ProfileDisplay] Nouvelle détection de journaliste basée sur isJoshua:",
    activeNode && activeNode.isJoshua === false
  );
  // Log détaillé pour comprendre pourquoi les journalistes ne sont pas détectés
  if (activeNode) {
    console.log("[ProfileDisplay] Détails du nœud pour détection journalist:", {
      isJoshua: activeNode.isJoshua,
      isJournalist: activeNode.isJoshua === false,
      name: activeNode.name,
      label: activeNode.label,
      hasFbiInName:
        activeNode.name && activeNode.name.toLowerCase().includes("fbi"),
      hasFbiInLabel:
        activeNode.label && activeNode.label.toLowerCase().includes("fbi"),
    });
    console.log("[ProfileDisplay] Type de nœud actif:", activeNode.type);
  }

  // Utiliser les données du nœud actif ou du personnage en fonction de la condition
  const displayName = showNodeInfo
    ? activeNode.name || activeNode.label || activeNode.id
    : activeCharacterData?.displayName || activeCharacterData?.slug;

  // Obtenir la biographie - pour un nœud de type character, utiliser celle de la base de données
  const biography = showNodeInfo
    ? isNodeCharacter
      ? characterBiography || "Personnage" // Utiliser la biographie trouvée dans la base de données
      : activeNode.description || `Type: ${activeNode.type || "Nœud"}` // Pour les autres types de nœuds
    : activeCharacterData?.biography || "Aucune biographie disponible";

  // Déterminer l'initiale pour l'affichage si pas d'image
  const initial = (displayName || "?").charAt(0).toUpperCase();

  // Déterminer si c'est un nœud Joshua (pour la couleur)
  const isJoshua = showNodeInfo
    ? activeNode.isJoshua || activeNode.type === "character"
    : activeCharacterData?.isJoshua;

  // Déterminer l'image SVG à utiliser en fonction du type de nœud
  const getNodeSvgImage = (node) => {
    if (!node) return null;

    console.log("[ProfileDisplay] Sélection d'image pour le nœud:", {
      type: node.type,
      name: node.name || node.label,
      isJoshua: node.isJoshua,
    });

    let svgFileName;
    if (node.type === "central") {
      svgFileName = "joshua-goldberg";
    } else if (node.name && node.name.toLowerCase().includes("fbi")) {
      svgFileName = "fbi";
    } else if (node.type === "character" && node.isJoshua === false) {
      svgFileName = "journalist";
    } else if (node.type === "character" && node.isJoshua === true) {
      svgFileName = "character";
    } else {
      // Par défaut, utiliser un nœud générique
      svgFileName = "journalist";
    }

    console.log("[ProfileDisplay] Selected SVG for node:", svgFileName);
    return `/public/img/${svgFileName}.png`;
  };

  // Déterminer l'image à utiliser pour le nœud actif
  const nodeSvgImage = showNodeInfo ? getNodeSvgImage(activeNode) : null;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Fond flouté en arrière-plan */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          opacity: 0.15,
          filter: "blur(15px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {characterImageExists && !showNodeInfo ? (
          <img
            src={`/public/img/characters/${activeCharacterData.slug}.png`}
            alt=""
            style={{
              width: "150%",
              height: "150%",
              objectFit: "cover",
            }}
          />
        ) : showNodeInfo && nodeSvgImage ? (
          <img
            src={nodeSvgImage}
            alt=""
            style={{
              width: "150%",
              height: "150%",
              objectFit: "cover",
              opacity: 0.5,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: "80vh",
              fontWeight: "bold",
              color: "#111111",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: "100%",
            }}
          >
            {initial}
          </div>
        )}
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          background: "transparent",
          borderRadius: "8px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2rem 1.5rem",
          position: "relative",
          zIndex: 1,
          height: "100vh", // Hauteur fixe de la fenêtre
          maxHeight: "900px", // Hauteur maximale pour les grands écrans
          justifyContent: "center", // Centre le contenu verticalement
        }}
      >
        {/* Photo de profil ou représentation du nœud */}
        {characterImageExists && !showNodeInfo ? (
          // Image du personnage pour activeCharacterData
          <div
            style={{
              width: "320px",
              height: "320px",
              borderRadius: "0px",
              marginBottom: "1.25rem",
              border: "4px solid #222",
              overflow: "hidden",
              position: "relative",
              boxSizing: "border-box",
            }}
          >
            <img
              src={`/public/img/characters/${activeCharacterData.slug}.png`}
              alt={displayName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                padding: "0",
                background: "#ffffff",
              }}
            />
          </div>
        ) : showNodeInfo && nodeSvgImage ? (
          // Image SVG spécifique pour le nœud actif
          <div
            style={{
              width: "320px",
              height: "320px",
              borderRadius: isNodeCharacter ? "0px" : "0px",
              background: showNodeInfo ? "#222222" : "#000000",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "1.25rem",
              border: `4px solid #444`,
              boxSizing: "border-box",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={nodeSvgImage}
              alt={displayName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                padding: "0",
              }}
            />
          </div>
        ) : (
          // Fallback avec l'initiale si pas d'image spécifique
          <div
            style={{
              width: "320px",
              height: "320px",
              borderRadius: "0px",
              marginBottom: "1.25rem",
              border: "4px solid #222",
              background: "#000000",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
              position: "relative",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#000",
                color: "#ffffff",
                fontSize: "8rem",
                fontWeight: 100,
              }}
            >
              {initial}
            </div>
          </div>
        )}

        {/* Nom du personnage/nœud et badge Joshua */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem 0",
              color: isJoshua ? "#ffffff" : "#cccccc",
              fontSize: "1.75rem",
            }}
          >
            <TextScramble text={displayName} />
          </h2>
          {/* Badge pour indiquer si c'est un nœud - uniquement pour les nœuds non-character */}
          {showNodeInfo && !isNodeCharacter && (
            <div
              style={{
                background: "#444",
                padding: "0.25rem 0.75rem",
                borderRadius: "0.25rem",
                fontSize: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              {activeNode.type || "Nœud"}
            </div>
          )}
        </div>

        {/* Biographie/Description */}
        <div
          style={{
            width: "100%",
            textAlign: "center",
            marginBottom: "1.5rem",
            height: "120px", // Hauteur fixe pour la section de biographie
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              color: "#999",
              margin: "0 0 0.75rem 0",
              fontWeight: "normal",
              flexShrink: 0, // Empêche le titre de rétrécir
            }}
          >
            {showNodeInfo && !isNodeCharacter ? "Description" : "Biographie"}
          </h3>
          <div
            style={{
              flex: 1, // Prend tout l'espace restant
              display: "flex",
              flexDirection: "column",
              justifyContent: "center", // Centrer verticalement le contenu
              overflow: "hidden", // Cacher le contenu qui dépasse
            }}
          >
            <p
              style={{
                margin: 0,
                lineHeight: "1.5",
                fontSize: "0.95rem",
                color: "#eee",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                textShadow: "0 0 10px rgba(0, 0, 0, 0.7)",
              }}
            >
              <TextScramble text={biography} />
            </p>
          </div>
        </div>

        {/* Post avec le plus d'impact - avec opacité réduite lorsqu'un nœud est actif (sauf si c'est un character) */}
        <div
          style={{
            width: "100%",
            marginBottom: "1rem",
            opacity:
              // Opacité très réduite (0.1) pour les journalistes et FBI sans post
              isJournalistOrFBI && !mostImpactfulPost && !activePost
                ? 0.4
                : // Opacité réduite (0.2) pour les autres nœuds sans post d'impact
                showNodeInfo && !isNodeCharacter && !mostImpactfulPost
                ? 0.2
                : 1,
            filter:
              showNodeInfo && !isNodeCharacter && !mostImpactfulPost
                ? "grayscale(100%)"
                : "none", // Filtre gris uniquement si pas de post d'impact
            transition: "opacity 0.3s ease, filter 0.3s ease", // Animation fluide
            height: "340px", // Hauteur fixe pour la section de post
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              color: "#999",
              margin: "0 0 0.75rem 0",
              textAlign: "center",
              fontWeight: "normal",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              flexShrink: 0, // Empêche le titre de rétrécir
            }}
          >
            {mostImpactfulPost && showNodeInfo
              ? "Post avec le plus d'impact"
              : "Post sélectionné"}
            {isJournalistOrFBI && !mostImpactfulPost && !activePost ? (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#777",
                  fontStyle: "italic",
                }}
              >
                (aucun post disponible)
              </span>
            ) : (
              showNodeInfo &&
              !isNodeCharacter &&
              !mostImpactfulPost && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#777",
                    fontStyle: "italic",
                  }}
                >
                  (désactivé pour les nœuds)
                </span>
              )
            )}
          </h3>

          <div
            style={{
              background: "transparent",
              padding: "1rem",
              borderRadius: "0.5rem",
              border:
                isJournalistOrFBI && !mostImpactfulPost && !activePost
                  ? "none" // Pas de bordure pour les journalistes/FBI sans post
                  : "1px solid rgba(255, 255, 255, 0.2)",
              flex: 1, // Prend tout l'espace restant
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backdropFilter: "blur(2.5px)",
              WebkitBackdropFilter: "blur(2.5px)",
              // Ajouter un effet visuel de désactivation pour les nœuds
              pointerEvents:
                (isJournalistOrFBI && !mostImpactfulPost && !activePost) ||
                (showNodeInfo && !isNodeCharacter && !mostImpactfulPost)
                  ? "none"
                  : "auto", // Désactiver les interactions
              position: "relative", // Pour positionner le pseudo-élément
            }}
          >
            {/* Overlay semi-transparent pour les nœuds sans post d'impact */}
            {((isJournalistOrFBI && !mostImpactfulPost && !activePost) ||
              (showNodeInfo && !isNodeCharacter && !mostImpactfulPost)) && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background:
                    isJournalistOrFBI && !mostImpactfulPost && !activePost
                      ? "rgba(50, 50, 50, 0.3)" // Un peu plus foncé pour les journalistes/FBI
                      : "rgba(50, 50, 50, 0.2)",
                  borderRadius: "0.5rem",
                  zIndex: 10,
                }}
              />
            )}
            <div
              style={{
                overflow: "hidden",
                flex: "1 1 auto",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center", // Centrer verticalement le contenu
                height: "180px", // Hauteur fixe pour le contenu du post
              }}
            >
              {/* Log supplémentaire juste avant l'affichage du texte */}
              {console.log("[ProfileDisplay] Valeurs pour le texte du post:", {
                isJournalistOrFBI,
                haveNoPost: !mostImpactfulPost && !activePost,
                shouldBeEmpty:
                  isJournalistOrFBI && !mostImpactfulPost && !activePost,
                contentToShow:
                  isJournalistOrFBI && !mostImpactfulPost && !activePost
                    ? "VIDE"
                    : "TEXTE_NORMAL",
              })}

              {/* Log de debug pour comprendre le contenu affiché pour le post */}
              <p
                style={{
                  margin: 0,
                  lineHeight: "1.5",
                  fontSize: "0.95rem",
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textAlign: "center",
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  textShadow: "0 0 5px rgba(0, 0, 0, 0.5)",
                }}
              >
                <TextScramble
                  text={
                    // Pour les journalistes et FBI sans post, n'afficher aucun texte
                    isJournalistOrFBI && !mostImpactfulPost && !activePost
                      ? ""
                      : mostImpactfulPost && showNodeInfo
                      ? mostImpactfulPost.content ||
                        mostImpactfulPost.title ||
                        "Post avec le plus d'impact"
                      : activePost && (activePost.content || activePost.title)
                      ? activePost.content || activePost.title
                      : isJournalistOrFBI
                      ? ""
                      : "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
                  }
                />
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                justifyItems: "center",
                fontSize: "0.8rem",
                color: "#fff",
                marginTop: "1rem",
                borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                paddingTop: "0.75rem",
                height: "30px",
                flexShrink: 0, // Empêche cette section de rétrécir
              }}
            >
              <div style={{ display: "flex", gap: ".3rem" }}>
                {!isJournalistOrFBI || mostImpactfulPost || activePost ? (
                  <>
                    <span style={{ opacity: 0.5 }}> Posté le</span>
                    {mostImpactfulPost && showNodeInfo ? (
                      <span>
                        {new Date(
                          mostImpactfulPost.creationDate * 1000
                        ).toLocaleDateString()}
                      </span>
                    ) : activePost && activePost.creationDate ? (
                      <span>
                        {new Date(
                          activePost.creationDate * 1000
                        ).toLocaleDateString()}
                      </span>
                    ) : (
                      <span>01/01/2023</span>
                    )}
                  </>
                ) : null}
              </div>

              {/* Plateforme alignée à droite */}
              <div>
                {isJournalistOrFBI &&
                !mostImpactfulPost &&
                !activePost ? null : mostImpactfulPost && showNodeInfo ? (
                  <span
                    style={{
                      padding: "0.15rem 0.5rem",
                      borderRadius: "0.25rem",
                      background: "rgba(255, 255, 255, 0.15)",
                      color: "#ffffff",
                      textTransform: "uppercase",
                      letterSpacing: "0.05rem",
                      fontSize: "0.65rem",
                    }}
                  >
                    {mostImpactfulPost.source || "Source inconnue"}
                  </span>
                ) : activePost && activePost.source ? (
                  <span
                    style={{
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    {activePost.source}
                  </span>
                ) : (
                  <span>Source inconnue</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Indicateur de progression en bas de page - visible uniquement si au moins 2 posts visités et comptage activé */}
      {navigationMode === "normal" &&
        isCountingEnabled &&
        visitedPosts.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "0",
              right: "0",
              textAlign: "center",
              fontSize: "0.8rem",
              color: "rgba(255, 255, 255, 0.5)",
              zIndex: "2",
            }}
          >
            Vous avez visité {visitedPercentage}% du total (
            {visitedPosts.length} sur {totalPosts} posts)
          </div>
        )}
    </div>
  );
}

export default ProfileDisplay;
