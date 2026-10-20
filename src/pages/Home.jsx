import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import DecryptedText from '../components/ui/DecryptedText';
import Magnet from '../components/ui/Magnet';
import AnimatedContent from '../components/ui/AnimatedContent';
import '../styles/home.css';

/* ─── Data (scalable — add entries here to extend) ─── */
const skills = [
  { icon: 'fa-brands fa-python', label: 'Python' },
  { icon: 'fa-brands fa-js', label: 'JavaScript' },
  { icon: 'fa-solid fa-code', label: 'HTML & CSS' },
  { icon: 'fa-brands fa-git-alt', label: 'Git & GitHub' },
  { icon: 'fa-solid fa-c', label: 'C++' },
  { icon: 'fa-solid fa-cube', label: 'Linux' },
];

const stats = [
  { value: '3+', label: 'Projects shipped' },
  { value: '6', label: 'Technologies' },
  { value: '∞', label: 'Curiosity' },
];

const projects = [
  {
    title: 'TerminalCards',
    tag: 'WebRTC • P2P',
    year: '2025',
    description:
      'A peer-to-peer web messaging app styled as a command-line interface utilizing WebRTC. Doubles as a collaborative coding platform and card-game hub.',
    image: 'images/cards.jpg',
    links: [
      { label: 'Launch', to: '/terminalcards', internal: true },
      { label: 'Source', href: 'https://github.com/ErChoi-com/TerminalCards' },
    ],
  },
  {
    title: 'TerrainSim',
    tag: 'Three.js • WebGL',
    year: '2025',
    description:
      'An interactive terrain simulation engine for the web. Generates dynamic landscapes with real-time procedural environments powered by noise algorithms.',
    image: 'images/terrain.jpg',
    imageClass: 'ed-img--terrain',
    links: [
      { label: 'Explore', to: '/terrain', internal: true },
      { label: 'Source', href: 'https://github.com/ErChoi-com/TerrainSim' },
    ],
  },
  {
    title: 'GitHub Portfolio',
    tag: 'C++ • OpenGL',
    year: 'Ongoing',
    description:
      'A collection of experiments and projects — from OpenGL particle-fluid simulations to web tools and creative coding explorations.',
    image: 'images/simulation-poster.jpg',
    video: 'simulation.mp4',
    links: [
      { label: 'Repositories', href: 'https://github.com/ErChoi-com?tab=repositories' },
    ],
  },
];

/* Marquee reuses the project imagery plus the portrait; repeated so one half always outruns a wide screen */
const marqueeItems = [
  ...projects.map((p) => ({ title: p.title, tag: p.tag, image: p.image, imageClass: p.imageClass, link: p.links[0] })),
  { title: 'Ernest Choi', tag: 'Developer • Engineer', image: 'images/ernestchoipic.jpg', link: { href: '#about', anchor: true } },
];
const marqueeHalf = [...marqueeItems, ...marqueeItems];
const radiusPatterns = ['ed-radius-a', 'ed-radius-b', 'ed-radius-c'];

