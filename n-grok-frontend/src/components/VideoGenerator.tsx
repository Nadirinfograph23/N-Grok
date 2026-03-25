import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { generateVideo, uploadImage } from "../lib/api";

type GenerationStatus = "idle" | "submitting" | "submitted" | "error";

const VIDEO_MODELS: Record<string, string> = {
  "Veo 3": "veo-3",
  "Veo 3 Fast": "veo-3-fast",
  "Veo 2": "veo-2",
};

const ASPECT_RATIOS = ["16:9", "9:16"];
const RESOLUTIONS = ["720p", "1080p"];

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("veo-2");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [, setImageRef] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showResMenu, setShowResMenu] = useState(false);

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("submitting");
    setErrorMsg("");
    setRequestId(null);
    setSubmitMessage("");

    try {
      const resp = await generateVideo({
        prompt: prompt.trim(),
        model,
        aspect_ratio: aspectRatio,
        resolution,
      });

      if (resp.post_id) {
        setRequestId(resp.post_id);
        setSubmitMessage(resp.message || "Video generation request submitted successfully.");
        setStatus("submitted");
      } else {
        setSubmitMessage("Video generation request submitted successfully.");
        setStatus("submitted");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setStatus("error");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    try {
      const result = await uploadImage(file);
      setImageRef(result.data_uri);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const removeImage = () => {
    setImageRef(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isGenerating = status === "submitting";

  return (
    <div style={{ height: "calc(100vh - 56px)" }} className="relative">
      <div className="w-full h-full flex flex-col items-center justify-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {/* Hero Section */}
        <div className="flex flex-col items-center mb-10 md:mb-20 animate-fade-in-up transition-all duration-700">
          <div className="mb-10 relative group">
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-1000" />
            <div className="relative w-24 h-24 md:w-32 md:h-32 bg-teal-900/40 rounded-3xl flex items-center justify-center border border-white/5 overflow-hidden">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-20 absolute -right-4 -bottom-4">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow relative z-10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <div className="absolute top-4 right-4 text-primary animate-pulse">+</div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-7xl font-black text-white tracking-widest uppercase mb-4 text-center px-4">
            VIDEO STUDIO
          </h1>
          <p className="text-secondary text-sm font-medium tracking-wide opacity-60">
            Animate images into stunning AI videos with motion effects
          </p>
        </div>

        {/* Result Section */}
        {status === "submitting" && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-white text-sm mb-1">Submitting video request...</p>
            </div>
          </div>
        )}

        {status === "submitted" && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-primary/10 backdrop-blur-xl border border-primary/20 rounded-2xl p-8 flex flex-col items-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-white text-sm font-bold mb-2">Request Submitted!</p>
              <p className="text-muted text-xs text-center mb-3">{submitMessage}</p>
              {requestId && (
                <p className="text-muted text-xs font-mono bg-white/5 px-3 py-1.5 rounded-lg">ID: {requestId}</p>
              )}
              <button
                onClick={() => { setStatus("idle"); setRequestId(null); setSubmitMessage(""); }}
                className="mt-4 text-xs font-bold text-black bg-primary px-4 py-2 rounded-xl hover:shadow-glow transition-all"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
              <p className="text-red-400 text-sm mb-3">{errorMsg}</p>
              <button
                onClick={() => setStatus("idle")}
                className="text-xs font-bold text-black bg-primary px-4 py-2 rounded-xl"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Prompt Input Card */}
        <div className="w-full max-w-4xl relative z-40 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl">
            {/* Upload + Prompt */}
            <div className="flex items-start gap-5 px-2">
              {/* Image upload */}
              <div className="relative">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {imagePreview ? (
                  <div className="relative w-10 h-10 mt-1.5">
                    <img src={imagePreview} alt="ref" className="w-10 h-10 rounded-xl object-cover border border-primary/40" />
                    <button onClick={removeImage} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">x</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Reference image"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 hover:bg-white/10 group border-white/10 hover:border-primary/40"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted group-hover:text-primary transition-colors">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Video clip icon */}
              <div className="relative">
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" />
                <button
                  type="button"
                  title="Reference video"
                  className="w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center mt-1.5 bg-white/5 hover:bg-white/10 group border-white/10 hover:border-primary/40"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted group-hover:text-primary transition-colors">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video you want to create"
                rows={1}
                className="flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar"
              />
            </div>

            {/* Bottom Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2 pt-4 border-t border-white/5 relative">
              <div className="flex items-center gap-1.5 md:gap-2.5 relative flex-wrap pb-1 md:pb-0">
                {/* Model Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowModelMenu(!showModelMenu); setShowRatioMenu(false); setShowResMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <div className="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                      <span className="text-[10px] font-black text-black">G</span>
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      {Object.entries(VIDEO_MODELS).find(([, v]) => v === model)?.[0] || model}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showModelMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {Object.entries(VIDEO_MODELS).map(([label, value]) => (
                        <button key={value} onClick={() => { setModel(value); setShowModelMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${model === value ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aspect Ratio */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowRatioMenu(!showRatioMenu); setShowModelMenu(false); setShowResMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60 text-secondary">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{aspectRatio}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showRatioMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {ASPECT_RATIOS.map((r) => (
                        <button key={r} onClick={() => { setAspectRatio(r); setShowRatioMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${aspectRatio === r ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolution */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowResMenu(!showResMenu); setShowRatioMenu(false); setShowModelMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-secondary">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{resolution}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showResMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {RESOLUTIONS.map((r) => (
                        <button key={r} onClick={() => { setResolution(r); setShowResMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${resolution === r ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="bg-primary text-black px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-black text-sm md:text-base hover:shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Generate +"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
