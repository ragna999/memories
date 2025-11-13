import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useRouter } from "next/router";
import Footer from "@/components/Footer";

export default function EditPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [hue, setHue] = useState(0);

  const dropRef = useRef(null);

  // === drag & drop ===
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
      if (e.dataTransfer?.files?.length)
        handleFiles(Array.from(e.dataTransfer.files));
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

  function handleFiles(selectedFiles) {
    const arr = Array.from(selectedFiles)
      .filter((f) => f.type?.startsWith("image/"))
      .map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        name: f.name,
        url: URL.createObjectURL(f),
      }));
    setFiles((prev) => [...prev, ...arr]);
  }

  async function handleSaveAll() {
    const zip = new JSZip();
    const folder = zip.folder("edited_images");

    for (const f of files) {
      const img = await loadImage(f.url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})hue-rotate(${hue}deg)`;
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      folder.file(`edited_${f.name.replace(/\.[^/.]+$/, "")}.png`, blob);
    }

    const blobZip = await zip.generateAsync({ type: "blob" });
    saveAs(blobZip, "sogni_batch_edit.zip");
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  return (
    <>
      {/* === GLOBAL STYLES === */}
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
        .btn {
          background: linear-gradient(to bottom, #e8f0ff, #b8cfff);
          border: 1px solid #5b85d9;
          padding: 6px 10px;
          font-weight: bold;
          color: #002b88;
          cursor: pointer;
          border-radius: 3px;
        }
        .btn:hover { background: #d0e0ff; }
        .upload-zone {
          border: 2px dashed #0078d7;
          border-radius: 6px;
          padding: 30px;
          text-align: center;
          margin-bottom: 16px;
          background: #f8f8f8;
          transition: background 0.2s ease;
        }
        .upload-zone.drag-over {
          background: #e0f0ff;
        }
        .preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
        .preview-grid img {
          width: 100%;
          border-radius: 6px;
          border: 1px solid #777;
        }
        .slider-group { margin-bottom: 12px; }
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
        {/* Kiri */}
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
            🧰 Sogni Batch Editor
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
            <span onClick={() => router.push("/")}>Batch</span>
            <span style={{ textDecoration: "underline" }}>Edit</span>
            <span onClick={() => router.push("/nft-layer")}>Nft Layering</span>
            <span onClick={() => router.push("/faq")}>Blog</span>
            
          </div>
        </div>
      </div>

      {/* === CONTENT AREA === */}
      <div className="windows-layout">
        {/* Left Panel: Controls */}
        <div className="xp-window">
          <div className="xp-titlebar">🎛️ Adjustments</div>
          <div className="xp-content">
            <div ref={dropRef} className="upload-zone">
              <p>🖼️ Drop your images here or click below to upload</p>
              <input
                id="file_input"
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <label htmlFor="file_input" className="btn">
                Choose Files
              </label>
            </div>

            {files.length > 0 && (
              <>
                <div className="slider-group">
                  <label>Brightness: {brightness}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.01"
                    value={brightness}
                    onChange={(e) => setBrightness(e.target.value)}
                  />
                </div>

                <div className="slider-group">
                <label>Hue: {hue}°</label>
                <input
                 type="range"
                  min="0"
                   max="360"
                 step="1"
                 value={hue}
                onChange={(e) => setHue(e.target.value)}
                />
                </div>

                <div className="slider-group">
                  <label>Contrast: {contrast}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.01"
                    value={contrast}
                    onChange={(e) => setContrast(e.target.value)}
                  />
                </div>
                <div className="slider-group">
                  <label>Saturation: {saturation}</label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.01"
                    value={saturation}
                    onChange={(e) => setSaturation(e.target.value)}
                  />
                </div>

                <button className="btn" onClick={handleSaveAll}>
                  💾 Save All (.zip)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className="xp-window">
          <div className="xp-titlebar">🖼️ Preview</div>
          <div className="xp-content">
            {files.length === 0 ? (
              <p style={{ color: "#555" }}>No images uploaded yet.</p>
            ) : (
              <div className="preview-grid">
                {files.map((f) => (
                  <div key={f.id}>
                    <img
                      src={f.url}
                      alt={f.name}
                      style={{
                        filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        textAlign: "center",
                        marginTop: 4,
                        color: "#222",
                      }}
                    >
                      {f.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer/>
    </>
  );
}
