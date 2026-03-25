import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { generateImage, editImage, uploadImage } from "../lib/api";

type Mode = "generate" | "edit";

const IMAGE_MODELS: Record<string, string> = {
  "Imagen 4 Ultra": "imagen-4-ultra",
  "Imagen 4 Fast": "imagen-4-fast",
  "Imagen 4": "imagen-4",
  "Imagen Flash": "imagen-flash",
};

const IMAGE_STYLES = [
  "None",
  "3D Render",
  "Acrylic",
  "Anime General",
  "Creative",
  "Dynamic",
  "Fashion",
  "Game Concept",
  "Graphic Design 3D",
  "Illustration",
  "Photorealistic",
  "Portrait",
  "Portrait Cinematic",
  "Portrait Fashion",
  "Ray Traced",
  "Stock Photo",
  "Watercolor",
];

const MODEL_ASPECT_RATIOS: Record<string, string[]> = {
  "imagen-4-ultra": ["1:1", "3:4", "4:3", "16:9", "9:16"],
  "imagen-4-fast": ["1:1", "3:4", "4:3", "16:9", "9:16"],
  "imagen-4": ["1:1", "3:4", "4:3", "16:9", "9:16"],
  "imagen-flash": ["16:9", "9:16"],
};

const MODELS_WITH_IMAGE_REF = ["imagen-flash"];

export default function ImageGenerator() {
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("imagen-flash");
  const [style, setStyle] = useState("None");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageRef, setImageRef] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAspectRatios = MODEL_ASPECT_RATIOS[model] || ["1:1", "16:9", "9:16"];

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const ratios = MODEL_ASPECT_RATIOS[newModel] || ["1:1"];
    if (!ratios.includes(aspectRatio)) {
      setAspectRatio(ratios[0]);
    }
    if (!MODELS_WITH_IMAGE_REF.includes(newModel) && mode === "edit") {
      setMode("generate");
    }
    setShowModelMenu(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (mode === "edit" && !imageRef) {
      setErrorMsg("Please upload an image to edit");
      return;
    }

    setLoading(true);
    setResults([]);
    setErrorMsg("");

    try {
      if (mode === "generate") {
        const resp = await generateImage({
          prompt: prompt.trim(),
          model,
          aspect_ratio: aspectRatio,
          style: style !== "None" ? style : undefined,
        });
        const urls = resp.data
          .map((d) => d.url)
          .filter((u): u is string => !!u);
        setResults(urls);
      } else {
        const resp = await editImage({
          prompt: prompt.trim(),
          image_base64: imageRef!,
        });
        const urls = resp.data
          .map((d) => d.url)
          .filter((u): u is string => !!u);
        setResults(urls);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
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
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="absolute top-4 right-4 text-primary animate-pulse">+</div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-7xl font-black text-white tracking-widest uppercase mb-4 text-center px-4">
            IMAGE STUDIO
          </h1>
          <p className="text-secondary text-sm font-medium tracking-wide opacity-60">
            Transform images with AI — generate, edit, and stylize
          </p>
        </div>

        {/* Results Section */}
        {loading && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-white text-sm">Generating with Grok Imagine...</p>
              <p className="text-muted text-xs mt-1">This may take up to a minute</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
              <p className="text-red-400 text-sm mb-3">{errorMsg}</p>
              <button
                onClick={() => setErrorMsg("")}
                className="text-xs font-bold text-black bg-primary px-4 py-2 rounded-xl"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="grid grid-cols-1 gap-4">
              {results.map((url, i) => (
                <div key={i} className="relative group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <img
                    src={url}
                    alt={`Generated ${i + 1}`}
                    className="w-full rounded-xl"
                  />
                  <div className="flex items-center justify-end mt-3 px-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-black bg-primary px-4 py-2 rounded-xl hover:shadow-glow transition-all"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
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
                    title="Upload reference image"
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
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === "generate" ? "Describe the image you want to create" : "Describe how you want to edit the image"}
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
                    onClick={() => { setShowModelMenu(!showModelMenu); setShowRatioMenu(false); setShowStyleMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <div className="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                      <span className="text-[10px] font-black text-black">G</span>
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      {Object.entries(IMAGE_MODELS).find(([, v]) => v === model)?.[0] || model}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showModelMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {Object.entries(IMAGE_MODELS).map(([label, value]) => (
                        <button key={value} onClick={() => handleModelChange(value)}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${model === value ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Style Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowStyleMenu(!showStyleMenu); setShowModelMenu(false); setShowRatioMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-secondary">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{style}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showStyleMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                      {IMAGE_STYLES.map((s) => (
                        <button key={s} onClick={() => { setStyle(s); setShowStyleMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${style === s ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mode Toggle (only for imagen-flash which supports image reference) */}
                {MODELS_WITH_IMAGE_REF.includes(model) && (
                  <button
                    type="button"
                    onClick={() => setMode(mode === "generate" ? "edit" : "generate")}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-secondary">
                      {mode === "generate" ? (
                        <>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </>
                      ) : (
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      )}
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      {mode === "generate" ? "Generate" : "Edit"}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )}

                {/* Aspect Ratio */}
                {mode === "generate" && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowRatioMenu(!showRatioMenu); setShowModelMenu(false); setShowStyleMenu(false); }}
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
                        {currentAspectRatios.map((r) => (
                          <button key={r} onClick={() => { setAspectRatio(r); setShowRatioMenu(false); }}
                            className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${aspectRatio === r ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                          >{r}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading}
                className="bg-primary text-black px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-black text-sm md:text-base hover:shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
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
