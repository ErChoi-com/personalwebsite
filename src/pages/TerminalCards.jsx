import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  gamelogic,
  isGameCommand,
  processGameCommand,
  publishTables,
  removePlayer,
  resetGame,
} from '../terminalcards/gamelogic';
import { renderLine, SUIT_GLYPH } from '../terminalcards/renderLine';
import CrtBackdrop from '../terminalcards/CrtBackdrop';
import { createStageGestures } from '../terminalcards/stageGestures';
import { useMusic } from '../terminalcards/useMusic';
import '../styles/terminal.css';

/*
  This component wraps the original interaction.js logic.
  The original DOM-based code is adapted to use React refs,
  but the core networking / game logic is kept nearly identical.
  The terminal is the main way to play: the table panel's buttons
  type the same commands a player could type themselves.
*/

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const SUITS = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];

// Shared mutable state (lives outside React render cycle, like the original globals)
const state = {
  peer: null,
  conn: null,
  savedUser: null,
  savedRoom: null,
  hostOrUser: '',
  inRoom: false,
  pyodide: null,
  connections: {},
  usernames: {},
  memberAudioOptIn: {},
  outboundAudioCalls: {},
  isHostAudioBroadcasting: false,
  hostAudioStream: null,
  roomAudioCall: null,
  memberAudioEnabled: false,
  directory: [],
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

// The page assembles itself one block per scroll: 0 is the bare scene, 1 adds the
// headline, 2 the join bar, 3 the terminal. The landing view starts at INITIAL_STAGE.
const STAGES = 3;
const INITIAL_STAGE = 1;
const MOVE_MS = 1100;
const STAGGER_MS = 220;
// Cubic ease in/out: you see each block pick up speed and then brake. (A steeper
// curve spends its slow start off-screen and then whips across in a blink.)
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// Where an element's slot is, ignoring any transform it currently has.
function slotTop(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

// v = 1: in its slot. v = 0: waiting just below the bottom of the screen.
function placeBlock(el, v) {
  const travel = window.innerHeight - slotTop(el) + 24;
  el.style.transform = v >= 1 ? '' : `translateY(${((1 - v) * travel).toFixed(1)}px)`;
  el.style.visibility = v <= 0 ? 'hidden' : '';
}

// A card drawn the way an old terminal would: a phosphor box with corner indices.
function PlayingCard({ card }) {
  return (
    <span className="tc-face" aria-label={`${card.rank} of ${card.suit}`} role="img">
      <span className="tc-face-rank" aria-hidden="true">{card.rank}</span>
      <span className="tc-face-suit" aria-hidden="true">{SUIT_GLYPH[card.suit]}</span>
      <span className="tc-face-rank flip" aria-hidden="true">{card.rank}</span>
    </span>
  );
}

// Logo: a card fanned behind a prompt caret.
function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tc-logo">
      <rect x="7.5" y="3" width="11" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.6" transform="rotate(12 13 10.5)" opacity="0.55" />
      <rect x="4.5" y="5" width="11" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 10.5l2.5 2-2.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 15h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Lucide-style line icons, inlined so the page needs no icon library.
function Icon({ name }) {
  const paths = {
    radio: (
      <>
        <path d="M4.9 19.1a10 10 0 0 1 0-14.2" />
        <path d="M7.8 16.2a6 6 0 0 1 0-8.4" />
        <circle cx="12" cy="12" r="2" />
        <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
        <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
      </>
    ),
    headphones: (
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    ),
    book: (
      <>
        <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="tc-icon">
      {paths[name]}
    </svg>
  );
}

export default function TerminalCards() {
  const usernameRef = useRef(null);
  const roomCodeRef = useRef(null);
  const bodyRef = useRef(null);
  const terminalInputRef = useRef(null);
  const roomAudioRef = useRef(null);
  const historyRef = useRef([]);
  const historyPosRef = useRef(0);
  const [session, setSession] = useState({ role: '', room: '', user: '' });
  const [table, setTable] = useState(null);
  const [wildCard, setWildCard] = useState(null);
  const [callLast, setCallLast] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [stage, setStage] = useState(INITIAL_STAGE);
  const blockPos = useRef([1, 2, 3].map((n) => (n <= INITIAL_STAGE ? 1 : 0)));
  const screenRef = useRef(null);
  const music = useMusic();
  const prevStage = useRef(INITIAL_STAGE);
  const [audioControls, setAudioControls] = useState({
    hostDisabled: true,
    memberDisabled: true,
    hostLabel: 'Start Room Audio',
    memberLabel: 'Enable Room Audio',
    showPlayer: false,
  });

  // Display message in the log. Without a kind, the line is styled by its text.
  const attachMessage = useCallback((msg, kind) => {
    const body = bodyRef.current;
    if (!body) return;
    body.appendChild(renderLine(msg, kind, state.savedUser));
    body.scrollTop = body.scrollHeight;
  }, []);

  // Build a context object for gamelogic functions
  const getCtx = useCallback(() => ({
    hostOrUser: state.hostOrUser,
    roomCodeValue: roomCodeRef.current?.value || '',
    peer: state.peer,
    connections: state.connections,
    usernames: state.usernames,
    attachMessage,
    onTable: setTable,
  }), [attachMessage]);

  // Broadcast to all peers (host only)
  const broadcast = useCallback((senderId, message) => {
    for (let id in state.connections) {
      if (id !== senderId) {
        state.connections[id].send(message);
      }
    }
  }, []);

  const refreshAudioControls = useCallback(() => {
    setSession({
      role: state.inRoom ? state.hostOrUser : '',
      room: state.savedRoom || '',
      user: state.savedUser || '',
    });

    if (!state.inRoom) {
      setAudioControls({
        hostDisabled: true,
        memberDisabled: true,
        hostLabel: 'Start Room Audio',
        memberLabel: 'Enable Room Audio',
        showPlayer: false,
      });
      return;
    }

    if (state.hostOrUser === 'host') {
      setAudioControls({
        hostDisabled: false,
        memberDisabled: true,
        hostLabel: state.isHostAudioBroadcasting ? 'Stop Room Audio' : 'Start Room Audio',
        memberLabel: 'Enable Room Audio',
        showPlayer: false,
      });
      return;
    }

    setAudioControls({
      hostDisabled: true,
      memberDisabled: false,
      hostLabel: 'Start Room Audio',
      memberLabel: state.memberAudioEnabled ? 'Room Audio Enabled' : 'Enable Room Audio',
      showPlayer: Boolean(state.roomAudioCall),
    });
  }, []);

  const clearMemberAudioState = useCallback(() => {
    if (state.roomAudioCall) {
      state.roomAudioCall.close();
    }
    state.roomAudioCall = null;
    state.memberAudioEnabled = false;

    if (roomAudioRef.current) {
      roomAudioRef.current.pause();
      roomAudioRef.current.srcObject = null;
    }
    refreshAudioControls();
  }, [refreshAudioControls]);

  const stopHostAudioBroadcast = useCallback((notifyMembers = true) => {
    state.isHostAudioBroadcasting = false;

    if (state.hostAudioStream) {
      state.hostAudioStream.getTracks().forEach((track) => track.stop());
      state.hostAudioStream = null;
    }

    for (let id in state.outboundAudioCalls) {
      state.outboundAudioCalls[id].close();
      delete state.outboundAudioCalls[id];
    }

    if (notifyMembers && state.hostOrUser === 'host') {
      broadcast(state.savedRoom, {
        type: 'audioBroadcastStopped',
        username: 'System'
      });
    }

    refreshAudioControls();
  }, [broadcast, refreshAudioControls]);

  const startCallToMember = useCallback((peerId) => {
    if (!state.peer || !state.isHostAudioBroadcasting || !state.hostAudioStream || !state.connections[peerId]) {
      return;
    }

    if (!state.memberAudioOptIn[peerId]) {
      return;
    }

    if (state.outboundAudioCalls[peerId]) {
      state.outboundAudioCalls[peerId].close();
    }

    const mediaCall = state.peer.call(peerId, state.hostAudioStream, {
      metadata: { type: 'roomAudio' }
    });

    state.outboundAudioCalls[peerId] = mediaCall;

    mediaCall.on('close', () => {
      if (state.outboundAudioCalls[peerId] === mediaCall) {
        delete state.outboundAudioCalls[peerId];
      }
    });

    mediaCall.on('error', () => {
      if (state.outboundAudioCalls[peerId] === mediaCall) {
        delete state.outboundAudioCalls[peerId];
      }
    });
  }, []);

  const startHostAudioBroadcast = useCallback(async () => {
    if (state.hostOrUser !== 'host') {
      attachMessage('Only the host can start room audio.');
      return;
    }

    if (state.isHostAudioBroadcasting) {
      attachMessage('Room audio is already running.');
      return;
    }

    const isLikelyMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');

    try {
      if (!navigator.mediaDevices?.getDisplayMedia || isLikelyMobile) {
        throw new Error('Display audio is unavailable on this device/browser.');
      }

      let displayStream;
      try {
        // Prefer true audio-only display capture where supported.
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            suppressLocalAudioPlayback: false
          }
        });
      } catch (_audioOnlyErr) {
        // Fallback for browsers that require video in display-capture picker.
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'browser'
          },
          audio: {
            suppressLocalAudioPlayback: false
          }
        });
      }

      const displayAudioTracks = displayStream.getAudioTracks();
      const displayVideoTracks = displayStream.getVideoTracks();
      displayVideoTracks.forEach((track) => track.stop());

      if (displayAudioTracks.length === 0) {
        displayStream.getTracks().forEach((track) => track.stop());
        attachMessage("No tab/system audio track found. In the share picker, choose a browser tab and enable 'Share tab audio'.");
        throw new Error('No display audio track was selected.');
      }

      state.hostAudioStream = new MediaStream(displayAudioTracks);
      attachMessage('Broadcasting shared tab/system audio.');
    } catch (_displayErr) {
      try {
        state.hostAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        attachMessage('Display audio unavailable. Broadcasting microphone audio instead.');
      } catch (_micErr) {
        attachMessage('Unable to start room audio. Check media permissions and available sources.');
        return;
      }
    }

    const audioTrack = state.hostAudioStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.onended = () => {
        if (state.isHostAudioBroadcasting) {
          attachMessage('Room audio broadcast ended.');
          stopHostAudioBroadcast(true);
        }
      };
    }

    state.isHostAudioBroadcasting = true;
    attachMessage("Room audio broadcast started. Members must press 'Enable Room Audio'.");
    broadcast(state.savedRoom, {
      type: 'audioBroadcastAvailable',
      username: 'System'
    });

    for (let peerId in state.connections) {
      startCallToMember(peerId);
    }

    refreshAudioControls();
  }, [attachMessage, broadcast, refreshAudioControls, startCallToMember, stopHostAudioBroadcast]);

  const handleHostAudioToggle = useCallback(async () => {
    if (!state.inRoom || state.hostOrUser !== 'host') return;

    if (state.isHostAudioBroadcasting) {
      stopHostAudioBroadcast(true);
      attachMessage('Room audio broadcast stopped.');
    } else {
      await startHostAudioBroadcast();
    }
  }, [attachMessage, startHostAudioBroadcast, stopHostAudioBroadcast]);

  const handleMemberAudioEnable = useCallback(() => {
    if (!state.inRoom || state.hostOrUser !== 'user' || !state.conn || !state.conn.open) return;

    state.memberAudioEnabled = true;

    if (roomAudioRef.current) {
      roomAudioRef.current.muted = false;
      roomAudioRef.current.play().catch(() => {
        // Expected on some browsers before a stream is attached.
      });
    }

    state.conn.send({
      type: 'audioOptIn',
      enabled: true,
    });

    attachMessage('Audio enabled. Waiting for host broadcast...');
    refreshAudioControls();
  }, [attachMessage, refreshAudioControls]);

  // Enable typing
  const configureInput = useCallback(() => {
    if (terminalInputRef.current) {
      terminalInputRef.current.contentEditable = 'true';
      terminalInputRef.current.focus({ preventScroll: true });
    }
  }, []);

  // Python runner: Pyodide (~10 MB) loads from its CDN on first use only.
  const runPython = useCallback(async (pyCode) => {
    if (!state.pyodide) {
      attachMessage("Loading Python runtime...");
      try {
        if (typeof window.loadPyodide !== 'function') await loadScript(PYODIDE_URL);
        state.pyodide = await window.loadPyodide();
      } catch (err) {
        return `Python runtime failed to load: ${err.message}`;
      }
    }
    try {
      pyCode = pyCode.replace(/ /g, " ");
      const result = await state.pyodide.runPythonAsync(pyCode);
      return `Python output: ${result}`;
    } catch (err) {
      return `Python error: ${err}`;
    }
  }, [attachMessage]);

  // HOST: Create room
  const handleMakeRoom = useCallback(() => {
    if (!state.inRoom) {
      if (typeof window.Peer !== 'function') {
        attachMessage('Still loading the connection library. Try again in a moment.', 'warn');
        return;
      }
      try {
        state.peer = new window.Peer(roomCodeRef.current.value);
      } catch (error) {
        attachMessage(`Failed to create peer: ${error.message}`);
        return;
      }

      state.peer.on("error", (err) => {
        attachMessage(`Error: ${err.message}`, 'error');
      });

      state.peer.on("open", () => {
        attachMessage("Room created. Waiting for peers...");
        state.inRoom = true;
        state.hostOrUser = 'host';
        state.savedUser = usernameRef.current.value;
        state.savedRoom = roomCodeRef.current.value;
        state.usernames[roomCodeRef.current.value] = usernameRef.current.value;
        configureInput();
        refreshAudioControls();
      });

      state.peer.on("connection", (incomingConn) => {
        const peerId = incomingConn.peer;
        state.connections[peerId] = incomingConn;

        incomingConn.on("error", (err) => {
          attachMessage(`Connection error with ${state.usernames[peerId] || peerId}: ${err.message}`);
        });

        incomingConn.on("data", (data) => {
          if (typeof data !== 'object' || data === null) return;

          if (data.type === "intro") {
            state.usernames[peerId] = data.username;
            state.memberAudioOptIn[peerId] = false;
            attachMessage(`${data.username} joined the room.`);
            broadcast(peerId, {
              type: "info",
              text: `${data.username} has joined.`,
              username: "System"
            });
            // A late joiner watches the current game.
            publishTables(getCtx());
          } else if (data.type === 'audioOptIn') {
            state.memberAudioOptIn[peerId] = Boolean(data.enabled);
            if (state.memberAudioOptIn[peerId]) {
              attachMessage(`${state.usernames[peerId] || peerId} enabled room audio.`);
              startCallToMember(peerId);
            } else if (state.outboundAudioCalls[peerId]) {
              state.outboundAudioCalls[peerId].close();
              delete state.outboundAudioCalls[peerId];
            }
          } else if (data.type === "message" && typeof data.text === 'string') {
            const user = state.usernames[peerId] || "Unknown";

            // Game commands are answered by the game, not echoed to the room as chat.
            const colonIndex = data.text.indexOf(': ');
            if (colonIndex !== -1) {
              const rawCommand = data.text.slice(colonIndex + 2);
              if (processGameCommand(peerId, rawCommand, getCtx())) return;
            }

            attachMessage(data.text);
            broadcast(peerId, {
              type: "message",
              text: data.text,
              username: user
            });
          } else if (data.type === "file") {
            state.directory.push({ name: data.name, content: data.content });
          } else if (data.type === "fileList") {
            // Reply on the asking member's connection (the host has no state.conn).
            incomingConn.send({ type: "fileList", files: state.directory });
          }
        });

        incomingConn.on("close", () => {
          const user = state.usernames[peerId] || peerId;
          attachMessage(`${user} disconnected.`);
          broadcast(peerId, {
            type: "info",
            text: `${user} has left.`,
            username: "System"
          });
          delete state.connections[peerId];
          removePlayer(peerId, getCtx());
          delete state.usernames[peerId];
          delete state.memberAudioOptIn[peerId];
          if (state.outboundAudioCalls[peerId]) {
            state.outboundAudioCalls[peerId].close();
            delete state.outboundAudioCalls[peerId];
          }
        });
      });

      state.peer.on('call', (incomingCall) => {
        incomingCall.close();
      });
    } else {
      attachMessage("Please leave the current room first.");
    }
  }, [attachMessage, broadcast, configureInput, getCtx, refreshAudioControls, startCallToMember]);

  // USER: Join room
  const handleJoinRoom = useCallback(() => {
    if (!state.inRoom) {
      if (typeof window.Peer !== 'function') {
        attachMessage('Still loading the connection library. Try again in a moment.', 'warn');
        return;
      }
      try {
        state.peer = new window.Peer();
      } catch (error) {
        attachMessage(`Failed to create peer: ${error.message}`);
        return;
      }

      state.peer.on("error", (err) => {
        attachMessage(`Error: ${err.message}`, 'error');
      });

      state.peer.on("open", () => {
        const conn = state.peer.connect(roomCodeRef.current.value);
        state.conn = conn;

        conn.on("open", () => {
          attachMessage("Connected to host.");
          conn.send({ type: "intro", username: usernameRef.current.value });
          configureInput();
          state.inRoom = true;
          state.hostOrUser = 'user';
          state.savedUser = usernameRef.current.value;
          state.savedRoom = roomCodeRef.current.value;
          refreshAudioControls();
        });

        conn.on("error", (err) => {
          attachMessage(`Connection error: ${err.message}`);
        });

        conn.on("close", () => {
          if (state.conn !== conn) return; // We hung up ourselves.
          state.conn = null;
          state.inRoom = false;
          state.hostOrUser = '';
          setTable(null);
          attachMessage('The host closed the room.', 'system');
          clearMemberAudioState();
        });

        conn.on("data", (data) => {
          if (typeof data === "object" && data !== null) {
            if (data.type === "table") {
              const t = data.table;
              if (t && Array.isArray(t.players) && Array.isArray(t.hand)) setTable(t);
            } else if (data.type === "gameState" || data.type === "message" || data.type === "info") {
              if (typeof data.text === 'string') attachMessage(data.text);
            } else if (data.type === "error") {
              attachMessage(`Error: ${data.text}`, 'error');
            } else if (data.type === 'audioBroadcastAvailable') {
              attachMessage("Host audio is available. Press 'Enable Room Audio' to receive it.");
            } else if (data.type === 'audioBroadcastStopped') {
              attachMessage('Host audio broadcast stopped.');
              clearMemberAudioState();
            } else if (data.type === "fileList" && Array.isArray(data.files)) {
              state.directory = data.files;
            }
          } else {
            attachMessage(String(data));
          }
        });
      });

      state.peer.on('call', (incomingCall) => {
        if (incomingCall.metadata?.type !== 'roomAudio') {
          incomingCall.close();
          return;
        }

        incomingCall.answer();

        incomingCall.on('stream', async (remoteStream) => {
          if (!roomAudioRef.current) return;
          roomAudioRef.current.muted = false;
          roomAudioRef.current.srcObject = remoteStream;
          try {
            await roomAudioRef.current.play();
          } catch (_err) {
            attachMessage('Press the audio controls to start playback.');
          }
          state.roomAudioCall = incomingCall;
          refreshAudioControls();
        });

        incomingCall.on('close', () => {
          if (state.roomAudioCall === incomingCall) {
            state.roomAudioCall = null;
          }
          if (roomAudioRef.current) {
            roomAudioRef.current.pause();
            roomAudioRef.current.srcObject = null;
          }
          refreshAudioControls();
        });

        state.roomAudioCall = incomingCall;
        refreshAudioControls();
      });
    } else {
      attachMessage("You're already in a room.");
    }
  }, [attachMessage, clearMemberAudioState, configureInput, refreshAudioControls]);

  // Disconnect
  const handleDisconnect = useCallback(() => {
    if (state.hostOrUser === 'host') {
      stopHostAudioBroadcast(false);
      resetGame();
    } else {
      clearMemberAudioState();
    }

    if (state.conn) {
      const conn = state.conn;
      state.conn = null;
      conn.close();
    }
    if (state.hostOrUser === 'host') {
      for (let id in state.connections) {
        state.connections[id].close();
      }
    }
    // Release the peer ID so the same room code can be hosted again.
    if (state.peer) state.peer.destroy();
    state.peer = null;
    setTable(null);
    setWildCard(null);
    attachMessage("Disconnected.");
    state.inRoom = false;
    state.hostOrUser = '';
    refreshAudioControls();
  }, [attachMessage, clearMemberAudioState, refreshAudioControls, stopHostAudioBroadcast]);

  // Runs one line of input, whether typed or sent by a table button.
  const submitLine = useCallback(async (text, lineText = text) => {
    const textArray = text.split(" ");
    const echo = () => attachMessage(lineText, 'input');

    if (text === "-keygen" && !state.inRoom) {
      echo();
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?";
      let key = "";
      for (let i = 0; i < Math.random() * 12 + 14; i++) {
        key += chars.charAt(Math.floor(Math.random() * (chars.length - 26)));
      }
      attachMessage(`Generated key: ${key}`);
      return;
    }

    if (text.startsWith("python: ")) {
      const pyCode = lineText.slice(8).trim();
      echo();
      const result = await runPython(pyCode);
      attachMessage(result);
      return;
    }

    if (textArray[0] === "touch" && textArray.length === 2) {
      echo();
      if (state.hostOrUser === "host") {
        state.directory.push({ name: textArray[1], content: "" });
      } else if (state.hostOrUser === "user") {
        state.conn?.send({ type: "file", name: textArray[1], content: "" });
      }
      attachMessage(`${textArray[1]} created`);
      return;
    }

    if (textArray[0] === "ls") {
      echo();
      if (state.hostOrUser === "user") {
        state.conn?.send({ type: "fileList" });
      }
      for (let file of state.directory) attachMessage(file.name);
      return;
    }

    if (textArray[0] === "edit" && textArray[1]) {
      const name = textArray[1];
      const editedCode = text.slice(6 + name.length).trim();
      for (let file of state.directory) {
        if (file.name === name) file.content = editedCode;
      }
    }

    if (!text) return;

    if (!state.inRoom || state.savedUser == null) {
      echo();
      attachMessage('Make or join a room first.', 'warn');
      return;
    }

    const formattedText = `TerminalCards/${state.savedRoom}/${state.savedUser}: ${text}`;
    const msgObj = { type: "message", text: formattedText, username: state.savedUser };

    // Game commands: the host runs them locally, members send them to the host.
    if (isGameCommand(text)) {
      echo();
      if (state.hostOrUser === 'host') {
        gamelogic(text, getCtx());
      } else if (state.conn?.open) {
        state.conn.send(msgObj);
      }
      return;
    }

    attachMessage(formattedText);

    if (state.hostOrUser === 'user' && state.conn && state.conn.open) {
      state.conn.send(msgObj);
    } else if (state.hostOrUser === 'host') {
      broadcast(state.savedRoom, msgObj);
    }
  }, [attachMessage, broadcast, getCtx, runPython]);

  // Terminal input handler
  const handleTerminalKeyDown = useCallback((e) => {
    const el = terminalInputRef.current;
    if (!el) return;

    // Up/down walks through earlier single-line inputs, like a shell.
    const history = historyRef.current;
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !el.innerText.includes('\n')) {
      if (history.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowUp' ? -1 : 1;
      historyPosRef.current = Math.max(0, Math.min(history.length, historyPosRef.current + step));
      el.textContent = history[historyPosRef.current] ?? '';
      window.getSelection()?.selectAllChildren(el);
      window.getSelection()?.collapseToEnd();
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) return;
    if (e.key !== 'Enter') return;

    e.preventDefault();
    const text = el.textContent.trim();
    const lineText = el.innerText.trim();
    el.innerHTML = '';

    if (text) history.push(lineText);
    historyPosRef.current = history.length;
    submitLine(text, lineText);
  }, [submitLine]);

  // Table buttons type commands, so the log shows exactly what was played.
  const playCard = useCallback((card, chosenSuit) => {
    if (card.rank === '8' && !chosenSuit) {
      setWildCard(card);
      return;
    }
    const as = chosenSuit ? ` as ${chosenSuit}` : '';
    submitLine(`play ${card.rank} of ${card.suit}${as}${callLast ? ' last' : ''}`);
    setWildCard(null);
    setCallLast(false);
  }, [callLast, submitLine]);

  // The table panel squeezes the log when it opens or grows: keep the newest line in view.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [table, wildCard]);

  // Pull blocks up into their slots (or send them back down) when the stage changes.
  // Blocks that change move one after another: in order going in, reversed going out.
  // A layout effect, so the landing view never flashes the blocks in place first.
  useLayoutEffect(() => {
    const blocks = [...document.querySelectorAll('.terminal-page .tc-block')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = blockPos.current.slice();
    const to = blocks.map((_, i) => (i < stage ? 1 : 0));
    const changing = blocks.map((_, i) => i).filter((i) => from[i] !== to[i]);
    if (changing.some((i) => to[i] < from[i])) changing.reverse();

    blocks.forEach((b, i) => {
      if (!changing.includes(i)) placeBlock(b, from[i]);
      else if (to[i] === 1) b.style.visibility = ''; // focusable as soon as it starts moving in
    });

    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      let done = true;
      changing.forEach((i, k) => {
        const t = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - start - k * STAGGER_MS) / MOVE_MS));
        if (t < 1) done = false;
        blockPos.current[i] = from[i] + (to[i] - from[i]) * easeInOut(t);
        placeBlock(blocks[i], blockPos.current[i]);
      });
      if (!done) frame = requestAnimationFrame(tick);
    };
    if (changing.length) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  // The terminal's tube is dark while it waits off-screen, switches on as it lands,
  // and switches off the moment it starts to leave.
  useLayoutEffect(() => {
    const el = screenRef.current;
    if (!el) return undefined;
    const was = prevStage.current;
    prevStage.current = stage;
    const restart = (name) => {
      el.classList.remove('tc-power-on', 'tc-power-off');
      void el.offsetWidth; // let the animation start over
      el.classList.add(name);
    };
    if (stage < STAGES && (was >= STAGES || !el.classList.contains('tc-power-off'))) {
      restart('tc-power-off');
      return undefined;
    }
    if (stage >= STAGES && was < STAGES) {
      // When two blocks come in together the terminal is second, one stagger later.
      const delay = MOVE_MS * 0.6 + Math.max(0, STAGES - was - 1) * STAGGER_MS;
      const timer = setTimeout(() => restart('tc-power-on'), delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stage]);

  // Keep every block correctly placed (in its slot or just off-screen) on resize.
  useEffect(() => {
    const onResize = () => {
      document.querySelectorAll('.terminal-page .tc-block').forEach((b, i) => placeBlock(b, blockPos.current[i]));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // One scroll gesture, one block.
  useEffect(
    () =>
      createStageGestures(document.querySelector('.terminal-page'), {
        busyMs: MOVE_MS,
        onStep: (dir) => setStage((s) => Math.max(0, Math.min(STAGES, s + dir))),
        onJump: (end) => setStage(end === 'first' ? 0 : STAGES),
      }),
    [],
  );

  // Joining a room brings everything in, terminal last.
  useEffect(() => {
    if (session.role) setStage(STAGES);
  }, [session.role]);

  // Once the terminal is in (and no longer inert), hand it the keyboard.
  useEffect(() => {
    if (stage === STAGES && session.role) terminalInputRef.current?.focus({ preventScroll: true });
  }, [stage, session.role]);

  // Load PeerJS from CDN
  useEffect(() => {
    if (!document.querySelector('script[src*="peerjs"]')) {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.0/dist/peerjs.min.js';
      document.head.appendChild(s);
    }
    // Reset state on unmount
    return () => {
      stopHostAudioBroadcast(false);
      clearMemberAudioState();
      resetGame();
      if (state.conn) state.conn.close();
      if (state.peer) state.peer.destroy();
      state.peer = null;
      state.conn = null;
      state.inRoom = false;
      state.hostOrUser = '';
      state.connections = {};
      state.usernames = {};
      state.memberAudioOptIn = {};
      state.outboundAudioCalls = {};
      state.memberAudioEnabled = false;
    };
  }, [clearMemberAudioState, stopHostAudioBroadcast]);

  const online = session.role !== '';
  const statusLabel = session.role === 'host' ? 'Hosting' : session.role === 'user' ? 'Connected' : 'Offline';
  const showHand = table && table.active && table.inGame;

  return (
    <div className="terminal-page">
      <CrtBackdrop />

      <nav className="tc-nav">
        <div className="liquid-glass tc-nav-pill">
          <div className="tc-nav-left">
            <Logo />
            <span className="tc-brand">TerminalCards</span>
            <span className="tc-nav-status">
              <i className={`tc-dot ${session.role || 'offline'}`} aria-hidden="true" />
              {online ? `${statusLabel} · ${session.room}` : statusLabel}
            </span>
          </div>
          <Link to="/" className="tc-pill-white">&larr; Home</Link>
        </div>
      </nav>

      <main className="tc-hero">
        <section className="tc-block tc-block-intro" inert={stage < 1 ? '' : undefined}>
          <h1 className="tc-headline">
            Deal in from the <em>command line</em>
          </h1>
          <p className="tc-subline">
            A peer-to-peer card table — no server, no sign-up, just a terminal and a room code.
          </p>
        </section>

        <section className="tc-block tc-block-join" inert={stage < 2 ? '' : undefined}>
          <div className="liquid-glass tc-join">
            <input
              type="text"
              ref={usernameRef}
              placeholder="username"
              aria-label="Username"
              autoComplete="off"
              spellCheck={false}
              disabled={online}
            />
            <span className="tc-join-divider" aria-hidden="true" />
            <input
              type="text"
              ref={roomCodeRef}
              placeholder="room code"
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
              disabled={online}
            />
            {online ? (
              <button className="tc-pill-white" onClick={handleDisconnect}>Disconnect</button>
            ) : (
              <>
                <button className="tc-text-btn" onClick={handleJoinRoom}>Join Room</button>
                <button className="tc-pill-white" onClick={handleMakeRoom}>Make Room</button>
              </>
            )}
          </div>
        </section>

        <section className="tc-block tc-block-terminal" inert={stage < 3 ? '' : undefined}>
          <section className="liquid-glass tc-window" aria-label="Terminal">
            <div className="tc-screen" ref={screenRef}>
              <div className="tc-static" aria-hidden="true" />
              <div className="tc-statusline">
                <span>TERMINALCARDS</span>
                <span className="tc-statusline-mid">{online ? `${session.user}@${session.room}` : 'no carrier'}</span>
                <span>[{statusLabel.toUpperCase()}]</span>
              </div>

              {table && table.top && (
                <div className="tc-table" aria-label="Card table">
                  <div className="tc-table-row">
                    <div className="tc-pile">
                      <PlayingCard card={table.top} />
                      <div className="tc-pile-info">
                        <span>SUIT  {SUIT_GLYPH[table.activeSuit]} {table.activeSuit.toUpperCase()}</span>
                        <span>DECK  {String(table.deckCount).padStart(2, '0')}  {table.direction === 1 ? '>>' : '<<'}</span>
                        {table.pendingDraw > 0 && <span className="tc-badge">DRAW +{table.pendingDraw}</span>}
                      </div>
                    </div>
                    <ol className="tc-players" aria-label="Players">
                      {table.players.map((p, i) => (
                        <li key={`${i}-${p.name}`} className={`${p.current ? 'current' : ''} ${p.you ? 'you' : ''}`}>
                          <span className="tc-player-name">{p.current ? '>' : ' '} {p.name}{p.you ? '*' : ''}</span>
                          <span className="tc-count" aria-label={`${p.count} cards`}>{String(p.count).padStart(2, '0')}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {table.winner && !table.active && (
                    <p className="tc-table-note">{table.winner} won. Host: type start for a rematch.</p>
                  )}
                  {table.active && !table.inGame && (
                    <p className="tc-table-note">Watching. You&apos;ll be dealt in next round.</p>
                  )}

                  {showHand && (
                    <div className="tc-hand-row">
                      <div className="tc-hand" aria-label="Your hand">
                        {table.hand.map((c) => (
                          <button
                            key={`${c.rank}${c.suit}`}
                            className={`tc-hand-card ${c.playable ? 'playable' : ''}`}
                            disabled={!c.playable}
                            onClick={() => playCard(c)}
                            aria-label={`Play ${c.rank} of ${c.suit}`}
                          >
                            <span aria-hidden="true">{c.rank}</span>
                            <span aria-hidden="true">{SUIT_GLYPH[c.suit]}</span>
                          </button>
                        ))}
                      </div>
                      <div className="tc-hand-actions">
                        <button onClick={() => submitLine('draw')} disabled={!table.canDraw}>
                          {table.pendingDraw > 0 && table.yourTurn ? `DRAW ${table.pendingDraw}` : 'DRAW'}
                        </button>
                        <button onClick={() => submitLine('pass')} disabled={!table.canPass}>PASS</button>
                        {table.yourTurn && table.hand.length === 2 && (
                          <button
                            className={callLast ? 'on' : ''}
                            aria-pressed={callLast}
                            onClick={() => setCallLast((v) => !v)}
                          >
                            LAST CARD
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {wildCard && showHand && (
                    <div className="tc-wild" role="group" aria-label="Choose the next suit">
                      <span>NEXT SUIT?</span>
                      {SUITS.map((s) => (
                        <button key={s} onClick={() => playCard(wildCard, s)}>
                          {SUIT_GLYPH[s]} {s.toUpperCase()}
                        </button>
                      ))}
                      <button onClick={() => setWildCard(null)}>CANCEL</button>
                    </div>
                  )}
                </div>
              )}

              <div
                className="terminal-body"
                ref={bodyRef}
                role="log"
                aria-live="polite"
                data-empty={'TERMINALCARDS BIOS v2.0\n640K CARDS OK\n\nMake or join a room above, then type help.\nREADY.'}
              ></div>

              <div className="terminal-input-row">
                <span className="prompt" aria-hidden="true">
                  {online ? session.user.toUpperCase() : 'GUEST'}&gt;
                </span>
                <span
                  className="terminal-input"
                  ref={terminalInputRef}
                  role="textbox"
                  aria-label="Terminal input"
                  tabIndex={0}
                  contentEditable="true"
                  onKeyDown={handleTerminalKeyDown}
                  onInput={(e) => {
                    // An emptied contenteditable can keep a stray <br>; clear it so :empty works.
                    if (e.currentTarget.textContent === '') e.currentTarget.innerHTML = '';
                  }}
                  suppressContentEditableWarning
                ></span>
              </div>
            </div>
          </section>
          <div className="tc-dock">
            {rulesOpen && (
              <div className="liquid-glass tc-rules" id="tc-rules">
                <h2>How to play</h2>
                <p>Match the top card&apos;s suit or rank. First to empty their hand wins.</p>
                <dl>
                  <dt>start</dt>
                  <dd>Host deals a new game</dd>
                  <dt>play 7 of Clubs</dt>
                  <dd>Play a matching card</dd>
                  <dt>play 8 of Hearts as Spades</dt>
                  <dd>8 is wild: name the next suit</dd>
                  <dt>2 · J · Q</dt>
                  <dd>Next draws two (stackable) · skip · reverse</dd>
                  <dt>draw / pass</dt>
                  <dd>Draw one; play it if it fits, or pass</dd>
                  <dt>… last</dt>
                  <dd>Call last card, or draw two</dd>
                </dl>
              </div>
            )}
            <div className="tc-circles">
              {/* Room audio: the host broadcasts a tab's sound, members tune in. */}
              <button
                className="liquid-glass-circle tc-circle"
                onClick={session.role === 'user' ? handleMemberAudioEnable : handleHostAudioToggle}
                disabled={audioControls.hostDisabled && audioControls.memberDisabled}
                aria-label={session.role === 'user' ? audioControls.memberLabel : audioControls.hostLabel}
                title={session.role === 'user' ? audioControls.memberLabel : audioControls.hostLabel}
                aria-pressed={
                  audioControls.hostLabel === 'Stop Room Audio' || audioControls.memberLabel === 'Room Audio Enabled'
                }
              >
                <Icon name="radio" />
              </button>
              <button
                className="liquid-glass-circle tc-circle"
                onClick={music.toggle}
                disabled={!music.hasTracks}
                aria-label={music.playing ? 'Pause music' : 'Play music'}
                title={music.playing ? 'Pause music' : 'Play music'}
                aria-pressed={music.playing}
              >
                <Icon name="headphones" />
              </button>
              <button
                className="liquid-glass-circle tc-circle"
                onClick={() => setRulesOpen((v) => !v)}
                aria-label="How to play"
                title="How to play"
                aria-expanded={rulesOpen}
                aria-controls="tc-rules"
              >
                <Icon name="book" />
              </button>
              {(music.playing || music.missing) && (
                <div className="liquid-glass tc-now-playing" role="status">
                  {music.missing ? (
                    <span className="tc-np-title">No tracks yet: add them to public/audio</span>
                  ) : (
                    <>
                      <span className="tc-np-text">
                        <span className="tc-np-title">{music.track.title}</span>
                        <span className="tc-np-artist">{music.track.artist}</span>
                      </span>
                      <button className="tc-np-next" onClick={music.skip} aria-label="Next track" title="Next track">
                        ›
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <audio
              ref={roomAudioRef}
              className={`room-audio-player ${audioControls.showPlayer ? 'visible' : ''}`}
              controls
              autoPlay
              playsInline
            />
          </div>
        </section>

        <button
          className="tc-scroll-cue"
          hidden={stage >= STAGES}
          onClick={() => setStage((s) => Math.min(STAGES, s + 1))}
        >
          Scroll to deal in <span aria-hidden="true">↓</span>
        </button>
      </main>
    </div>
  );
}
