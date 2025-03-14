import { useState, useEffect } from "react";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { calculateSVGBounds } from "../utils/svgUtils";

// Hook personnalisé pour vérifier et charger un SVG
const useSVGLoader = (node) => {
  const [useImage, setUseImage] = useState(false);
  const [svgData, setSvgData] = useState(null);
  const [svgBounds, setSvgBounds] = useState(null);

  useEffect(() => {
    const checkSvgExists = async () => {
      if (!node) {
        setUseImage(false);
        return;
      }

      console.log(node.name?.toLowerCase());

      // Déterminer le nom du fichier SVG en fonction du type de nœud
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
        svgFileName = node.name;
      }

      // Fonction pour charger et traiter un SVG
      const loadSvg = async (svgPath) => {
        try {
          const response = await fetch(svgPath);
          if (response.ok) {
            const loader = new SVGLoader();
            const svgText = await response.text();

            try {
              const data = loader.parse(svgText);

              // Verify that we have valid paths in the SVG data
              if (data.paths && data.paths.length > 0) {
                setUseImage(true);
                setSvgData(data);
                setSvgBounds(calculateSVGBounds(data.paths));
                return true; // SVG chargé avec succès
              }
            } catch (parseError) {
              console.log("Erreur de parsing SVG:", parseError);
            }
          }
        } catch (error) {
          console.log("Erreur de chargement SVG:", error);
        }
        return false; // Échec du chargement
      };

      try {
        // Chemin du SVG principal à charger
        const svgPath = `/img/${svgFileName}.svg`;

        // Essayer de charger le SVG principal
        const mainSvgLoaded = await loadSvg(svgPath);

        // Si le chargement a échoué et que c'est une plateforme, essayer default.svg
        if (!mainSvgLoaded && node.type === "platform") {
          const defaultSvgPath = "/img/default.svg";
          const defaultSvgLoaded = await loadSvg(defaultSvgPath);

          // Si même le SVG par défaut échoue, revenir à la sphère
          if (!defaultSvgLoaded) {
            setUseImage(false);
          }
        } else if (!mainSvgLoaded) {
          // Pour les non-plateformes, si le SVG principal échoue, revenir à la sphère
          setUseImage(false);
        }
      } catch (error) {
        setUseImage(false);
      }
    };

    checkSvgExists();
  }, [node]);

  return { useImage, svgData, svgBounds };
};

export default useSVGLoader;