const navLinks = [
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

const socials = [
  { label: 'GitHub', href: 'https://github.com/ErChoi-com' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/ernestchoi' },
];

const contacts = [
  { label: 'Email', href: 'mailto:ernestljchoi@gmail.com' },
  { label: 'Resume', href: 'https://www.overleaf.com/read/njwfnpbccdzq#ce6706' },
];

const EASE_MAGNET = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';

/* GSAP sets inline transforms, so the CSS reduced-motion rule can't reach it */
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const Reveal = ({ distance, duration, ...props }) => (
  <AnimatedContent distance={REDUCED_MOTION ? 0 : distance} duration={REDUCED_MOTION ? 0.01 : duration} {...props} />
);

/* Looping clip that only plays while on screen; poster only under reduced motion */
function AutoVideo({ src, poster, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true; // React doesn't reliably reflect the muted attribute
    if (REDUCED_MOTION) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play().catch(() => {});
      else el.pause();
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden="true" />;
}

/* ─── Braille title (original) — also renders the live pattern for the "This site" tile ─── */
function BrailleTitle({ className }) {
  const [pattern, setPattern] = useState('⠀⠀⠀⠀⠀⠀');

  useEffect(() => {
    const gridLength = 6;
    const rows = 4;
    const cols = gridLength * 2;
    const grid = [];
    for (let i = 0; i < rows; i++) { grid[i] = []; for (let j = 0; j < cols; j++) grid[i][j] = ''; }
    let filledCount = 0;
    const totalCells = rows * cols;
    const interval = setInterval(() => {
      // Exponential reset chance — negligible early, ramps sharply near full
      const fill = filledCount / totalCells;
      if (filledCount >= totalCells || Math.random() < Math.pow(fill, 2)) {
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) grid[i][j] = '';
        filledCount = 0;
      }
      // Try a bounded number of times to find an empty cell
      for (let attempt = 0; attempt < 50; attempt++) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        if (grid[r][c] !== '*') { grid[r][c] = '*'; filledCount++; break; }
      }
      let seq = '';
      for (let k = 0; k < gridLength; k++) {
        let t = 0;
        const col = k * 2;
        // Standard 8-dot braille (U+2800–U+28FF): all 256 patterns
        if (grid[0][col]     === '*') t |= 1;    // dot 1
        if (grid[1][col]     === '*') t |= 2;    // dot 2
        if (grid[2][col]     === '*') t |= 4;    // dot 3
        if (grid[0][col + 1] === '*') t |= 8;    // dot 4
        if (grid[1][col + 1] === '*') t |= 16;   // dot 5
        if (grid[2][col + 1] === '*') t |= 32;   // dot 6
        if (grid[3][col]     === '*') t |= 64;   // dot 7
        if (grid[3][col + 1] === '*') t |= 128;  // dot 8
        seq += String.fromCharCode(0x2800 + t);
      }
      document.title = seq;
      setPattern(seq);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className={className} aria-hidden="true">{pattern}</span>;
}

/* ─── Difference cursor: lerped follower, fine pointers only ─── */
function DifferenceCursor() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.add('ed-cursor-on');

    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, shown = false;
    const onMove = (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { x = tx; y = ty; shown = true; el.classList.add('is-visible'); }
    };
    const onLeave = () => { shown = false; el.classList.remove('is-visible'); };
    const onOver = (e) => {
      el.classList.toggle('is-hover', !!e.target.closest?.('a, button'));
    };
    const tick = () => {
      const k = reduce ? 1 : 0.18;
      x += (tx - x) * k;
      y += (ty - y) * k;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove('ed-cursor-on');
    };
  }, []);

  return (
    <div ref={ref} className="ed-cursor" aria-hidden="true">
      <span />
    </div>
  );
}

/* Letters slide up from behind a mask, staggered */
function RevealText({ text, baseDelay = 0, step = 45 }) {
  let i = 0;
  return text.split(' ').map((word, w, words) => (
    <React.Fragment key={w}>
      <span className="ed-word">
        {[...word].map((ch) => {
          const delay = baseDelay + step * i++;
          return (
            <span className="ed-char-mask" key={i}>
              <span className="ed-char" style={{ animationDelay: `${delay}ms` }}>{ch}</span>
            </span>
          );
        })}
      </span>
      {w < words.length - 1 ? ' ' : null}
    </React.Fragment>
  ));
}

const LinkOut = ({ link, className, children, onAnchor, tabIndex, ariaLabel }) => {
  const common = { className, tabIndex, 'aria-label': ariaLabel };
  if (link.internal) return <Link to={link.to} {...common}>{children}</Link>;
  if (link.anchor) return <a href={link.href} {...common} onClick={(e) => onAnchor(e, link.href)}>{children}</a>;
  return <a href={link.href} target="_blank" rel="noreferrer" {...common}>{children}</a>;
};

/* ─── Component ─── */
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  /* White page background while Home is mounted */
  useEffect(() => {
    document.body.classList.add('ed-page');
    document.documentElement.classList.remove('ed-boot'); // set pre-render in index.html to avoid a dark flash
    return () => document.body.classList.remove('ed-page');
  }, []);

  /* Pause marquee animation when off-screen to save CPU */
  const marqueeRef = useRef(null);
  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      el.classList.toggle('is-offscreen', !entry.isIntersecting);
    }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Menu: Escape closes, page behind is locked and inert, focus moves in and back out */
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const mainRef = useRef(null);
  const footerRef = useRef(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    if (!menuOpen) {
      if (wasOpen.current) toggleRef.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    // Hiding the scrollbar would shift the page; pad by its width instead
    root.style.setProperty('--ed-sbw', `${window.innerWidth - root.clientWidth}px`);
    document.body.style.overflow = 'hidden';
    [mainRef.current, footerRef.current].forEach((el) => el && (el.inert = true));
    const t = setTimeout(() => menuRef.current?.querySelector('a')?.focus({ preventScroll: true }), 350);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      root.style.removeProperty('--ed-sbw');
      [mainRef.current, footerRef.current].forEach((el) => el && (el.inert = false));
    };
  }, [menuOpen]);

  /* Logo on the home page: close the menu and go back to the top */
  const handleLogo = useCallback((e) => {
    e.preventDefault();
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* In-page anchors must not reach HashRouter (it would route to /work etc.) */
  const handleNav = useCallback((e, href) => {
    e.preventDefault();
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="ed">
      <DifferenceCursor />

      {/* ─── NAV ─── */}
      <header className="ed-header">
        <Link to="/" className="ed-logo" aria-label="Ernest Choi — back to top" onClick={handleLogo}>
          <DecryptedText text="ec" animateOn="hover" speed={40} maxIterations={6} characters="abcdefghijklmnopqrstuvwxyz" />
        </Link>

        <Magnet padding={40} magnetStrength={3} activeTransition={EASE_MAGNET} inactiveTransition={EASE_MAGNET}>
          <button
            ref={toggleRef}
            type="button"
            className={`ed-menu-toggle${menuOpen ? ' is-open' : ''}`}
            aria-expanded={menuOpen}
            aria-controls="ed-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="ed-menu-label">{menuOpen ? 'Close' : 'Menu'}</span>
            <span className="ed-plus" aria-hidden="true" />
          </button>
        </Magnet>
      </header>

      <div id="ed-menu" ref={menuRef} className={`ed-menu${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <nav className="ed-menu-inner" aria-label="Main">
          <ul className="ed-menu-list">
            {navLinks.map((l, i) => (
              <li key={l.label} style={{ transitionDelay: menuOpen ? `${120 + i * 60}ms` : '0ms' }}>
                <a href={l.href} onClick={(e) => handleNav(e, l.href)} tabIndex={menuOpen ? 0 : -1}>
                  <span className="ed-mono">0{i + 1}</span>{l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ed-menu-foot">
            <Link to="/terminalcards" tabIndex={menuOpen ? 0 : -1}>TerminalCards ↗</Link>
            <Link to="/terrain" tabIndex={menuOpen ? 0 : -1}>TerrainSim ↗</Link>
            <a href="https://github.com/ErChoi-com" target="_blank" rel="noreferrer" tabIndex={menuOpen ? 0 : -1}>
              <i className="fab fa-github" /> GitHub
            </a>
            <a href="https://www.overleaf.com/read/njwfnpbccdzq#ce6706" target="_blank" rel="noreferrer" tabIndex={menuOpen ? 0 : -1}>
              <i className="fas fa-file-alt" /> Resume
            </a>
          </div>
        </nav>
      </div>

      <main ref={mainRef}>
        {/* ─── HERO ─── */}
        <section className="ed-hero">
          <p className="ed-mono ed-hero-label">
            <span className="ed-char-mask"><span className="ed-char">Portfolio — {year}</span></span>
          </p>

          <h1 className="ed-hero-title" aria-label="Ernest Choi">
            <span aria-hidden="true"><RevealText text="Ernest Choi" baseDelay={150} /></span>
          </h1>

          <p className="ed-hero-sub">
            <span className="ed-char-mask"><span className="ed-char" style={{ animationDelay: '700ms' }}>Developer &bull; Creator &bull; Engineer</span></span>
          </p>

          <div className="ed-hero-ctas">
            <Link to="/terminalcards" className="ed-btn ed-btn--solid">TerminalCards</Link>
            <Link to="/terrain" className="ed-btn">TerrainSim</Link>
          </div>

          <div className="ed-scroll-indicator" aria-hidden="true">
            <span className="ed-mono">Scroll</span>
            <span className="ed-scroll-line" />
          </div>
        </section>

        {/* ─── INFINITE PROJECT MARQUEE ─── */}
        <section className="ed-marquee" aria-label="Project gallery">
          <div className="ed-marquee-track" ref={marqueeRef}>
            {[0, 1].map((half) => (
              <div className="ed-marquee-half" key={half} aria-hidden={half === 1}>
                {marqueeHalf.map((item, i) => {
                  // Only the first set is reachable by keyboard / screen readers; the rest are visual repeats
                  const primary = half === 0 && i < marqueeItems.length;
                  return (
                  <LinkOut
                    key={`${half}-${i}`}
                    link={item.link}
                    onAnchor={handleNav}
                    tabIndex={primary ? undefined : -1}
                    className={`ed-mcard ${radiusPatterns[(i + Math.floor(i / marqueeItems.length)) % radiusPatterns.length]}`}
                  >
                    <span className="ed-mcard-media">
                      <img src={item.image} alt={primary ? `${item.title} preview` : ''} loading="lazy" className={item.imageClass} />
                    </span>
                    <span className="ed-mcard-caption ed-mono">
                      <span>{item.title}</span>
                      <span>{item.tag}</span>
                    </span>
                  </LinkOut>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ─── ABOUT (centered statement) ─── */}
        <section id="about" className="ed-section ed-intro">
          <Reveal distance={50} duration={1} ease="expo.out">
            <p className="ed-mono ed-section-tag">(Who I Am)</p>
            <h2 className="ed-intro-heading">
              Building creative software from <em>concept</em> to <em>reality</em>.
            </h2>
          </Reveal>

          <Reveal distance={40} duration={1} delay={0.1} ease="expo.out">
            <p className="ed-intro-body">
              I'm <strong>Ernest Choi</strong> — a developer and engineer focused on
              interactive browser simulations, retro-inspired tools, and creative coding experiments.
              From <em>TerrainSim</em>'s procedural landscapes to <em>TerminalCards</em>' P2P messaging,
              I ship projects that merge technical depth with playful design.
            </p>
            <p className="ed-intro-body ed-intro-body--dim">
              My focus is on building technical tools that I can use in my day to day.
            </p>
          </Reveal>

          <Reveal distance={30} duration={1} delay={0.2} ease="expo.out">
            <dl className="ed-stats">
              {stats.map((s) => (
                <div className="ed-stat" key={s.label}>
                  <dt className="ed-mono">{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal distance={30} duration={1} delay={0.25} ease="expo.out">
            <div className="ed-toolbox">
              <span className="ed-mono ed-toolbox-label">Toolbox</span>
              <ul>
                {skills.map((s) => (
                  <li key={s.label}><i className={s.icon} aria-hidden="true" />{s.label}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ─── PROJECT GRID ─── */}
        <section id="work" className="ed-section ed-work">
          <Reveal distance={40} duration={1} ease="expo.out">
            <div className="ed-section-head">
              <h2 className="ed-section-title">Selected work</h2>
              <a href="https://github.com/ErChoi-com?tab=repositories" target="_blank" rel="noreferrer" className="ed-mono ed-underline">
                View all →
              </a>
            </div>
          </Reveal>

          <div className="ed-grid">
            {projects.map((p, idx) => (
              <Reveal key={p.title} distance={60} duration={1} delay={(idx % 2) * 0.1} ease="expo.out">
                <article className="ed-proj">
                  <LinkOut link={p.links[0]} className="ed-proj-media" ariaLabel={`${p.title} — ${p.links[0].label}`}>
                    {p.video ? (
                      <AutoVideo src={p.video} poster={p.image} />
                    ) : (
                      <img src={p.image} alt={`${p.title} preview`} loading="lazy" className={p.imageClass} />
                    )}
                    <span className="ed-proj-overlay" aria-hidden="true" />
                    <span className="ed-proj-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 17L17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  </LinkOut>
                  <div className="ed-proj-meta">
                    <h3>{p.title}</h3>
                    <span className="ed-proj-cat">{p.tag}</span>
                    <span className="ed-mono">{p.year}</span>
                  </div>
                  <p className="ed-proj-desc">{p.description}</p>
                  <div className="ed-proj-links">
                    {p.links.map((link) => (
                      <LinkOut key={link.label} link={link} className="ed-mono ed-underline">
                        {link.label} {link.internal ? '→' : '↗'}
                      </LinkOut>
                    ))}
                  </div>
                </article>
              </Reveal>
            ))}

            {/* This site — the live braille title as its artwork */}
            <Reveal distance={60} duration={1} delay={0.1} ease="expo.out">
              <article className="ed-proj">
                <a href="https://github.com/ErChoi-com/personalwebsite" target="_blank" rel="noreferrer" className="ed-proj-media ed-proj-media--braille" aria-label="This Site — Source">
                  <BrailleTitle className="ed-braille" />
                  <span className="ed-braille-caption ed-mono">Live from this tab's title</span>
                  <span className="ed-proj-overlay" aria-hidden="true" />
                  <span className="ed-proj-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 17L17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                </a>
                <div className="ed-proj-meta">
                  <h3>This Site</h3>
                  <span className="ed-proj-cat">React • Vite</span>
                  <span className="ed-mono">{year}</span>
                </div>
                <p className="ed-proj-desc">
                  The portfolio you're on. The browser tab title is a generative 8-dot braille
                  animation that fills a 4×12 grid and resets more often the fuller it gets.
                </p>
                <div className="ed-proj-links">
                  <a href="https://github.com/ErChoi-com/personalwebsite" target="_blank" rel="noreferrer" className="ed-mono ed-underline">Source ↗</a>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ─── FOOTER / CONTACT ─── */}
      <footer id="contact" className="ed-footer" ref={footerRef}>
        <Reveal distance={50} duration={1} ease="expo.out">
          <div className="ed-footer-cta">
            <p className="ed-mono ed-section-tag ed-section-tag--light">(Get in Touch)</p>
            <h2 className="ed-footer-heading">Let's work<br />together.</h2>
            <p className="ed-footer-sub">Interested in collaborating, hiring, or just chatting about projects?</p>
            <Magnet padding={60} magnetStrength={4} activeTransition={EASE_MAGNET} inactiveTransition={EASE_MAGNET}>
              <a href="mailto:ernestljchoi@gmail.com" className="ed-btn ed-btn--light">
                ernestljchoi@gmail.com <span aria-hidden="true">↗</span>
              </a>
            </Magnet>
          </div>
        </Reveal>

        <div className="ed-footer-grid">
          <div className="ed-footer-brand">
            <DecryptedText text="Ernest Choi" animateOn="view" sequential speed={30} parentClassName="ed-footer-name" />
            <p>
              Developer and engineer building interactive browser simulations,
              retro-inspired tools and creative coding experiments.
            </p>
          </div>

          <div className="ed-footer-col">
            <h4 className="ed-mono">Socials</h4>
            <ul>
              {socials.map((l) => (
                <li key={l.label}><a href={l.href} target="_blank" rel="noreferrer" className="ed-underline">{l.label}</a></li>
              ))}
            </ul>
          </div>

          <div className="ed-footer-col">
            <h4 className="ed-mono">Contact</h4>
            <ul>
              {contacts.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target={l.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer" className="ed-underline">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ed-footer-bar">
          <span>&copy; {year} Ernest Choi</span>
          <span>Built with React + Vite</span>
        </div>
      </footer>
    </div>
  );
}
