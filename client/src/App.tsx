import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Post } from "./pages/Post";
import { CustomGraphView } from "./pages/CustomGraphView";
import { LombardiGraph } from "./pages/LombardiGraph";
import { LombardiGraph3D } from "./pages/LombardiGraph3D";
import { LombardiGraph3DPosts } from "./pages/LombardiGraph3DPosts";
import { DebugProvider } from "./hooks/useDebugMode";

function App() {
  return (
    <DebugProvider>
      <Router>
        <Routes>
          <Route path="/" element={<CustomGraphView />} />
          <Route path="/post" element={<Post />} />
          <Route path="/lombardi-graph" element={<LombardiGraph />} />
          <Route path="/lombardi-graph-3d" element={<LombardiGraph3D />} />
          <Route path="/lombardi-graph-3d-posts" element={<LombardiGraph3DPosts />} />
        </Routes>
      </Router>
    </DebugProvider>
  );
}

export default App;
