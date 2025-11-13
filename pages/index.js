import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Footer from "@/components/Footer";

// compress util (paste after imports)
async function shrinkFile(file, maxWidth = 1024, quality = 0.8) {
  // kalau bukan image, return original
  if (!file.type || !file.type.startsWith("image/")) return file;

  // create image element
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imgEl);
    };
    imgEl.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    imgEl.src = url;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const cw = Math.round(img.width * scale);
  const ch = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, cw, ch);

  // Convert to blob (jpeg) with quality
  const blob = await new Promise((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );

  // if conversion failed, fallback to original
  if (!blob) return file;

  // Create a File instance so FormData works same
  const newFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });

  return newFile;
}

// --- Paste this after imports, before Home() ---
function ZoomableImage({ src }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // remount/center when src changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  // wheel to zoom (centered on cursor)
  const handleWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const prevZoom = zoom;
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    const nextZoom = Math.min(3, Math.max(0.5, +(prevZoom + delta).toFixed(2)));

    // adjust offset so zoom centers at cursor
    const img = imgRef.current;
    if (img) {
      const imgRect = img.getBoundingClientRect();
      const imgX = (cx - offset.x - (rect.width - imgRect.width) / 2);
      const imgY = (cy - offset.y - (rect.height - imgRect.height) / 2);

      const ratio = nextZoom / prevZoom;

      const newOffsetX = offset.x - (imgX * (ratio - 1));
      const newOffsetY = offset.y - (imgY * (ratio - 1));
      setOffset({ x: newOffsetX, y: newOffsetY });
    }

    setZoom(nextZoom);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragging(false);
    if (containerRef.current) containerRef.current.style.cursor = "grab";
  };

  const handleDoubleClick = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f0f0e8",
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt="output"
        draggable={false}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transition: dragging ? "none" : "transform 0.12s ease-out",
          maxWidth: "100%",
          maxHeight: "100%",
          borderRadius: 6,
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}


// === Toast System ===

