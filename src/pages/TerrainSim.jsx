import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/terrain.css';

export default function TerrainSim() {
  const canvasContainerRef = useRef(null);
  const counterRef = useRef(null);
  const appRef = useRef(null);

  const [texture, setTexture] = useState('gaussian');
  const [param1, setParam1] = useState(0);
  const [param2, setParam2] = useState(0);
  const [param3, setParam3] = useState(0);

  // Initialise Three.js engine on mount
  useEffect(() => {
    let disposed = false;

    async function init() {
      // Dynamic import so three.js tree-shakes and we avoid SSR issues
      const { baseWorld } = await import('../terrain/engine.js');
      if (disposed) return;
      appRef.current = new baseWorld(canvasContainerRef.current, counterRef.current);
    }

    init();

    return () => {
      disposed = true;
      if (appRef.current) {
        appRef.current.dispose();
        appRef.current = null;
      }
    };
  }, []);

  const handleGenerate = () => {
    if (!appRef.current) return;
    const size = Number(param1);
    const tileCount = Number(param2);
    const spare = Number(param3);
    appRef.current.generate(texture, size, tileCount, spare);
  };

  const handleClear = () => {
    if (!appRef.current) return;
    appRef.current.clearScene();
  };

  return (
    <div className="terrain-page">
      <div className="terrain-controls">
        <Link to="/" className="back-link">&larr; Home</Link>
        <h1>Terrain Generation</h1>

        <select value={texture} onChange={(e) => setTexture(e.target.value)}>
          <option value="gaussian">Noise</option>
          <option value="perlin">Perlin</option>
          <option value="waves">Waves</option>
          <option value="circle">Circle</option>
        </select>

        <div className="slider-group">
          <div className="slider-container">
            <label>Parameter 1: {param1}</label>
            <input type="range" min="0" max="130" value={param1} onChange={(e) => setParam1(e.target.value)} />
          </div>
          <div className="slider-container">
            <label>Parameter 2: {param2}</label>
            <input type="range" min="0" max="130" value={param2} onChange={(e) => setParam2(e.target.value)} />
          </div>
          <div className="slider-container">
            <label>Parameter 3: {param3}</label>
            <input type="range" min="0" max="130" value={param3} onChange={(e) => setParam3(e.target.value)} />
          </div>
        </div>

        <div className="btn-group">
          <button onClick={handleGenerate}>Generate</button>
          <button className="secondary" onClick={handleClear}>Clear</button>
        </div>

        <div className="terrain-fps">
          FPS: <span ref={counterRef}>0</span>
        </div>
      </div>

      <div className="terrain-canvas-container" ref={canvasContainerRef}></div>
    </div>
  );
}
