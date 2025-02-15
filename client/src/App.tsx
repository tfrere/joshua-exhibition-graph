import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Graph } from "./pages/Graph";
import { Post } from "./pages/Post";
import { CustomGraphView } from "./pages/CustomGraphView";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Graph />} />
        <Route path="/custom" element={<CustomGraphView />} />
        <Route path="/post" element={<Post />} />
      </Routes>
    </Router>
  );
}

export default App;
