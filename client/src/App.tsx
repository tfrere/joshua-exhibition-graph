import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Graph } from "./pages/Graph";
import { Post } from "./pages/Post";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Graph />} />
        <Route path="/post" element={<Post />} />
      </Routes>
    </Router>
  );
}

export default App;
