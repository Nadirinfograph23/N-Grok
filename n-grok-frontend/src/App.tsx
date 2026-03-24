import { useState } from "react";
import Header from "./components/Header";
import VideoGenerator from "./components/VideoGenerator";
import ImageGenerator from "./components/ImageGenerator";

function App() {
  const [activeTab, setActiveTab] = useState<"video" | "image">("video");

  return (
    <div className="min-h-screen bg-app-bg">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "video" ? <VideoGenerator /> : <ImageGenerator />}
    </div>
  );
}

export default App;
