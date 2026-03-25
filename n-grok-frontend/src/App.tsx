import { useState } from "react";
import Header from "./components/Header";
import VideoGenerator from "./components/VideoGenerator";
import ImageGenerator from "./components/ImageGenerator";
import ChatInterface from "./components/ChatInterface";

function App() {
  const [activeTab, setActiveTab] = useState<"video" | "image" | "chat">("chat");

  return (
    <div className="min-h-screen bg-app-bg">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "chat" && <ChatInterface />}
      {activeTab === "video" && <VideoGenerator />}
      {activeTab === "image" && <ImageGenerator />}
    </div>
  );
}

export default App;
