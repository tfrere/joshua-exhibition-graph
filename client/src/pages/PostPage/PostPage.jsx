import { useRef } from "react";
import { useData } from "../../contexts/DataContext";

function PostPage() {
  const { postsData, isLoadingPosts, postsError } = useData();
  const loaderRef = useRef(null);

  // État de chargement
  if (isLoadingPosts && postsData.length === 0) {
    console.log("Chargement des posts...");
  }

  // État d'erreur
  if (postsError) {
    console.error("Erreur lors du chargement des posts:", postsError);
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      post page
    </div>
  );
}

export default PostPage;
