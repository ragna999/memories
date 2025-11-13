import React from "react";

export default function Footer() {
  return (
    <div
      style={{
        width: "100%",
        background: "rgba(255, 255, 255, 0.7)",
        borderTop: "2px solid #005fb8",
        textAlign: "center",
        padding: "8px 0",
        fontSize: 12,
        color: "#003366",
        fontWeight: 500,
        backdropFilter: "blur(4px)",
        boxShadow: "0 -2px 6px rgba(0,0,0,0.1), inset 0 1px 0 #ffffffa0",
        textShadow: "1px 1px 0 rgba(255,255,255,0.6)",
        position: "fixed",   // 🔥 ini yang bikin nempel bawah
        bottom: 0,
        left: 0,
        zIndex: 999,
      }}
    >
      © 2025 <strong>Sogni Harmonizer</strong> — Crafted for Artists
    </div>
  );
}
