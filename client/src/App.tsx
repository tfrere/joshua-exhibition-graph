import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Post } from "./pages/Post";
import { Posts } from "./pages/Posts";
import { CustomGraphView } from "./pages/CustomGraphView";
import { LombardiGraph3D } from "./pages/LombardiGraph3D";
import { DebugProvider } from "./hooks/useDebugMode";

function App() {
  return (
    <DebugProvider>
      <Router>
        <Routes>
          <Route path="/" element={<CustomGraphView />} />
          <Route path="/post" element={<Post />} />
          <Route path="/lombardi-graph-3d" element={<LombardiGraph3D />} />
          <Route path="/posts" element={<Posts />} />
        </Routes>
      </Router>
    </DebugProvider>
  );
}

export default App;
