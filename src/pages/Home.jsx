import React, { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import BlurText from '../components/ui/BlurText';
import DecryptedText from '../components/ui/DecryptedText';
import ShinyText from '../components/ui/ShinyText';
import GradientText from '../components/ui/GradientText';
import Magnet from '../components/ui/Magnet';
import AnimatedContent from '../components/ui/AnimatedContent';
import SpotlightCard from '../components/ui/SpotlightCard';
import CardSwap, { Card } from '../components/ui/CardSwap';
import ClickSpark from '../components/ui/ClickSpark';

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
    title: 'GitHub Portfolio',
    tag: 'C++ • OpenGL',
    description:
      'A collection of experiments and projects — from OpenGL particle-fluid simulations to web tools and creative coding explorations.',
    image: 'simulation-video.gif',
    links: [
      { label: 'Repositories', href: 'https://github.com/ErChoi-com?tab=repositories' },
    ],
  },
  {
    title: 'TerminalCards',
    tag: 'WebRTC • P2P',
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
    description:
      'An interactive terrain simulation engine for the web. Generates dynamic landscapes with real-time procedural environments powered by noise algorithms.',
    image: 'images/terrain.jpg',
    links: [
      { label: 'Explore', to: '/terrain', internal: true },
      { label: 'Source', href: 'https://github.com/ErChoi-com/TerrainSim' },
    ],
  },
];

const navLinks = [
  { label: 'Work', href: '#projects' },
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Contact', href: '#contact' },
];

const footerCols = [
  {
    heading: 'Projects',
    links: [
      { label: 'TerminalCards', to: '/terminalcards', internal: true },
      { label: 'TerrainSim', to: '/terrain', internal: true },
      { label: 'Repositories', href: 'https://github.com/ErChoi-com?tab=repositories' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'GitHub', href: 'https://github.com/ErChoi-com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/ernestchoi' },
      { label: 'Email', href: 'mailto:ernestljchoi@gmail.com' },
    ],
  },
  {
    heading: 'Info',
    links: [
      { label: 'Resume', href: 'https://www.overleaf.com/read/njwfnpbccdzq#ce6706' },
    ],
  },
];

