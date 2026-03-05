import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

// Code-split heavy routes — Three.js (~500 KB) and PeerJS only load when needed
const TerminalCards = lazy(() => import('./pages/TerminalCards'));
const TerrainSim = lazy(() => import('./pages/TerrainSim'));

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontSize: '0.9rem' }}>
    Loading…
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/terminalcards" element={<TerminalCards />} />
        <Route path="/terrain" element={<TerrainSim />} />
      </Routes>
    </Suspense>
  );
}
