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

const EXAMPLE_MENUS = [
  { label: "ไข่เจียว", emoji: "🍳" },
  { label: "ผัดกะเพรา", emoji: "🌿" },
  { label: "ต้มยำกุ้ง", emoji: "🦐" },
  { label: "แกงเขียวหวาน", emoji: "🍛" },
  { label: "ข้าวผัด", emoji: "🍚" },
  { label: "ส้มตำ", emoji: "🥗" },
];

export default function Home() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [result, setResult] = useState<ApiResult>({});
  const [interimText, setInterimText] = useState("");
  const [pulseActive, setPulseActive] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const recognitionRef = useRef<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      await submitQuery(final);
    };

    recognitionRef.current = rec;
  }, []);

  async function submitQuery(text: string) {
    const resp = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data: ApiResult = await resp.json();
    setResult(data);
    setStatus(data.error ? "error" : "done");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }

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

  async function handleChipClick(menuName: string) {
    setResult({ transcript: menuName });
    setInterimText("");
    setStatus("processing");
    try {
      await submitQuery(menuName);
    } catch {
      setResult({ error: "ไม่สามารถเชื่อมต่อได้" });
      setStatus("error");
    }
  }

  const isListening = status === "listening";
  const isProcessing = status === "processing";

  return (
    <div className={styles.root}>

      {/* ── NAVBAR ── */}
      <nav className={`${styles.nav} ${navScrolled ? styles.navScrolled : ""}`}>
        <div className={styles.navInner}>
          <a href="/" className={styles.navLogo}>
            <span className={styles.navLogoIcon}>🍽️</span>
            <span className={styles.navLogoText}>ChefAI</span>
          </a>
          <div className={styles.navLinks}>
            <a href="#how" className={styles.navLink}>วิธีใช้</a>
            <a href="#menus" className={styles.navLink}>เมนูแนะนำ</a>
            <a href="#try" className={styles.navCta}>ลองใช้เลย</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero} id="try">
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            AI-Powered · Web Speech API
          </div>
          <h1 className={styles.heroTitle}>
            ค้นหาสูตรอาหาร<br />
            <span className={styles.heroHighlight}>ด้วยเสียงของคุณ</span>
          </h1>
          <p className={styles.heroDesc}>
            แค่พูดชื่ออาหาร AI จะค้นหาวัตถุดิบและขั้นตอนการทำให้ทันที
            รองรับภาษาไทย ไม่ต้องพิมพ์แม้แต่คำเดียว
          </p>

          <div className={styles.heroFeatures}>
            <div className={styles.heroFeature}>
              <span>🎙️</span>
              <span>พูดแล้วได้เลย</span>
            </div>
            <div className={styles.heroFeature}>
              <span>⚡</span>
              <span>ผลลัพธ์ทันที</span>
            </div>
            <div className={styles.heroFeature}>
              <span>🍳</span>
              <span>100+ สูตรอาหาร</span>
            </div>
          </div>
        </div>

        {/* Mic Panel */}
        <div className={styles.micPanel}>
          <div className={styles.micPanelInner}>
            <div className={`${styles.pill} ${styles[`pill_${status}`]}`}>
              <span className={`${styles.pillDot} ${isListening ? styles.pillDotActive : ""}`} />
              {status === "idle" && "พร้อมรับคำสั่ง"}
              {status === "listening" && "กำลังฟัง..."}
              {status === "processing" && "กำลังค้นหาสูตร..."}
              {status === "done" && "พบสูตรอาหารแล้ว ✨"}
              {status === "error" && "เกิดข้อผิดพลาด"}
            </div>

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

            <p className={styles.micHint}>
              {isListening ? "พูดชื่ออาหารที่ต้องการได้เลย" : "กดปุ่มเพื่อเริ่มพูด"}
            </p>

            {interimText && (
              <p className={styles.interim}>
                &ldquo;{interimText}<span className={styles.cursor} />&rdquo;
              </p>
            )}

            <div className={styles.btnRow}>
              <button id="btn-start" className={`${styles.btn} ${styles.btnGreen}`} onClick={start} disabled={isListening}>
                <span>🎤</span> เริ่มพูด
              </button>
              <button id="btn-stop" className={`${styles.btn} ${styles.btnOutline}`} onClick={stop} disabled={!isListening && !isProcessing}>
                <span>⏹</span> หยุด
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK PICKS ── */}
      <section className={styles.quickSection} id="menus">
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>เมนูยอดนิยม</h2>
            <p className={styles.sectionDesc}>คลิกเพื่อค้นหาสูตรทันที ไม่ต้องพูด</p>
          </div>
          <div className={styles.menuGrid}>
            {EXAMPLE_MENUS.map((m) => (
              <button
                key={m.label}
                className={styles.menuCard}
                onClick={() => handleChipClick(m.label)}
                disabled={isProcessing}
                aria-label={`ค้นหาสูตร ${m.label}`}
              >
                <span className={styles.menuEmoji}>{m.emoji}</span>
                <span className={styles.menuLabel}>{m.label}</span>
                <span className={styles.menuArrow}>→</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULT ── */}
      {(result.transcript || result.answer || result.error) && (
        <section className={styles.resultSection} ref={resultRef}>
          <div className={styles.sectionWrap}>

            {result.transcript && (
              <div className={styles.queryBanner}>
                <span className={styles.queryIcon}>🔍</span>
                <div>
                  <p className={styles.queryLabel}>กำลังแสดงสูตร</p>
                  <p className={styles.queryText}>&ldquo;{result.transcript}&rdquo;</p>
                </div>
              </div>
            )}

            {result.error && (
              <div className={styles.errorBanner}>
                <span>⚠️</span>
                <p>{result.error}</p>
              </div>
            )}

            {result.answer && !result.error && (
              <div className={styles.recipeLayout}>

                {/* Left: info */}
                <div className={styles.recipeMain}>
                  <div className={styles.recipeHeader}>
                    <span className={styles.recipeHeaderIcon}>🍳</span>
                    <div>
                      <p className={styles.recipeCategory}>สูตรอาหาร</p>
                      <h2 className={styles.recipeName}>{result.answer.name}</h2>
                    </div>
                  </div>

                  {result.answer.steps && result.answer.steps.length > 0 && (
                    <div className={styles.stepsSection}>
                      <h3 className={styles.recipeSubTitle}>
                        <span className={styles.recipeSubIcon}>📋</span>
                        วิธีทำ
                      </h3>
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

                {/* Right: sidebar ingredients */}
                {result.answer.ingredients && result.answer.ingredients.length > 0 && (
                  <aside className={styles.recipeSidebar}>
                    <div className={styles.sidebarCard}>
                      <h3 className={styles.sidebarTitle}>
                        <span>🧺</span> วัตถุดิบ
                      </h3>
                      <ul className={styles.ingredientList}>
                        {result.answer.ingredients.map((item, i) => (
                          <li key={i} className={styles.ingredientItem}>
                            <span className={styles.ingredientDot} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.sidebarCard} style={{ marginTop: "1rem" }}>
                      <p className={styles.sidebarNote}>💡 เคล็ดลับ</p>
                      <p className={styles.sidebarNoteText}>เตรียมวัตถุดิบให้ครบก่อนเริ่มทำอาหาร จะช่วยให้ทำได้เร็วขึ้น</p>
                    </div>

                    <button
                      className={styles.tryAnother}
                      onClick={() => { setResult({}); setStatus("idle"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      ค้นหาเมนูอื่น →
                    </button>
                  </aside>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className={styles.howSection} id="how">
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>วิธีใช้งาน</h2>
            <p className={styles.sectionDesc}>ง่ายแค่ 3 ขั้นตอน</p>
          </div>
          <div className={styles.howGrid}>
            {[
              { step: "01", icon: "🎤", title: "กดปุ่มไมค์", desc: "กดปุ่มสีส้มด้านบน แล้วรอให้ระบบพร้อมรับเสียง" },
              { step: "02", icon: "🗣️", title: "พูดชื่ออาหาร", desc: "พูดชื่ออาหารไทยที่ต้องการ เช่น ต้มยำกุ้ง หรือ ผัดกะเพรา" },
              { step: "03", icon: "✨", title: "รับสูตรทันที", desc: "ระบบจะค้นหาวัตถุดิบและวิธีทำให้ทันที พร้อมใช้งาน" },
            ].map((h) => (
              <div key={h.step} className={styles.howCard}>
                <span className={styles.howStep}>{h.step}</span>
                <span className={styles.howIcon}>{h.icon}</span>
                <h3 className={styles.howTitle}>{h.title}</h3>
                <p className={styles.howDesc}>{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <span>🍽️</span>
            <span>ChefAI</span>
          </div>
          <p className={styles.footerDesc}>AI Cooking Assistant — พูดชื่ออาหาร รับสูตรทันที</p>
          <div className={styles.footerLinks}>
            <span>Powered by Web Speech API</span>
            <span className={styles.footerDot}>·</span>
            <span>Next.js</span>
            <span className={styles.footerDot}>·</span>
            <span>n8n</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