/* ─── Component ─── */
export default function Home() {
  /* braille title animation (original) */
  useEffect(() => {
    const gridLength = 3;
    const rows = 4;
    const cols = gridLength * 2;
    const grid = [];
    for (let i = 0; i < rows; i++) { grid[i] = []; for (let j = 0; j < cols; j++) grid[i][j] = ''; }
    let filledCount = 0;
    const totalCells = rows * cols;
    const interval = setInterval(() => {
      if (filledCount >= totalCells) {
        // Reset grid once all cells are filled
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
        for (let n = 0; n < 2; n++) for (let l = 0; l < 3; l++) if (grid[l][n + k] === '*') t += Math.pow(2, l + n);
        if (grid[3][k] === '*') t += 64;
        if (grid[3][k + 1] === '*') t += 128;
        const hex = '0123456789ABCDEF';
        seq += String.fromCharCode(0x2800 + parseInt(hex.charAt(Math.floor(t / 16)) + hex.charAt(t % 16), 16));
      }
      document.title = seq;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /* Pause marquee animation when off-screen to save CPU */
  const marqueeRef = useRef(null);
  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      el.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
    }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleNav = useCallback((e, href) => {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const rest = projects;

  const handleCardClick = useCallback((idx) => {
    const p = projects[idx];
    if (!p) return;
    const link = p.links[0];
    if (link.internal) {
      window.location.hash = `#${link.to}`;
    } else if (link.href) {
      window.open(link.href, '_blank');
    }
  }, []);

  return (
    <ClickSpark sparkColor="#a855f7" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
      <div className="site-wrapper">
        {/* ─── NAV ─── */}
        <header className="site-header">
          <nav className="nav">
            <Link to="/" className="nav-logo">
              <DecryptedText text="EC" animateOn="hover" speed={40} maxIterations={6} className="nav-logo-text" encryptedClassName="nav-logo-text encrypted" />
            </Link>

            <ul className="nav-menu">
              {navLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} onClick={(e) => handleNav(e, l.href)} className="nav-link">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="nav-actions">
              <Magnet padding={40} magnetStrength={3}>
                <a href="https://github.com/ErChoi-com" target="_blank" rel="noreferrer" className="nav-icon-link" aria-label="GitHub">
                  <i className="fab fa-github"></i>
                </a>
              </Magnet>
              <Magnet padding={40} magnetStrength={3}>
                <a href="https://www.overleaf.com/read/njwfnpbccdzq#ce6706" target="_blank" rel="noreferrer" className="nav-icon-link" aria-label="Resume">
                  <i className="fas fa-file-alt"></i>
                </a>
              </Magnet>
            </div>
          </nav>
        </header>

        {/* ─── HERO ─── */}
        <section className="hero">
          <div className="hero-inner">
            <p className="hero-label">
              <ShinyText text="Portfolio — 2025" speed={4} className="hero-label-shiny" />
            </p>

            <h1 className="hero-title">
              <BlurText text="Ernest" delay={100} className="hero-title-word" animateBy="letters" direction="top" stepDuration={0.35} />
              <br />
              <BlurText text="Choi" delay={100} className="hero-title-word" animateBy="letters" direction="top" stepDuration={0.35} />
            </h1>

            <p className="hero-subtitle">
              <GradientText colors={['#6366f1', '#a855f7', '#ec4899', '#06b6d4', '#6366f1']} animationSpeed={6}>
                Developer &bull; Creator &bull; Engineer
              </GradientText>
            </p>

            <div className="hero-ctas">
              <Magnet padding={60} magnetStrength={2}>
                <Link to="/terminalcards" className="btn btn-primary">TerminalCards</Link>
              </Magnet>
              <Magnet padding={60} magnetStrength={2}>
                <Link to="/terrain" className="btn btn-outline">TerrainSim</Link>
              </Magnet>
            </div>
          </div>

          <div className="hero-scroll-indicator">
            <span>Scroll</span>
            <div className="hero-scroll-line" />
          </div>
        </section>

        {/* ─── PROJECTS (CardSwap) ─── */}
        <section id="projects" className="section section-projects-swap">
          <AnimatedContent distance={50} duration={0.8}>
            <div className="section-divider">
              <span className="section-tag">Projects</span>
              <span className="divider-line" />
              <span className="section-action">
                <a href="https://github.com/ErChoi-com?tab=repositories" target="_blank" rel="noreferrer">
                  View All &rarr;
                </a>
              </span>
            </div>
          </AnimatedContent>

          <div className="card-swap-wrapper">
            <CardSwap
              width={420}
              height={520}
              cardDistance={50}
              verticalDistance={55}
              delay={800}
              pauseOnHover={true}
              easing="elastic"
              skewAmount={4}
              onCardClick={handleCardClick}
            >
              {rest.map((p) => (
                <Card key={p.title} customClass="project-swap-card">
                  <div className="project-swap-image">
                    <img src={p.image} alt={`${p.title} preview`} loading="lazy" />
                  </div>
                  <div className="project-swap-body">
                    <span className="project-swap-tag">{p.tag}</span>
                    <h3 className="project-swap-title">{p.title}</h3>
                    <p className="project-swap-desc">{p.description}</p>
                    <div className="project-swap-links">
                      {p.links.map((link) =>
                        link.internal ? (
                          <Link key={link.label} to={link.to} className="btn btn-sm btn-primary">{link.label}</Link>
                        ) : (
                          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">{link.label} &rarr;</a>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </CardSwap>
          </div>
        </section>

        {/* ─── ABOUT ─── */}
        <section id="about" className="section section-about">
          <AnimatedContent distance={50} duration={0.8}>
            <div className="section-divider">
              <span className="section-tag">Who I Am</span>
              <span className="divider-line" />
            </div>
          </AnimatedContent>

          <div className="about-grid">
            <AnimatedContent distance={60} direction="horizontal" reverse duration={0.9}>
              <div className="about-image-wrapper">
                <img src="images/ernestchoipic.jpg" alt="Ernest Choi" loading="lazy" />
              </div>
            </AnimatedContent>

            <AnimatedContent distance={60} direction="horizontal" duration={0.9} delay={0.15}>
              <div className="about-content">
                <h2 className="about-heading">
                  Building creative software<br />
                  from <em>concept</em> to <em>reality</em>.
                </h2>
                <p>
                  I'm <strong>Ernest Choi</strong> — a developer and engineer focused on
                  interactive browser simulations, retro-inspired tools, and creative coding experiments.
                  From <em>TerrainSim</em>'s procedural landscapes to <em>TerminalCards</em>' P2P messaging,
                  I ship projects that merge technical depth with playful design.
                </p>
                <p>My focus is on building technical tools that I can use in my day to day.</p>
              </div>
            </AnimatedContent>
          </div>

          {/* Stats row */}
          <AnimatedContent distance={40} delay={0.25} duration={0.7}>
            <div className="stats-row">
              {stats.map((s) => (
                <div className="stat" key={s.label}>
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </AnimatedContent>
        </section>

        {/* ─── SKILLS ─── */}
        <section id="skills" className="section section-skills">
          <AnimatedContent distance={50} duration={0.8}>
            <div className="section-divider">
              <span className="section-tag">Toolbox</span>
              <span className="divider-line" />
            </div>
          </AnimatedContent>

          {/* Infinite marquee ticker (awwwards-style) */}
          <div className="marquee-wrapper">
            <div className="marquee-track" ref={marqueeRef}>
              {[...skills, ...skills, ...skills].map((s, i) => (
                <Magnet key={`${s.label}-${i}`} padding={30} magnetStrength={3}>
                  <span className="skill-pill">
                    <i className={s.icon}></i>
                    {s.label}
                  </span>
                </Magnet>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CONTACT (bold CTA like awwwards) ─── */}
        <section id="contact" className="section section-contact">
          <AnimatedContent distance={50} duration={0.8}>
            <div className="section-divider">
              <span className="section-tag">Get in Touch</span>
              <span className="divider-line" />
            </div>
          </AnimatedContent>

          <div className="contact-cta">
            <AnimatedContent distance={60} duration={0.9}>
              <h2 className="contact-heading">
                Let's work<br />together.
              </h2>
            </AnimatedContent>

            <AnimatedContent distance={40} delay={0.15} duration={0.7}>
              <p className="contact-subtitle">
                Interested in collaborating, hiring, or just chatting about projects?
              </p>
            </AnimatedContent>

            <div className="contact-links">
              {[
                { href: 'mailto:ernestljchoi@gmail.com', icon: 'fa-solid fa-envelope', label: 'Email' },
                { href: 'https://github.com/ErChoi-com', icon: 'fab fa-github', label: 'GitHub' },
                { href: 'https://linkedin.com/in/ernestchoi', icon: 'fab fa-linkedin', label: 'LinkedIn' },
              ].map((c, idx) => (
                <AnimatedContent key={c.label} distance={30} delay={0.25 + idx * 0.08} duration={0.6}>
                  <Magnet padding={50} magnetStrength={2}>
                    <a href={c.href} target={c.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer" className="contact-link">
                      <i className={c.icon}></i>
                      <span>{c.label}</span>
                      <i className="fa-solid fa-arrow-right contact-link-arrow"></i>
                    </a>
                  </Magnet>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FOOTER (multi-column like awwwards) ─── */}
        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <DecryptedText text="Ernest Choi" animateOn="view" sequential speed={30} className="footer-logo-text" encryptedClassName="footer-logo-text encrypted" />
              <span className="footer-copy">&copy; {new Date().getFullYear()}</span>
            </div>

            <div className="footer-columns">
              {footerCols.map((col) => (
                <div className="footer-col" key={col.heading}>
                  <h4 className="footer-col-heading">{col.heading}</h4>
                  <ul>
                    {col.links.map((l) => (
                      <li key={l.label}>
                        {l.internal ? (
                          <Link to={l.to} className="footer-link">{l.label}</Link>
                        ) : (
                          <a href={l.href} target="_blank" rel="noreferrer" className="footer-link">{l.label}</a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </ClickSpark>
  );
}
