import { useSpring, animated } from "react-spring";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const IntroScreen = ({ onStart, onStartAudio }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // Simuler un temps de chargement des données avec un délai de 5 secondes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDataReady(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Animation pour le contenu texte
  const textSpring = useSpring({
    opacity: fadeOut ? 0 : 1,
    transform: fadeOut
      ? "translateY(-20px) scale(1.12)"
      : "translateY(0px) scale(1)",
    config: { tension: 400, friction: 40 },
  });

  // Animation pour le fond avec effet de zoom central léger
  const backgroundSpring = useSpring({
    opacity: fadeOut ? 0 : 1,
    transform: fadeOut ? "scale(1.2)" : "scale(1)",
    config: { tension: 380, friction: 30, duration: 500 },
    onRest: () => {
      if (fadeOut) {
        // Appeler le callback onStart après que l'animation soit terminée
        onStart();
      }
    },
  });

  const handleClick = () => {
    if (!dataReady) return; // Empêcher le clic tant que les données ne sont pas prêtes

    // Déclencher immédiatement l'audio
    onStartAudio();

    // Déclencher l'animation de fade out
    setFadeOut(true);
  };

  return (
    <animated.div
      style={{
        ...backgroundSpring,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        cursor: dataReady ? "pointer" : "default",
        transformOrigin: "center center", // Assure que le zoom est centré
      }}
      onClick={handleClick}
    >
      <animated.div
        style={{
          ...textSpring,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: "#fff",
          maxWidth: "400px",
          transformOrigin: "center center", // Assure que le zoom est centré
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "300",
            marginBottom: "15px",
            letterSpacing: "1px",
            opacity: 0.9,
            textAlign: "center",
          }}
        >
          Inside Joshua's Thought Loop
        </h1>
        <p
          style={{
            fontSize: "16px",
            opacity: 0.7,
            fontWeight: "300",
            textAlign: "center",
            marginBottom: "28px",
            lineHeight: "1.5",
          }}
        >
          Une expérience interactive explorant les réflexions et les connexions
          mentales derrière les récits artistiques de Joshua.
        </p>

        {dataReady ? (
          <animated.p
            style={{
              fontSize: "16px",
              opacity: 0.4,
              fontWeight: "300",
              textAlign: "center",
              animation: "oscillation 2s infinite",
            }}
          >
            Cliquez pour commencer l'expérience
          </animated.p>
        ) : (
          <div
            className="spinner-container"
            style={{ height: "1.5rem", marginTop: "8px" }}
          >
            <div
              className="spinner"
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "2px solid rgba(255, 255, 255, 0.1)",
                borderTopColor: "rgba(255, 255, 255, 0.4)",
                animation: "spin 1.5s linear infinite",
              }}
            ></div>
          </div>
        )}

        <style>
          {`
            @keyframes oscillation {
              0% { opacity: 0; }
              50% { opacity: 0.4; }
              100% { opacity: 0; }
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </animated.div>
    </animated.div>
  );
};

IntroScreen.propTypes = {
  onStart: PropTypes.func.isRequired,
  onStartAudio: PropTypes.func.isRequired,
};

export default IntroScreen;
