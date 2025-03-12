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
}) {
  // Calculate visited percentage
  const visitedPercentage =
    totalPosts > 0 ? ((visitedPosts.length / totalPosts) * 100).toFixed(2) : 0;

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
          opacity: 0.25,
          filter: "blur(15px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {characterImageExists ? (
          <img
            src={`/public/img/characters/${activeCharacterData.slug}.png`}
            alt=""
            style={{
              width: "250%",
              height: "250%",
              objectFit: "cover",
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
            {(
              activeCharacterData.displayName ||
              activeCharacterData.slug ||
              "?"
            )
              .charAt(0)
              .toUpperCase()}
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
        }}
      >
        {/* Photo de profil */}
        {characterImageExists ? (
          <img
            src={`/public/img/characters/${activeCharacterData.slug}.png`}
            alt={activeCharacterData.displayName || activeCharacterData.slug}
            style={{
              width: "320px",
              height: "320px",
              borderRadius: "0px",
              marginBottom: "1.25rem",
              border: "4px solid #222",
              objectFit: "cover",
              background: "#ffffff",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div
            style={{
              width: "320px",
              height: "320px",
              borderRadius: "0px",
              background: "#000000",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "1.25rem",
              color: "#ffffff",
              fontSize: "6rem",
              fontWeight: "bold",
              border: "4px solid #222",
              boxSizing: "border-box",
            }}
          >
            {(
              activeCharacterData.displayName ||
              activeCharacterData.slug ||
              "?"
            )
              .charAt(0)
              .toUpperCase()}
          </div>
        )}

        {/* Nom du personnage et badge Joshua */}
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
              color: activeCharacterData.isJoshua ? "#ffffff" : "#cccccc",
              fontSize: "1.75rem",
            }}
          >
            <TextScramble
              text={activeCharacterData.displayName || activeCharacterData.slug}
            />
          </h2>
        </div>

        {/* Biographie */}
        <div
          style={{
            width: "100%",
            textAlign: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              color: "#999",
              margin: "0 0 0.75rem 0",
              fontWeight: "normal",
            }}
          >
            Biographie
          </h3>
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
            <TextScramble
              text={
                activeCharacterData.biography ||
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam condimentum felis et est finibus, quis varius magna ullamcorper. Donec sit amet eros ac enim faucibus laoreet. Proin eget diam vestibulum, vehicula purus vel, fermentum purus."
              }
            />
          </p>
        </div>

        {/* Post avec le plus d'impact */}
        <div
          style={{
            width: "100%",
            marginBottom: "1rem",
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
            }}
          >
            Post sélectionné
          </h3>

          <div
            style={{
              background: "transparent",
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              height: "auto",
              minHeight: "180px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backdropFilter: "blur(2.5px)",
              WebkitBackdropFilter: "blur(2.5px)",
            }}
          >
            <div
              style={{
                overflow: "hidden",
                flex: "1 1 auto",
              }}
            >
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
                    activePost && (activePost.content || activePost.title)
                      ? activePost.content || activePost.title
                      : "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas egestas, enim in viverra aliquam, eros tellus rhoncus tellus, et dapibus magna nisi sit amet erat. Ut lacus turpis, varius eu urna vitae, feugiat semper urna."
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
              }}
            >
              <div style={{ display: "flex", gap: ".3rem" }}>
                <span style={{ opacity: 0.5 }}> Posté le</span>
                {activePost && activePost.creationDate ? (
                  <span>
                    {new Date(
                      activePost.creationDate * 1000
                    ).toLocaleDateString()}
                  </span>
                ) : (
                  <span>01/01/2023</span>
                )}
              </div>

              {/* Plateforme alignée à droite */}
              <div>
                {activePost && activePost.source ? (
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
