import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Post } from "./pages/Post";
import { CustomGraphView } from "./pages/CustomGraphView";
import { DebugProvider } from './hooks/useDebugMode';

function App() {
  return (
    <DebugProvider>
      <Router>
        <Routes>
          <Route path="/" element={<CustomGraphView />} />
          <Route path="/post" element={<Post />} />
        </Routes>
      </Router>
    </DebugProvider>
  );
}

export default App;
