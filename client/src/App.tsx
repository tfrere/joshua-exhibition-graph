import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Post } from "./pages/Post";
import { CustomGraphView } from "./pages/CustomGraphView";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CustomGraphView />} />
        <Route path="/post" element={<Post />} />
      </Routes>
    </Router>
  );
}

export default App;
