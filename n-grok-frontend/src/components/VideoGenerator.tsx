import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { generateVideo, checkVideoStatus } from "../lib/api";

type GenerationStatus = "idle" | "submitting" | "processing" | "succeeded" | "error";

const VIDEO_RESOLUTIONS: Record<string, { width: number; height: number }> = {
  "1280 x 720": { width: 1280, height: 720 },
  "960 x 544": { width: 960, height: 544 },
  "720 x 1280": { width: 720, height: 1280 },
  "544 x 960": { width: 544, height: 960 },
};

const VIDEO_LENGTHS: Record<string, number> = {
  "~5s (129 frames)": 129,
  "~2.5s (65 frames)": 65,
};

const INFERENCE_STEPS: Record<string, number> = {
  "30 steps (faster)": 30,
  "50 steps (default)": 50,
};

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("1280 x 720");
  const [videoLength, setVideoLength] = useState("~5s (129 frames)");
  const [inferenceSteps, setInferenceSteps] = useState("50 steps (default)");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showResMenu, setShowResMenu] = useState(false);
  const [showLengthMenu, setShowLengthMenu] = useState(false);
  const [showStepsMenu, setShowStepsMenu] = useState(false);

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const resp = await checkVideoStatus(id);
          if (resp.status === "succeeded" && resp.video_url) {
            stopPolling();
            setVideoUrl(resp.video_url);
            setStatus("succeeded");
            setStatusMessage("Video generated successfully!");
          } else if (resp.status === "failed" || resp.status === "canceled") {
            stopPolling();
            setErrorMsg(resp.error || resp.message || "Video generation failed.");
            setStatus("error");
          } else {
            setStatusMessage(resp.message || "Generating video...");
          }
        } catch {
          stopPolling();
          setErrorMsg("Failed to check video status. Please try again.");
          setStatus("error");
        }
      }, 5000);
    },
    [stopPolling]
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("submitting");
    setErrorMsg("");
    setPredictionId(null);
    setVideoUrl(null);
    setStatusMessage("Submitting video request...");

    const res = VIDEO_RESOLUTIONS[resolution];

    try {
      const resp = await generateVideo({
        prompt: prompt.trim(),
        width: res.width,
        height: res.height,
        video_length: VIDEO_LENGTHS[videoLength],
        num_inference_steps: INFERENCE_STEPS[inferenceSteps],
        image: imageBase64 || undefined,
      });

      if (resp.status === "failed") {
        setErrorMsg(resp.error || resp.message || "Video generation failed.");
        setStatus("error");
      } else if (resp.status === "succeeded" && resp.video_url) {
        setVideoUrl(resp.video_url);
        setStatus("succeeded");
        setStatusMessage("Video generated successfully!");
      } else if (resp.prediction_id) {
        setPredictionId(resp.prediction_id);
        setStatus("processing");
        setStatusMessage("Video is being generated. This may take a few minutes...");
        startPolling(resp.prediction_id);
      } else {
        setErrorMsg("Unexpected response from server.");
        setStatus("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setStatus("error");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageBase64(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetState = () => {
    stopPolling();
    setStatus("idle");
    setPredictionId(null);
    setVideoUrl(null);
    setStatusMessage("");
    setErrorMsg("");
  };

  const isGenerating = status === "submitting" || status === "processing";

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
            Generate stunning AI videos from text &amp; images with HunyuanVideo
          </p>
        </div>

        {/* Result Section */}
        {(status === "submitting" || status === "processing") && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-white text-sm mb-1">{statusMessage}</p>
              {status === "processing" && (
                <p className="text-muted text-xs mt-2">This may take 3-5 minutes depending on the settings</p>
              )}
              {predictionId && (
                <p className="text-muted text-xs font-mono bg-white/5 px-3 py-1.5 rounded-lg mt-3">ID: {predictionId}</p>
              )}
            </div>
          </div>
        )}

        {status === "succeeded" && videoUrl && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col items-center">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-xl mb-4"
              />
              <div className="flex items-center gap-3">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="text-xs font-bold text-black bg-primary px-5 py-2.5 rounded-xl hover:shadow-glow transition-all"
                >
                  Download Video
                </a>
                <button
                  onClick={resetState}
                  className="text-xs font-bold text-white bg-white/10 px-5 py-2.5 rounded-xl hover:bg-white/20 transition-all border border-white/10"
                >
                  Generate Another
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="w-full max-w-2xl mb-8 animate-fade-in-up">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
              <p className="text-red-400 text-sm mb-3">{errorMsg}</p>
              <button
                onClick={resetState}
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
              {/* Image upload for image-to-video */}
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
                    title="Upload image (image-to-video)"
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
                placeholder={imageBase64 ? "Describe how to animate this image..." : "Describe the video you want to create"}
                rows={1}
                className="flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar"
              />
            </div>

            {/* Bottom Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2 pt-4 border-t border-white/5 relative">
              <div className="flex items-center gap-1.5 md:gap-2.5 relative flex-wrap pb-1 md:pb-0">
                {/* Resolution Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowResMenu(!showResMenu); setShowLengthMenu(false); setShowStepsMenu(false); }}
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
                      {Object.keys(VIDEO_RESOLUTIONS).map((r) => (
                        <button key={r} onClick={() => { setResolution(r); setShowResMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${resolution === r ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video Length */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowLengthMenu(!showLengthMenu); setShowResMenu(false); setShowStepsMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60 text-secondary">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{videoLength}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showLengthMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {Object.keys(VIDEO_LENGTHS).map((l) => (
                        <button key={l} onClick={() => { setVideoLength(l); setShowLengthMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${videoLength === l ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{l}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inference Steps */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowStepsMenu(!showStepsMenu); setShowResMenu(false); setShowLengthMenu(false); }}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-secondary">
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{inferenceSteps}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showStepsMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {Object.keys(INFERENCE_STEPS).map((s) => (
                        <button key={s} onClick={() => { setInferenceSteps(s); setShowStepsMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${inferenceSteps === s ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{s}</button>
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
