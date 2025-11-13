import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Footer from "@/components/Footer";

export default function FAQPage() {
  const router = useRouter();

  // ============================
  //  ARTICLES
  // ============================
  const articles = [
    {
      id: "Comingsoon",
      title: "comingsoon",
      author: "Gimly",
      date: "November 2025",
      readTime: "0",
      content: `
### Hallo  
(Q) hi i'm here
(A) hi here i'm gimly
      `,
    },
  ];

  const [activeArticle, setActiveArticle] = useState(articles[0]);
  const articleRef = useRef(null);

  useEffect(() => {
    if (articleRef.current) {
      const h3s = articleRef.current.querySelectorAll("h3");
      h3s.forEach((h) => (h.id = h.innerText.toLowerCase().replace(/\s+/g, "-")));
    }
  }, [activeArticle]);

  return (
    <>
      <style>{`
        body {
          font-family: Tahoma, Verdana, sans-serif;
          background: url("/assets/background.png") center/cover no-repeat;
          margin: 0;
        }

        /* === LAYOUT === */
        .layout {
          display: grid;
          grid-template-columns: 240px 1fr 200px;
          max-width: 1200px;
          margin: 100px auto;
          gap: 20px;
          padding: 0 20px;
        }

        /* Sidebar kiri */
        .sidebar {
          background: #f2f2f2;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: inset 1px 1px #fff;
          padding: 12px;
          height: fit-content;
        }

        .sidebar h3 {
          font-size: 14px;
          border-bottom: 1px solid #bbb;
          padding-bottom: 4px;
        }

        .sidebar li {
          list-style: none;
          padding: 6px 0;
          cursor: pointer;
          color: #0047ab;
          font-size: 13px;
        }

        .sidebar li:hover {
          text-decoration: underline;
        }

        .sidebar li.active {
          font-weight: bold;
          color: #002b75;
        }

        /* Artikel */
        .article {
          background: #ffffff;
          border: 1px solid #b5b5b5;
          border-radius: 4px;
          box-shadow: inset 1px 1px #fff, 1px 1px 3px rgba(0,0,0,0.2);
          padding: 30px 40px;
        }

        .article h1 {
          margin-top: 0;
          color: #003c8f;
        }

        .article small {
          color: #666;
          font-size: 12px;
        }

        .article h3 {
          margin-top: 30px;
          border-bottom: 1px dashed #ccc;
          padding-bottom: 4px;
        }

        .article p, .article li {
          line-height: 1.6;
          font-size: 14px;
        }

        /* TOC kanan */
        .toc {
          background: #f2f2f2;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: inset 1px 1px #fff;
          padding: 12px;
          height: fit-content;
        }

        .toc h4 {
          font-size: 14px;
          border-bottom: 1px solid #bbb;
          padding-bottom: 4px;
        }

        .toc li {
          list-style: none;
          font-size: 13px;
          padding: 4px 0;
          cursor: pointer;
        }

        .toc li:hover {
          text-decoration: underline;
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
      <span onClick={() => router.push("/")}>Batch</span>
      <span onClick={() => router.push("/edit")}>Edit</span>
      <span onClick={() => router.push("/nft-layer")}>Nft Layering</span>
      <span style={{ textDecoration: "underline" }} onClick={() => router.push("/faq")}>
        Blog
      </span>
    </div>
  </div>
</div>


      {/* === CONTENT === */}
      <div className="layout">
        {/* Sidebar kiri */}
        <div className="sidebar">
          <h3>Articles</h3>
          <ul>
            {articles.map((a) => (
              <li
                key={a.id}
                className={activeArticle.id === a.id ? "active" : ""}
                onClick={() => setActiveArticle(a)}
              >
                {a.title}
              </li>
            ))}
          </ul>
        </div>

        {/* Artikel */}
        <div className="article" ref={articleRef}>
          <h1>{activeArticle.title}</h1>
          <small>
            {activeArticle.date} • {activeArticle.readTime} • {activeArticle.author}
          </small>
          <div
            dangerouslySetInnerHTML={{
              __html: activeArticle.content
                .replace(/\n/g, "<br/>")
                .replace(/### (.*?)<br\/>/g, "<h3>$1</h3>"),
            }}
          />
        </div>

        {/* Sidebar kanan */}
        <div className="toc">
          <h4>Sections</h4>
          <ul>
            {Array.from(articleRef.current?.querySelectorAll("h3") || []).map((h) => (
              <li
                key={h.id}
                onClick={() =>
                  document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {h.innerText}
              </li>
            ))}
          </ul>
          
        </div>
        
      </div>
      <Footer/>
    </>
    
  );
}