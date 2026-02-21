"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type RecipeAnswer = {
  name?: string;
  ingredients?: string[];
  steps?: string[];
};

type ApiResult = {
  transcript?: string;
  answer?: RecipeAnswer;
  error?: string;
};

type AppStatus = "idle" | "listening" | "processing" | "done" | "error";

const EXAMPLE_MENUS = ["ไข่เจียว", "ผัดกะเพรา", "ต้มยำกุ้ง", "แกงเขียวหวาน", "ข้าวผัด", "ส้มตำ"];

export default function Home() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [result, setResult] = useState<ApiResult>({});
  const [interimText, setInterimText] = useState("");
  const [pulseActive, setPulseActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setStatus("error");
      setResult({ error: "เบราว์เซอร์นี้ไม่รองรับ Web Speech API (แนะนำ Chrome)" });
      return;
    }

    const rec = new SR();
    rec.lang = "th-TH";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => { setStatus("listening"); setPulseActive(true); };
    rec.onend = () => setPulseActive(false);
    rec.onerror = (e: any) => {
      setPulseActive(false);
      setStatus("error");
      setResult({ error: `เกิดข้อผิดพลาด: ${e?.error || "speech error"}` });
    };

    rec.onresult = async (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        event.results[i].isFinal
          ? (final += event.results[i][0].transcript)
          : (interim += event.results[i][0].transcript);
      }
      if (interim) setInterimText(interim);
      if (!final) return;

      setInterimText("");
      setStatus("processing");
      setResult({ transcript: final });

      const resp = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: final }),
      });
      const data: ApiResult = await resp.json();
      setResult(data);
      setStatus(data.error ? "error" : "done");
    };

    recognitionRef.current = rec;
  }, []);

  function start() {
    setResult({});
    setInterimText("");
    setStatus("idle");
    try { recognitionRef.current?.start(); } catch { /* already started */ }
  }

  function stop() {
    recognitionRef.current?.stop();
    setStatus("idle");
    setPulseActive(false);
  }

  const isListening = status === "listening";
  const isProcessing = status === "processing";

  return (
    <div className={styles.root}>
      {/* ambient blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={styles.page}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <header className={styles.hero}>
          <span className={styles.heroEmoji}>🍽️</span>
          <h1 className={styles.heroTitle}>AI Cooking Assistant</h1>
          <p className={styles.heroSub}>พูดชื่ออาหาร รับสูตรทันที</p>
        </header>

        {/* ── MIC CARD ─────────────────────────────────────── */}
        <section className={styles.micCard}>
          {/* status pill */}
          <div className={`${styles.pill} ${styles[`pill_${status}`]}`}>
            <span className={`${styles.pillDot} ${isListening ? styles.pillDotActive : ""}`} />
            {status === "idle" && "พร้อมรับคำสั่ง"}
            {status === "listening" && "กำลังฟัง..."}
            {status === "processing" && "กำลังค้นหาสูตร..."}
            {status === "done" && "พบสูตรอาหารแล้ว ✨"}
            {status === "error" && "เกิดข้อผิดพลาด"}
          </div>

          {/* big mic button */}
          <div className={`${styles.micWrap} ${pulseActive ? styles.micWrapActive : ""}`}>
            <button
              id="btn-mic"
              className={`${styles.micBtn} ${isListening ? styles.micBtnOn : ""}`}
              onClick={isListening ? stop : start}
              aria-label={isListening ? "หยุดพูด" : "เริ่มพูด"}
            >
              {isProcessing
                ? <span className={styles.spinner} />
                : <span className={styles.micIcon}>{isListening ? "⏹" : "🎤"}</span>
              }
            </button>
          </div>

          {/* interim text */}
          {interimText && (
            <p className={styles.interim}>
              &ldquo;{interimText}<span className={styles.cursor} />&rdquo;
            </p>
          )}

          {/* control buttons */}
          <div className={styles.btnRow}>
            <button id="btn-start" className={`${styles.btn} ${styles.btnGreen}`} onClick={start} disabled={isListening}>
              <span>🎤</span> เริ่มพูด
            </button>
            <button id="btn-stop" className={`${styles.btn} ${styles.btnRed}`} onClick={stop} disabled={!isListening && !isProcessing}>
              <span>⏹</span> หยุด
            </button>
          </div>
        </section>

        {/* ── RESULT ───────────────────────────────────────── */}
        {(result.transcript || result.answer || result.error) && (
          <section className={styles.resultArea}>

            {/* what user said */}
            {result.transcript && (
              <div className={styles.glassCard} id="card-transcript">
                <p className={styles.glassLabel}>� ที่คุณพูด</p>
                <p className={styles.glassValue}>&ldquo;{result.transcript}&rdquo;</p>
              </div>
            )}

            {/* error */}
            {result.error && (
              <div className={`${styles.glassCard} ${styles.glassCardErr}`} id="card-error">
                <p className={styles.glassLabel}>⚠️ ข้อผิดพลาด</p>
                <p className={styles.glassValue}>{result.error}</p>
              </div>
            )}

            {/* recipe */}
            {result.answer && !result.error && (
              <div className={styles.recipeCard} id="card-recipe">

                {/* name banner */}
                <div className={styles.recipeBanner}>
                  <span className={styles.recipeBannerIcon}>🍳</span>
                  <h2 className={styles.recipeName}>{result.answer.name}</h2>
                </div>

                <div className={styles.recipeBody}>
                  {/* ingredients */}
                  {result.answer.ingredients && result.answer.ingredients.length > 0 && (
                    <div className={styles.recipeSection}>
                      <h3 className={styles.sectionTitle}>🧺 วัตถุดิบ</h3>
                      <div className={styles.tagGrid}>
                        {result.answer.ingredients.map((item, i) => (
                          <span key={i} className={styles.tag}>{item}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* divider */}
                  {result.answer.ingredients?.length && result.answer.steps?.length
                    ? <div className={styles.divider} /> : null}

                  {/* steps */}
                  {result.answer.steps && result.answer.steps.length > 0 && (
                    <div className={styles.recipeSection}>
                      <h3 className={styles.sectionTitle}>📋 วิธีทำ</h3>
                      <ol className={styles.stepList}>
                        {result.answer.steps.map((step, i) => (
                          <li key={i} className={styles.stepItem}>
                            <span className={styles.stepNum}>{i + 1}</span>
                            <span className={styles.stepText}>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── HINTS ────────────────────────────────────────── */}
        {status === "idle" && !result.transcript && (
          <div className={styles.hints}>
            <p className={styles.hintsLabel}>💡 ลองพูดว่า...</p>
            <div className={styles.hintRow}>
              {EXAMPLE_MENUS.map((m) => (
                <span key={m} className={styles.hintChip}>{m}</span>
              ))}
            </div>
          </div>
        )}

        <footer className={styles.footer}>
          Powered by Web Speech API · Next.js · n8n
        </footer>
      </div>
    </div>
  );
}
