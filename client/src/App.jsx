import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage/HomePage";
import PostPage from "./pages/PostPage/PostPage";
import WorkPage from "./pages/WorkPage/WorkPage";
import WorkPageForceGraph from "./pages/WorkPageForceGraph/WorkPageForceGraph";
import { DataProvider } from "./contexts/DataContext";
import "./App.css";

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/post" element={<PostPage />} />
            <Route path="/work" element={<WorkPage />} />
            <Route path="/work-force-graph" element={<WorkPageForceGraph />} />
          </Routes>
        </div>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
