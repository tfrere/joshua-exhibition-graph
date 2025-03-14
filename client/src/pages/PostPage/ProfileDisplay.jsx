import React from "react";
import TextScramble from "../../components/TextScramble";
import "../../components/TextScramble.css";

// Styles constants
const styles = {
  container: {
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
  },
  blurBackground: {
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
  },
  backgroundImage: {
    width: "150%",
    height: "150%",
    objectFit: "cover",
  },
  initial: {
    fontSize: "80vh",
    fontWeight: "bold",
    color: "#111111",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    width: "100%",
    maxWidth: "600px",
    background: "transparent",
    position: "relative",
    borderRadius: "8px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2rem 1.5rem",
    zIndex: 1,
    height: "100vh",
    maxHeight: "900px",
    justifyContent: "center",
  },
  imageContainer: {
    width: "320px",
    height: "320px",
    borderRadius: "8px",
    marginBottom: "1.25rem",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
  },
  nodeImageContainer: {
    width: "320px",
    height: "320px",
    borderRadius: "100%",
    background: "#222222",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "1.25rem",
    border: "1px solid #444",
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
  },
  fallbackContainer: {
    width: "320px",
    height: "320px",
    borderRadius: "5px",
    marginBottom: "1.25rem",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "#000000",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    padding: "0",
  },
  initialDisplay: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#000",
    color: "#ffffff",
    fontSize: "8rem",
    fontWeight: 100,
  },
  nameContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "1rem",
    textAlign: "center",
  },
  nameText: (isJoshua) => ({
    margin: "0 0 0.5rem 0",
    color: isJoshua ? "#ffffff" : "#cccccc",
    fontSize: "1.75rem",
  }),
  badge: {
    background: "#444",
    padding: "0.25rem 0.75rem",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
    marginTop: "0.5rem",
  },
  bioContainer: {
    width: "100%",
    textAlign: "center",
    marginBottom: "1.5rem",
    height: "120px",
    display: "flex",
    flexDirection: "column",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    color: "#999",
    margin: "0 0 0.75rem 0",
    fontWeight: "normal",
    flexShrink: 0,
  },
  bioContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    overflow: "hidden",
  },
  bioText: {
    margin: 0,
    lineHeight: "1.4",
    fontSize: "0.95rem",
    color: "#eee",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 5,
    height: "120px",
    WebkitBoxOrient: "vertical",
    textShadow: "0 0 10px rgba(0, 0, 0, 0.7)",
  },
  postContainer: (opacity, useGrayscale) => ({
    width: "100%",
    marginBottom: "1rem",
    opacity: opacity,
    filter: useGrayscale ? "grayscale(100%)" : "none",
    transition: "opacity 0.3s ease, filter 0.3s ease",
    height: "340px",
    display: "flex",
    flexDirection: "column",
  }),
  postTitleContainer: {
    fontSize: "1.1rem",
    color: "#999",
    margin: "0 0 0.75rem 0",
    textAlign: "center",
    fontWeight: "normal",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    flexShrink: 0,
  },
  postNote: {
    fontSize: "0.75rem",
    color: "#777",
    fontStyle: "italic",
  },
  postContent: (showBorder) => ({
    background: "transparent",
    padding: "1rem",
    borderRadius: "0.5rem",
    border: showBorder ? "1px solid rgba(255, 255, 255, 0.2)" : "none",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    backdropFilter: "blur(2.5px)",
    WebkitBackdropFilter: "blur(2.5px)",
    pointerEvents: "auto",
    position: "relative",
  }),
  postOverlay: (isDarker) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: isDarker ? "rgba(50, 50, 50, 0.3)" : "rgba(50, 50, 50, 0.2)",
    borderRadius: "0.5rem",
    zIndex: 10,
  }),
  postTextContainer: {
    overflow: "hidden",
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    height: "180px",
  },
  postText: {
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
  },
  postFooter: {
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
    flexShrink: 0,
  },
  postDate: {
    display: "flex",
    gap: ".3rem",
  },
  postSource: {
    padding: "0.15rem 0.5rem",
    borderRadius: "0.25rem",
    background: "rgba(255, 255, 255, 0.15)",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: "0.05rem",
    fontSize: "0.65rem",
  },
  progressIndicator: {
    textAlign: "center",
    position: "absolute",
    left: "0",
    right: "0",
    bottom: "10px",
    fontSize: "0.85rem",
    color: "rgba(255, 255, 255, 0.7)",
    zIndex: "5",
    padding: "8px",
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(2px)",
    borderRadius: "4px",
    marginLeft: "auto",
    marginRight: "auto",
    width: "fit-content",
    fontWeight: "500",
  },
};

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
  // Helper functions
  const isValidNode = (node) => {
    return node && (node.name || node.label || node.id || node.type);
  };

  // Calculated values
  const isValidActiveNode = isValidNode(activeNode);
  const showNodeInfo = isValidActiveNode;
  const isNodeCharacter = activeNode && activeNode.type === "character";
  const visitedPercentage =
    totalPosts > 0 ? ((visitedPosts.length / totalPosts) * 100).toFixed(2) : 0;

  // Get character biography if available
  const characterBiography =
    isNodeCharacter && databaseData && activeNode.id
      ? databaseData.find((char) => char.slug === activeNode.id)?.biography ||
        null
      : null;

  // Check if node is journalist or FBI
  const isJournalistOrFBI =
    activeNode &&
    (activeNode.isJoshua === false ||
      (activeNode.name && activeNode.name.toLowerCase().includes("fbi")) ||
      (activeNode.label && activeNode.label.toLowerCase().includes("fbi")));

  // Derived data
  const displayName = showNodeInfo
    ? activeNode.name || activeNode.label || activeNode.id
    : activeCharacterData?.displayName || activeCharacterData?.slug;

  const biography = showNodeInfo
    ? isNodeCharacter
      ? characterBiography || "Personnage"
      : activeNode.description || `Type: ${activeNode.type || "Nœud"}`
    : activeCharacterData?.biography || "Aucune biographie disponible";

  const initial = (displayName || "?").charAt(0).toUpperCase();

  const isJoshua = showNodeInfo
    ? activeNode.isJoshua || activeNode.type === "character"
    : activeCharacterData?.isJoshua;

  // Get appropriate image for node
  const getNodeSvgImage = (node) => {
    if (!node) return null;

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
      svgFileName = "journalist";
    }

    return `/img/${svgFileName}.png`;
  };

  const nodeSvgImage = showNodeInfo ? getNodeSvgImage(activeNode) : null;

  // Calculate post section properties
  const showPostContent = !(
    isJournalistOrFBI &&
    !mostImpactfulPost &&
    !activePost
  );
  const useGrayscale = showNodeInfo && !isNodeCharacter && !mostImpactfulPost;
  const postOpacity =
    isJournalistOrFBI && !mostImpactfulPost && !activePost
      ? 0.4
      : showNodeInfo && !isNodeCharacter && !mostImpactfulPost
      ? 0.2
      : 1;

  // Determine post content
  const postContent =
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
      : "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

  // Determine post date
  const getPostDate = () => {
    if (mostImpactfulPost && showNodeInfo) {
      return new Date(
        mostImpactfulPost.creationDate * 1000
      ).toLocaleDateString();
    } else if (activePost && activePost.creationDate) {
      return new Date(activePost.creationDate * 1000).toLocaleDateString();
    }
    return "01/01/2023";
  };

  // Determine post source
  const getPostSource = () => {
    if (mostImpactfulPost && showNodeInfo) {
      return mostImpactfulPost.source || "Source inconnue";
    } else if (activePost && activePost.source) {
      return activePost.source;
    }
    return "Source inconnue";
  };

  return (
    <div style={styles.container}>
      {/* Background blur */}
      <div style={styles.blurBackground}>
        {characterImageExists && !showNodeInfo ? (
          <img
            src={`/img/characters/${activeCharacterData.slug}.png`}
            alt=""
            style={styles.backgroundImage}
          />
        ) : showNodeInfo && nodeSvgImage ? (
          <img
            src={nodeSvgImage}
            alt=""
            style={{ ...styles.backgroundImage, opacity: 0.5 }}
          />
        ) : (
          <div style={styles.initial}>{initial}</div>
        )}
      </div>

      <div style={styles.contentContainer}>
        {/* Profile Image */}
        {characterImageExists && !showNodeInfo ? (
          <div style={styles.imageContainer}>
            <img
              src={`/img/characters/${activeCharacterData.slug}.png`}
              alt={displayName}
              style={{ ...styles.image, background: "#ffffff" }}
            />
          </div>
        ) : showNodeInfo && nodeSvgImage ? (
          <div style={styles.nodeImageContainer}>
            <img src={nodeSvgImage} alt={displayName} style={styles.image} />
          </div>
        ) : (
          <div style={styles.fallbackContainer}>
            <div style={styles.initialDisplay}>{initial}</div>
          </div>
        )}

        {/* Name */}
        <div style={styles.nameContainer}>
          <h2 style={styles.nameText(isJoshua)}>
            <TextScramble text={displayName} />
          </h2>
          {showNodeInfo && !isNodeCharacter && (
            <div style={styles.badge}>{activeNode.type || "Nœud"}</div>
          )}
        </div>

        {/* Biography */}
        <div style={styles.bioContainer}>
          <h3 style={styles.sectionTitle}>
            {showNodeInfo && !isNodeCharacter ? "Description" : "Biographie"}
          </h3>
          <div style={styles.bioContent}>
            <p style={styles.bioText}>
              <TextScramble text={biography} />
            </p>
          </div>
        </div>

        {/* Post */}
        <div style={styles.postContainer(postOpacity, useGrayscale)}>
          <h3 style={styles.postTitleContainer}>
            {mostImpactfulPost && showNodeInfo
              ? "Post avec le plus d'impact"
              : "Post sélectionné"}

            {isJournalistOrFBI && !mostImpactfulPost && !activePost ? (
              <span style={styles.postNote}>(aucun post disponible)</span>
            ) : (
              showNodeInfo &&
              !isNodeCharacter &&
              !mostImpactfulPost && (
                <span style={styles.postNote}>(désactivé pour les nœuds)</span>
              )
            )}
          </h3>

          <div style={styles.postContent(showPostContent)}>
            {/* Overlay for nodes without impact post */}
            {((isJournalistOrFBI && !mostImpactfulPost && !activePost) ||
              (showNodeInfo && !isNodeCharacter && !mostImpactfulPost)) && (
              <div
                style={styles.postOverlay(
                  isJournalistOrFBI && !mostImpactfulPost && !activePost
                )}
              />
            )}

            <div style={styles.postTextContainer}>
              <p style={styles.postText}>
                <TextScramble text={postContent} />
              </p>
            </div>

            <div style={styles.postFooter}>
              <div style={styles.postDate}>
                {!isJournalistOrFBI || mostImpactfulPost || activePost ? (
                  <>
                    <span style={{ opacity: 0.5 }}> Posté le</span>
                    <span>{getPostDate()}</span>
                  </>
                ) : null}
              </div>

              <div>
                {isJournalistOrFBI &&
                !mostImpactfulPost &&
                !activePost ? null : (
                  <span style={styles.postSource}>{getPostSource()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Progress indicator - maintenant visible même avec 1 seul post visité */}
          {navigationMode === "normal" && isCountingEnabled && (
            <div style={styles.progressIndicator}>
              Vous avez visité {visitedPercentage}% du total (
              {visitedPosts.length} sur {totalPosts} posts)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileDisplay;