function Toast({ toast }) {
  if (!toast.visible) return null;
  const colors = {
    success: "linear-gradient(to right, #00d26a, #00994b)",
    error: "linear-gradient(to right, #ff4b2b, #c4001a)",
    info: "linear-gradient(to right, #3b82f6, #2563eb)",
  };

  return (
    <div
      style={{
        position: "fixed",
        ttop: 70,
        right: 40,        
        background: colors[toast.type] || colors.info,
        color: "white",
        padding: "10px 16px",
        borderRadius: "8px",
        boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        fontSize: "14px",
        fontWeight: "500",
        zIndex: 2000,
        animation: "fadeInOut 3s ease forwards",
      }}
    >
      {toast.message}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-10px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}


export default function Home() {

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  
  const [toast, setToast] = useState({ message: "", type: "", visible: false });

function showToast(message, type = "info", duration = 3000) {
  setToast({ message, type, visible: true });
  setTimeout(() => setToast({ message: "", type: "", visible: false }), duration);
}

  const [imageSize, setImageSize] = useState("1024x1024");
//login
const [showLoginModal, setShowLoginModal] = useState(false);
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [loginLoading, setLoginLoading] = useState(false);
const [usernameInput, setUsernameInput] = useState("");
const [passwordInput, setPasswordInput] = useState("");

// cek apakah sudah login
useEffect(() => {
  const token = localStorage.getItem("sogni_token");
  const username = localStorage.getItem("sogni_username");
  setIsLoggedIn(!!(token && username));
}, []);

async function handleLoginSubmit(e) {
  e.preventDefault();
  setLoginLoading(true);
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: usernameInput,
        password: passwordInput,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login gagal");

    localStorage.setItem("sogni_username", data.username);
    localStorage.setItem("sogni_token", data.token);
    if (data.refreshToken)
      localStorage.setItem("sogni_refresh", data.refreshToken);

    setIsLoggedIn(true);
    setShowLoginModal(false);
    showToast("✅ Login sukses!", "success");
  } catch (err) {
    showToast("❌ " + err.message);
  } finally {
    setLoginLoading(false);
  }
}
  const [prompt, setPrompt] = useState(
    "thin colorful sketchy lines, flat pastel colors, childlike chibi, cute face, sleepy eyes, multicolor pixel outlines"
  );
  const [strength, setStrength] = useState(0.45);
  const [promptStrength, setPromptStrength] = useState(6.5);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [tokenType, setTokenType] = useState("auto");
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [polling, setPolling] = useState(false);
  const [outputs, setOutputs] = useState([]);
  const [progress, setProgress] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const dropRef = useRef(null);
  const router = useRouter();

  
  // Fetch models
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/models");
        const j = await res.json();
        setModels(j.models || []);
        if (j.models?.length) setSelectedModel(j.models[0].id);
      } catch {}
    })();
  }, []);

  // Polling job
  useEffect(() => {
    if (!polling || !jobId) return;
    let mounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?jobId=${jobId}`);
        const j = await res.json();
        if (!mounted) return;
        setJobStatus(j.status);
        if (j.status === "done") {
          setOutputs(j.outputs || []);
          setPolling(false);
          setProgress(100);
        } else if (j.status === "error") {
          setPolling(false);
          setProgress(0);
        }
      } catch {
        setPolling(false);
      }
    }, 2500);

    const progInterval = setInterval(() => {
      setProgress((p) => (p >= 98 ? p : p + Math.random() * 2.5));
    }, 800);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      clearInterval(progInterval);
    };
  }, [polling, jobId]);

  // Drag and drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e) => {
      e.preventDefault();
      el.classList.add("drag-over");
    };
    const onDragLeave = () => el.classList.remove("drag-over");
    const onDrop = (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      if (e.dataTransfer?.files?.length) handleFiles(Array.from(e.dataTransfer.files));
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  function bytesToSize(bytes) {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
  }

  function handleFiles(selectedFiles) {
    const arr = Array.from(selectedFiles)
      .filter((f) => f.type?.startsWith("image/"))
      .map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        name: f.name,
        size: f.size,
        url: URL.createObjectURL(f),
      }));
    setFiles((prev) => [...prev, ...arr]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!files.length) return showToast("Please upload at least one image.");
  
    setIsUploading(true);
    setOutputs([]);
    setProgress(0);
    setJobId(null);
    setJobStatus(null);
  
    try {
      // compress each file (parallel)
      showToast("Compressing images…", "info", 1500);
      const compressed = await Promise.all(
        files.map(async (f) => {
          try {
            // adjust maxWidth/quality if you want smaller size
            const small = await shrinkFile(f.file, 1024, 0.8);
            return { ...f, file: small, size: small.size || f.size };
          } catch (err) {
            console.warn("shrinkFile failed, using original:", err);
            return f;
          }
        })
      );
  
      // optional: check total size and warn/stop if still too big
      const total = compressed.reduce((s, x) => s + (x.file?.size || 0), 0);
      const maxTotalAllowed = 20 * 1024 * 1024; // 20MB safe target
      if (total > maxTotalAllowed) {
        showToast(`Total upload ${Math.round(total/1024/1024)}MB — too big. Try smaller images.`, "error");
        setIsUploading(false);
        return;
      }
  
      // build FormData
      const fd = new FormData();
      fd.append("imageSize", imageSize);
      fd.append("prompt", prompt);
      fd.append("strength", String(strength));
      fd.append("promptStrength", String(promptStrength));
      if (selectedModel) fd.append("modelId", selectedModel);
      fd.append("tokenType", tokenType);
  
      for (const item of compressed) {
        fd.append("files", item.file, item.file.name || "upload.jpg");
      }
  
      const token = localStorage.getItem("sogni_token");
      const username = localStorage.getItem("sogni_username");
      const refreshToken = localStorage.getItem("sogni_refresh");
  
      if (!token || !username) {
        showToast("Harap login terlebih dahulu sebelum generate.");
        setShowLoginModal(true);
        setIsUploading(false);
        return;
      }
  
      fd.append("userToken", token);
      fd.append("username", username);
      if (refreshToken) fd.append("refreshToken", refreshToken);
  
      // use fetch for simplicity; keep simple progress UI via fake progress loop already in code
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      let data;
      try { data = await res.json(); } catch (err) { data = null; }
  
      if (!res.ok) {
        // try to show helpful message
        const errMsg = (data && (data.error || data.detail)) || `Upload failed (status ${res.status})`;
        throw new Error(errMsg);
      }
  
      setJobId(data.jobId);
      setPolling(true);
      setJobStatus("queued");
      showToast("Upload accepted — job queued", "success");
    } catch (err) {
      console.error("upload error:", err);
      showToast("❌ " + (err.message || "Upload failed"));
    } finally {
      setIsUploading(false);
    }
  }
  

  // Modal
  const openModal = (i) => {
    setModalIndex(i);
    setZoom(1);
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeModal = () => {
    setModalOpen(false);
    setZoom(1);
    document.body.style.overflow = "";
  };


  return (
    <>
      <style>{`
      body {
        font-family: Tahoma, Verdana, sans-serif;
        background: url("/assets/background.png") center/cover no-repeat;
        color: #002e6b;
        margin-top: 60px;
      }
      .windows-layout {
        display: flex;
        gap: 20px;
        padding: 20px;
      }
      .xp-window {
        background: #ece9d8;
        border: 2px solid #999;
        border-radius: 6px;
        box-shadow: inset 1px 1px #fff, inset -1px -1px #555;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .xp-titlebar {
        background: linear-gradient(to bottom, #0050ef, #003399);
        color: white;
        font-weight: bold;
        padding: 6px 10px;
        border-bottom: 1px solid #002266;
      }
      .xp-content {
        padding: 12px;
        overflow-y: auto;
      }
      textarea, input, select {
        width: 100%;
        box-sizing: border-box;
        margin-top: 4px;
      }
      .btn {
        background: linear-gradient(to bottom, #e8f0ff, #b8cfff);
        border: 1px solid #5b85d9;
        padding: 5px 8px;
        font-weight: bold;
        color: #002b88;
        cursor: pointer;
        border-radius: 3px;
      }
      .btn:hover { background: #d0e0ff; }
      .upload-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 6px;
      }
      .upload-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 8px;
      }
      .file-card {
        border: 1px solid #999;
        padding: 6px;
        text-align: center;
        background: #fff;
      }
      .thumb {
        width: 100%;
        height: 80px;
        object-fit: cover;
        border: 1px solid #aaa;

      }.progress-wrapper {
        position: relative;
        margin-top: 8px;
        height: 90px;
      }
      
      
      
      .progress-container {
        bottom: 0; 
        height: 10px;
        border-radius: 5px;
        overflow: visible; /* ubah dari hidden */
        position: relative;
      }
      
      
      .progress-bar {
        height: 100%;
        background: linear-gradient(to right, #00b4ff, #006aff);
        transition: width 0.4s ease;
      }
      

      @keyframes push {
        0%, 100% { transform: translateY(-50%) scaleX(1); }
        50% { transform: translateY(-48%) scaleX(1.02); }
      }

      
      .progress-character {
        animation: push 0.6s ease-in-out infinite;
        position: relative;
        bottom: 0; /* biar sejajar sama bar */
        left: 0;
        width: 42px;
        height: 42px;
        transform: translate(-80%, -10%); /* dorong dikit ke kiri dan sejajar vertikal */
        transition: left 0.4s ease;
        image-rendering: pixelated;
        z-index: 5; /* lebih kecil dari bar, biar dia di depan tapi bar-nya kelihatan */
      }
      
      
      .progress-text-follow {
        position: absolute;
        top: 15px; /* atau sesuaikan biar pas di bawah karakter */
        font-size: 12px;
        color: #003399;
        font-weight: bold;
        text-shadow: 1px 1px #fff;
        transition: left 0.4s ease;
      }
      
      
      
      
      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 10px;
      }
      .preview-card img {
        width: 100%;
        cursor: pointer;
        border: 2px solid #999;
        border-radius: 4px;
      }
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
      }
      .overlay .xp-window {
        max-width: 90vw;
        max-height: 90vh;
        background: #ece9d8;
        position: relative;
      }
      .viewer-topbar {
        background: #003399;
        color: white;
        display: flex;
        justify-content: space-between;
        padding: 5px;
      }
      .viewer-body {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 70vh;
      }
      .viewer-body img {
        max-width: 100%;
        max-height: 100%;
        transform: scale(var(--zoom, 1));
        transition: transform 0.2s ease;
      }
      .viewer-footer {
        text-align: center;
        padding: 6px;
        background: #ccc;
        font-size: 12px;
      }
      `}</style>

{/* === NAVBAR === */}
<div
  style={{
    width: "100%",
    height: 52,
    background: "linear-gradient(to bottom, #0078d7, #005fb8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px 0 0px",
    color: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 1000,
  }}
>
  {/* Menu kiri */}
  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
    <span
      style={{
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: 0.5,
        textShadow: "1px 1px 1px rgba(0,0,0,0.4)",
        marginLeft: "20px",
      }}
    >
      🪄 Sogni Harmonizer
    </span>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        marginLeft: "20px",
      }}
    >
      <span style={{ textDecoration: "underline" }} onClick={() => router.push("/")}>Batch</span>
      <span onClick={() => router.push("/edit")}>Edit</span>
      <span onClick={() => router.push("/nft-layer")}>Nft Layering</span>
      <span onClick={() => router.push("/faq")}>Blog</span>
      
      

    </div>
  </div>

  {/* Login button di kanan */}
  <div
    onClick={() => {
  if (isLoggedIn) {
    setShowLogoutConfirm(true); // munculin modal konfirmasi
  } else {
    setShowLoginModal(true);
  }
}}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "rgba(255,255,255,0.95)",
      borderRadius: 20,
      padding: "4px 12px",
      cursor: "pointer",
      color: "#222",
      fontWeight: 600,
      transition: "all 0.2s ease",
      marginRight: "20px",
    }}
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: isLoggedIn ? "#00d26a" : "#ff3b30",
        boxShadow: isLoggedIn
          ? "0 0 6px 2px rgba(0,210,106,0.6)"
          : "0 0 6px 2px rgba(255,59,48,0.5)",
      }}
    />
    {isLoggedIn ? "Logout" : "Login"}
  </div>
</div>




      <div className="windows-layout">
        {/* Left panel */}
        <div className="xp-window">
          <div className="xp-titlebar">🎨 Sogni Harmonizer — Tools</div>
          <div className="xp-content">
            <form onSubmit={handleSubmit}>
              <label>Prompt</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <label>Strength: {strength}</label>
              <input type="range" min="0" max="1" step="0.01" value={strength} onChange={(e) => setStrength(+e.target.value)} />
              <label>Prompt Strength: {promptStrength}</label>
              <input type="range" min="0" max="30" step="0.1" value={promptStrength} onChange={(e) => setPromptStrength(+e.target.value)} />
              <label>Model</label>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                <option value="">(default)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <label>Token Type</label>
              <select value={tokenType} onChange={(e) => setTokenType(e.target.value)}>
                <option value="auto">Auto (recommended)</option>
                <option value="spark">Spark</option>
                <option value="sogni">Sogni</option>
              </select>

              <label>Image Size</label>
<select
  value={imageSize}
  onChange={(e) => setImageSize(e.target.value)}
>
  <option value="1024x1024">Square (1:1)</option>
  <option value="1280x720">HD (16:9)</option>
  <option value="960x1280">Portrait (3:4)</option>
  <option value="1920x1080">Full HD (16:9)</option>
</select>

              <label>Upload Images</label>
              <div ref={dropRef} className="upload-controls">
                <input id="file_input" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
                <label htmlFor="file_input" className="btn">Choose Files</label>
                <button type="submit" className="btn" disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Upload & Generate"}
                </button>
              </div>
              {files.length > 0 && (
                <div className="upload-grid">
                  {files.map((f) => (
                    <div key={f.id} className="file-card">
                      <img src={f.url} className="thumb" alt={f.name} />
                      <div>{f.name}</div>
                      <div>{bytesToSize(f.size)}</div>
                      <button className="btn" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right panel */}
        <div className="xp-window">
          <div className="xp-titlebar">🖼️ XP Viewer — Results</div>
          <div className="xp-content">
            <div>Job ID: {jobId || "-"}</div>
            <div>Status: {jobStatus || "-"}</div>
            {polling && (
  <div className="progress-wrapper">
    <div className="progress-container">
      <div
        className="progress-bar"
        style={{ width: `${progress}%` }}
      ></div>
      <img
        src="/assets/chibi.png"
        alt="chibi pushing"
        className="progress-character"
        style={{
          left: `calc(${progress}% - 29px)`, // posisi geser dari bar
        }}
        
      />
      <div
        className="progress-text-follow"
        style={{
          left: `calc(${progress}% - 20px)`, // posisinya ngikut bar juga
        }}
      >
        {Math.floor(progress)}%
      </div>
    </div>
    
  </div>
)}


            {outputs.length > 0 && (
              <>
                <h3>Results</h3>
                <div className="preview-grid">
                  {outputs.map((o, i) => (
                    <div key={i} className="preview-card">
                      <img src={o.url} onClick={() => openModal(i)} alt={`output-${i}`} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>


{/* Login Modal */}
{showLoginModal && (
  <div
    onClick={(e) => e.target === e.currentTarget && setShowLoginModal(false)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 8,
        width: 300,
        boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
      }}
    >
      <h3 style={{ marginBottom: 10, textAlign: "center" }}>🔐 Login ke Sogni</h3>
      <form onSubmit={handleLoginSubmit}>
        <label>Username</label>
        <input
          type="text"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 10,
            padding: "6px 8px",
            border: "1px solid #aaa",
            borderRadius: 4,
          }}
        />
        <label>Password</label>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 14,
            padding: "6px 8px",
            border: "1px solid #aaa",
            borderRadius: 4,
          }}
        />
        <button
          type="submit"
          disabled={loginLoading}
          style={{
            width: "100%",
            padding: "6px 0",
            background: "#4b7cff",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {loginLoading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  </div>
)}


{/* Modal */}
{modalOpen && outputs[modalIndex] && (
  <div
    className="overlay"
    onClick={(e) => e.target === e.currentTarget && closeModal()}
  >
    <div
      className="xp-window"
      style={{
        width: "min(85vw, 700px)",
        height: "min(85vh, 600px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="viewer-topbar"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            className="btn"
            title="Previous"
            onClick={(e) => {
              e.stopPropagation();
              setModalIndex((i) => (i === 0 ? outputs.length - 1 : i - 1));
            }}
          >
            ⬅️
          </button>
          <button
            className="btn"
            title="Next"
            onClick={(e) => {
              e.stopPropagation();
              setModalIndex((i) => (i === outputs.length - 1 ? 0 : i + 1));
            }}
          >
            ➡️
          </button>
          <div style={{ width: 8 }} />
          <small style={{ color: "#fff", marginLeft: 6 }}>
            {modalIndex + 1} / {outputs.length}
          </small>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
  <button
    className="btn"
    title="Save Image"
    onClick={(e) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = outputs[modalIndex].url;
      link.download = `sogni_harmonizer_${modalIndex + 1}.png`;
      link.click();
    }}
  >
    💾 Save
  </button>

  {/* NEW: Save all outputs */}
  <button
    className="btn"
    title="Save All Outputs"
    onClick={async (e) => {
      e.stopPropagation();
      const zip = new JSZip();
      const folder = zip.folder("sogni_outputs");
      for (let i = 0; i < outputs.length; i++) {
        try {
          const res = await fetch(outputs[i].url);
          const blob = await res.blob();
          folder.file(`output_${i + 1}.png`, blob);
        } catch (err) {
          console.error("Failed to add image:", err);
        }
      }
      const blobZip = await zip.generateAsync({ type: "blob" });
      saveAs(blobZip, "sogni_outputs.zip");
    }}
  >
    📦 Save All
  </button>

  <button
    className="btn"
    onClick={(e) => {
      e.stopPropagation();
      closeModal();
    }}
  >
    ✕
  </button>
</div>

      </div>

      {/* ZoomableImage remounts when key changes -> resets zoom/offset */}
      <ZoomableImage key={outputs[modalIndex].url} src={outputs[modalIndex].url} />

      <div className="viewer-footer" style={{ textAlign: "center", padding: 6 }}>
        {outputs[modalIndex].name || `output ${modalIndex + 1}`}
      </div>
    </div>
    
  </div>
)}
<Toast toast={toast} />
{/* === LOGOUT CONFIRMATION MODAL (RETRO STYLE) === */}
{showLogoutConfirm && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3000,
      backdropFilter: "blur(2px)",
      animation: "fadeIn 0.3s ease",
      fontFamily: "'MS Sans Serif', 'Tahoma', sans-serif",
    }}
  >
    <div
      style={{
        background: "#C0C0C0",
        border: "2px solid #000",
        boxShadow: "3px 3px 0 #000",
        borderTopColor: "#fff",
        borderLeftColor: "#fff",
        width: "320px",
        padding: "12px",
        color: "#000",
        animation: "popIn 0.25s ease",
      }}
    >
      {/* === Title bar === */}
      <div
        style={{
          background: "linear-gradient(90deg, #000080, #0000cd)",
          color: "#fff",
          padding: "4px 8px",
          fontWeight: "bold",
          fontSize: "13px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span>Confirm Exit</span>
        <button
          onClick={() => setShowLogoutConfirm(false)}
          style={{
            background: "#c0c0c0",
            border: "2px outset #fff",
            fontWeight: "bold",
            width: 18,
            height: 18,
            textAlign: "center",
            lineHeight: "13px",
            cursor: "pointer",
            color: "#000",
          }}
        >
          ×
        </button>
      </div>

      {/* === Content === */}
      <div style={{ fontSize: "13px", marginBottom: "20px" }}>
        <p style={{ marginBottom: "8px" }}>Yakin mau logout, bre?</p>
        <p style={{ margin: 0 }}>Semua sesi bakal ditutup.</p>
      </div>

      {/* === Buttons === */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
        <button
          onClick={() => {
            localStorage.clear();
            setIsLoggedIn(false);
            setShowLogoutConfirm(false);
            showToast("👋 Logout sukses!", "success");
          }}
          style={{
            background: "#c0c0c0",
            border: "2px outset #fff",
            padding: "4px 20px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
          onMouseDown={(e) =>
            (e.target.style.border = "2px inset #fff")
          }
          onMouseUp={(e) =>
            (e.target.style.border = "2px outset #fff")
          }
        >
          Yes
        </button>

        <button
          onClick={() => setShowLogoutConfirm(false)}
          style={{
            background: "#c0c0c0",
            border: "2px outset #fff",
            padding: "4px 20px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
          onMouseDown={(e) =>
            (e.target.style.border = "2px inset #fff")
          }
          onMouseUp={(e) =>
            (e.target.style.border = "2px outset #fff")
          }
        >
          Cancel
        </button>
      </div>

      {/* === Animations === */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  </div>
)}

<Footer />

    </>
  );
}
