import { useRef } from "react";
import { initSocketSync } from "../HomePage/components/Posts/hooks/useNearestPostDetection";
import { useVisitCounter } from "./hooks/useVisitCounter";
import { useNavigationMode } from "./hooks/useNavigationMode";
import { usePostData } from "./hooks/usePostData";
import CharacterProfile from "./components/CharacterProfile";
import LoadingScreen from "./components/LoadingScreen";

/**
 * Composant principal de la page de post
 * @returns {JSX.Element} - Élément JSX
 */
function PostPage() {
  const loaderRef = useRef(null);

  // Initialiser la connexion socket
  const socket = initSocketSync();

  // Exposer le socket globalement pour que d'autres composants puissent l'utiliser
  if (socket && !window.socket) {
    window.socket = socket;
  }

  // Utiliser les hooks personnalisés pour gérer les différentes parties de la logique
  const {
    visitedPosts,
    totalPosts,
    isCountingEnabled,
    visitedPercentage,
    setIsCountingEnabled,
    updateVisitedPosts,
    setTotalPostsCount,
  } = useVisitCounter(socket);

  const { navigationMode, setNavigationMode } =
    useNavigationMode(setIsCountingEnabled);

  const { activeCharacterData, activePost, characterImageExists, isLoading } =
    usePostData(navigationMode, updateVisitedPosts, setTotalPostsCount);

  // Afficher un écran de chargement
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Afficher le profil du personnage avec toutes les données
  return (
    <CharacterProfile
      activeCharacterData={activeCharacterData}
      activePost={activePost}
      characterImageExists={characterImageExists}
      navigationMode={navigationMode}
      isCountingEnabled={isCountingEnabled}
      visitedPosts={visitedPosts}
      totalPosts={totalPosts}
      visitedPercentage={visitedPercentage}
    />
  );
}

export default PostPage;
