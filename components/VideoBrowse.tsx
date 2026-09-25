"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoSource } from "@/lib/video/types";
import { formatDuration } from "@/lib/video/catalog";
import { ROWS, FEATURED_ID } from "@/lib/video/rows";

/**
 * トップ画面。
 *
 *   ヘッダー（動画を探す） → ヒーロー → 横スクロールの行 → 拡大表示 → 再生
 *
 * 動画をクリックすると拡大表示になり、そこでもう一度クリックすると再生が始まる
 * （2段階）。配信先（R2 / Vimeo / Mux）はサーバー側で解決済みなので、
 * このコンポーネントは kind と src しか見ない。
 */
export function VideoBrowse({ videos }: { videos: VideoSource[] }) {
  const byId = useMemo(
    () => new Map(videos.map((v) => [v.id, v])),
    [videos]
  );

  const featured = byId.get(FEATURED_ID) ?? videos[0];
  const rows = useMemo(
    () =>
      ROWS.map((r) => ({
        ...r,
        items: r.ids.map((id) => byId.get(id)).filter((v): v is VideoSource => !!v),
      })).filter((r) => r.items.length > 0),
    [byId]
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = openId ? byId.get(openId) ?? null : null;

  const close = useCallback(() => {
    setOpenId(null);
    setPlaying(false);
  }, []);

  // ヘッダーはスクロールすると背景がつく（Netflix と同じ挙動）
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc で閉じる／開いている間は背面をスクロールさせない
  useEffect(() => {
    const modal = openId || searchOpen;
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openId) close();
      else setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (openId ? closeRef : searchRef).current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId, searchOpen, close]);

  const start = () => {
    const v = videoRef.current;
    setPlaying(true);
    if (v) {
      v.currentTime = 0;
      void v.play();
    }
    // 視聴の記録。失敗しても再生は止めない
    if (current) {
      void fetch("/api/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId: current.id }),
        keepalive: true,
      }).catch(() => {});
    }
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchRef.current?.focus(), 40);
  };

  const results = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return videos;
    return videos.filter((v) => v.title.toLowerCase().includes(key));
  }, [q, videos]);

  return (
    <>
      {/* ── 最上段の注意書き ───────────────────────── */}
      <div className="topbar">
        一般向けの教育動画です。個別の診療・診断・処方を行うものではありません。
      </div>

      {/* ── ヘッダー ─────────────────────────────── */}
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="nav-inner">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">▮</span>
            <span className="brand-text">
              <em>glp1.diet</em>
            </span>
          </a>

          <nav className="nav-links" aria-label="メインメニュー">
            <a className="is-current" href="/">ホーム</a>
            <button type="button" onClick={openSearch}>動画を探す</button>
          </nav>

          <div className="nav-right">
            <button
              type="button"
              className="icon-btn"
              onClick={openSearch}
              aria-label="動画を探す"
            >
              ⌕
            </button>
            <span className="nav-count">{videos.length}本</span>
          </div>
        </div>
      </header>

      {/* ── ヒーロー ─────────────────────────────── */}
      {featured && (
        <section className="hero">
          <div className="hero-art" aria-hidden="true">
            {featured.poster && <img src={featured.poster} alt="" />}
          </div>
          <div className="hero-body">
            <span className="badge">注目の動画</span>
            <p className="hero-kicker">
              はじめての方へ ・ {formatDuration(featured.durationSec)}
            </p>
            <h1 className="hero-title">{featured.title}</h1>
            <p className="hero-desc">
              治療をはじめる前に、いちばん多く聞かれる疑問から。
              少ない用量から始める医学的な理由を解説します。
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => setOpenId(featured.id)}
              >
                ▶ 再生
              </button>
              <button type="button" className="btn btn-ghost" onClick={openSearch}>
                動画を探す
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 横スクロールの行 ─────────────────────── */}
      <div className="rows">
        {rows.map((row) => (
          <RowStrip
            key={row.title}
            eyebrow={row.eyebrow}
            title={row.title}
            note={row.note}
            items={row.items}
            onPick={setOpenId}
          />
        ))}
        <RowStrip
          eyebrow="ALL VIDEOS"
          title="すべての動画"
          note={`${videos.length}本`}
          items={videos}
          onPick={setOpenId}
        />
      </div>

      <footer className="foot">
        <p>
          本サイトの動画は一般向けの教育情報です。診療・治療の判断は主治医にご相談ください。
        </p>
      </footer>

      {/* ── 動画を探す ───────────────────────────── */}
      {searchOpen && (
        <div className="overlay search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-panel" onClick={(e) => e.stopPropagation()}>
            <div className="search-bar">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="タイトルで検索（例：用量、副作用、旅行）"
                aria-label="動画を検索"
              />
              <button
                type="button"
                className="modal-close"
                onClick={() => setSearchOpen(false)}
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <p className="search-count">{results.length}本</p>
            <ul className="search-grid">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="card"
                    onClick={() => {
                      setSearchOpen(false);
                      setOpenId(v.id);
                    }}
                  >
                    <span className="card-thumb">
                      {v.poster && <img src={v.poster} alt="" loading="lazy" />}
                      <span className="card-play">▶</span>
                    </span>
                    <span className="card-title">{v.title}</span>
                    <span className="card-meta">{formatDuration(v.durationSec)}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="search-empty">
                  該当する動画がありません。別の言葉でお試しください。
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* ── 拡大表示 → 再生 ─────────────────────── */}
      {current && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          onClick={close}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="stage">
              {current.kind === "embed" ? (
                <iframe
                  src={current.src}
                  title={current.title}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={current.src}
                    poster={current.poster}
                    controls={playing}
                    playsInline
                    preload="metadata"
                    onEnded={() => {
                      setPlaying(false);
                      const v = videoRef.current;
                      void fetch("/api/views", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          videoId: current.id,
                          secondsWatched: Math.round(v?.duration ?? 0),
                          completed: true,
                        }),
                        keepalive: true,
                      }).catch(() => {});
                    }}
                  />
                  {!playing && (
                    <button
                      type="button"
                      className="stage-play"
                      onClick={start}
                      aria-label={current.title + " を再生"}
                    >
                      <span className="stage-play-icon">▶</span>
                      <span className="stage-play-label">クリックで再生</span>
                    </button>
                  )}
                </>
              )}
              <button
                ref={closeRef}
                type="button"
                className="modal-close stage-close"
                onClick={close}
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <h2 className="modal-title">{current.title}</h2>
              <p className="modal-meta">
                {formatDuration(current.durationSec)} ・ 配信元{" "}
                <code>{current.provider}</code>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 横スクロールする1行 */
function RowStrip({
  eyebrow,
  title,
  note,
  items,
  onPick,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  items: VideoSource[];
  onPick: (id: string) => void;
}) {
  const trackRef = useRef<HTMLUListElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section className="row">
      <div className="row-head">
        <div>
          <p className="row-eyebrow">{eyebrow}</p>
          <h2 className="row-title">{title}</h2>
          {note && <p className="row-note">{note}</p>}
        </div>
        <div className="row-arrows">
          <button type="button" onClick={() => scrollBy(-1)} aria-label="前へ">‹</button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="次へ">›</button>
        </div>
      </div>

      <ul className="track" ref={trackRef}>
        {items.map((v) => (
          <li key={v.id}>
            <button type="button" className="card" onClick={() => onPick(v.id)}>
              <span className="card-thumb">
                {v.poster && <img src={v.poster} alt="" loading="lazy" decoding="async" />}
                <span className="card-play">▶</span>
                <span className="card-dur">{formatDuration(v.durationSec)}</span>
              </span>
              <span className="card-title">{v.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
