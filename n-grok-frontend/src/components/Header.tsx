interface HeaderProps {
  activeTab: "video" | "image";
  onTabChange: (tab: "video" | "image") => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="w-full z-50 sticky top-0 bg-black/95 backdrop-blur-md border-b border-white/5">
      <div className="w-full h-14 flex items-center justify-between px-4 md:px-5">
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="5" fill="#111" />
              <path d="M16 5L5 11V21L16 27L27 21V11L16 5Z" fill="white" />
              <path d="M16 10L9 14.5V21L16 25L23 21V14.5L16 10Z" fill="#111" />
              <path d="M16 15L12 17.5V21L16 23L20 21V17.5L16 15Z" fill="white" opacity="0.85" />
            </svg>
          </div>

          <nav className="flex items-center gap-5 text-[13px] font-semibold text-secondary">
            <button
              onClick={() => onTabChange("image")}
              className={`relative bg-transparent border-none p-0 flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "image" ? "text-white" : "text-secondary hover:text-white"
              }`}
            >
              Image
              {activeTab === "image" && (
                <div className="absolute -bottom-[17px] left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => onTabChange("video")}
              className={`relative bg-transparent border-none p-0 flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "video" ? "text-white" : "text-secondary hover:text-white"
              }`}
            >
              Video
              {activeTab === "video" && (
                <div className="absolute -bottom-[17px] left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-[13px] font-semibold text-secondary">N-Grok</span>
          <span className="text-[13px] font-bold bg-primary text-black px-3 py-1.5 rounded-lg">
            xAI
          </span>
        </div>
      </div>
    </header>
  );
}
