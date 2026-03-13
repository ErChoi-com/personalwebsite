import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { gamelogic, processGameCommand } from '../terminalcards/gamelogic';
import '../styles/terminal.css';

/*
  This component wraps the original interaction.js logic.
  The original DOM-based code is adapted to use React refs,
  but the core networking / game logic is kept nearly identical.
*/

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

export default function TerminalCards() {
  const usernameRef = useRef(null);
  const roomCodeRef = useRef(null);
  const bodyRef = useRef(null);
  const terminalInputRef = useRef(null);
  const roomAudioRef = useRef(null);
  const [audioControls, setAudioControls] = useState({
    hostDisabled: true,
    memberDisabled: true,
    hostLabel: 'Start Room Audio',
    memberLabel: 'Enable Room Audio',
    showPlayer: false,
  });

  // Display message in chat
  const attachMessage = useCallback((msg) => {
    if (!bodyRef.current) return;
    const div = document.createElement('div');
    div.textContent = msg;
    bodyRef.current.appendChild(div);
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, []);

  // Build a context object for gamelogic functions
  const getCtx = useCallback(() => ({
    hostOrUser: state.hostOrUser,
    roomCodeValue: roomCodeRef.current?.value || '',
    peer: state.peer,
    connections: state.connections,
    usernames: state.usernames,
    attachMessage,
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
      terminalInputRef.current.focus();
    }
  }, []);

  // Python runner
  const runPython = useCallback(async (pyCode) => {
    if (!state.pyodide) {
      attachMessage("Loading Python runtime...");
      // loadPyodide is expected to be on window via CDN
      if (typeof window.loadPyodide === 'function') {
        state.pyodide = await window.loadPyodide();
      } else {
        return "Python runtime not available (Pyodide not loaded)";
      }
    }
    try {
      pyCode = pyCode.replace(/\u00A0/g, " ");
      const result = await state.pyodide.runPythonAsync(pyCode);
      return `Python output: ${result}`;
    } catch (err) {
      return `Python error: ${err}`;
    }
  }, [attachMessage]);

  // HOST: Create room
  const handleMakeRoom = useCallback(() => {
    if (!state.inRoom) {
      try {
        state.peer = new window.Peer(roomCodeRef.current.value);
      } catch (error) {
        attachMessage(`Failed to create peer: ${error.message}`);
        return;
      }

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
          if (data.type === "intro") {
            state.usernames[peerId] = data.username;
            state.memberAudioOptIn[peerId] = false;
            attachMessage(`${data.username} joined the room.`);
            broadcast(peerId, {
              type: "info",
              text: `${data.username} has joined.`,
              username: "System"
            });
          } else if (data.type === 'audioOptIn') {
            state.memberAudioOptIn[peerId] = Boolean(data.enabled);
            if (state.memberAudioOptIn[peerId]) {
              attachMessage(`${state.usernames[peerId] || peerId} enabled room audio.`);
              startCallToMember(peerId);
            } else if (state.outboundAudioCalls[peerId]) {
              state.outboundAudioCalls[peerId].close();
              delete state.outboundAudioCalls[peerId];
            }
          } else if (data.type === "message") {
            const user = state.usernames[peerId] || "Unknown";
            attachMessage(data.text);

            const colonIndex = data.text.indexOf(': ');
            if (colonIndex !== -1) {
              const rawCommand = data.text.slice(colonIndex + 2);
              processGameCommand(peerId, rawCommand, getCtx());
            }

            broadcast(peerId, {
              type: "message",
              text: data.text,
              username: user
            });
          } else if (data.type === "file") {
            state.directory.push({ name: data.name, content: data.content });
          } else if (data.type === "fileList") {
            state.conn?.send({ type: "fileList", files: state.directory });
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
      try {
        state.peer = new window.Peer();
      } catch (error) {
        attachMessage(`Failed to create peer: ${error.message}`);
        return;
      }

      state.peer.on("open", () => {
        state.conn = state.peer.connect(roomCodeRef.current.value);

        state.conn.on("open", () => {
          attachMessage("Connected to host.");
          state.conn.send({ type: "intro", username: usernameRef.current.value });
          configureInput();
          state.inRoom = true;
          state.hostOrUser = 'user';
          state.savedUser = usernameRef.current.value;
          state.savedRoom = roomCodeRef.current.value;
          refreshAudioControls();
        });

        state.conn.on("error", (err) => {
          attachMessage(`Connection error: ${err.message}`);
        });

        state.conn.on("data", (data) => {
          if (typeof data === "object" && data !== null) {
            if (data.type === "gameState") {
              attachMessage(data.text);
            } else if (data.type === "message") {
              attachMessage(data.text);
            } else if (data.type === "info") {
              attachMessage(data.text);
            } else if (data.type === "error") {
              attachMessage(`Error: ${data.text}`);
            } else if (data.type === 'audioBroadcastAvailable') {
              attachMessage("Host audio is available. Press 'Enable Room Audio' to receive it.");
            } else if (data.type === 'audioBroadcastStopped') {
              attachMessage('Host audio broadcast stopped.');
              clearMemberAudioState();
            } else if (data.type === "fileList") {
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
    } else {
      clearMemberAudioState();
    }

    if (state.conn) {
      state.conn.close();
      state.conn = null;
    }
    if (state.hostOrUser === 'host') {
      for (let id in state.connections) {
        state.connections[id].close();
      }
    }
    attachMessage("Disconnected.");
    state.inRoom = false;
    state.hostOrUser = '';
    refreshAudioControls();
  }, [attachMessage, clearMemberAudioState, refreshAudioControls, stopHostAudioBroadcast]);

  // Terminal input handler
  const handleTerminalKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter' && e.shiftKey) return;
    if (e.key !== 'Enter') return;

    e.preventDefault();
    const el = terminalInputRef.current;
    if (!el) return;

    let text = el.textContent.trim();
    let lineText = el.innerText.trim();
    let textArray = text.split(" ");
    el.innerHTML = '';

    if (text === "-keygen" && !state.inRoom) {
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
      attachMessage(pyCode);
      const result = await runPython(pyCode);
      attachMessage(result);
      return;
    }

    if (textArray[0] === "touch" && textArray.length === 2) {
      if (state.hostOrUser === "host") {
        state.directory.push({ name: textArray[1], content: "" });
      } else if (state.hostOrUser === "user") {
        state.conn?.send({ type: "file", name: textArray[1], content: "" });
      }
      attachMessage(`${textArray[1]} created`);
      return;
    }

    if (textArray[0] === "ls") {
      if (state.hostOrUser === "host") {
        for (let file of state.directory) attachMessage(file.name);
      } else if (state.hostOrUser === "user") {
        state.conn?.send({ type: "fileList" });
        for (let file of state.directory) attachMessage(file.name);
      }
      return;
    }

    if (textArray[0] === "edit") {
      const name = textArray[1];
      const editedCode = text.slice(6 + name.length).trim();
      for (let file of state.directory) {
        if (file.name === name) file.content = editedCode;
      }
    }

    if (!text || state.savedUser == null) return;

    // Check if this is a game command (host processes locally)
    if (state.hostOrUser === 'host') {
      const result = gamelogic(text, getCtx());
      if (result !== null) return;
    }

    const formattedText = `TerminalCards/${state.savedRoom}/${state.savedUser}: ${text}`;
    const msgObj = { type: "message", text: formattedText, username: state.savedUser };
    attachMessage(formattedText);

    if (state.hostOrUser === 'user' && state.conn && state.conn.open) {
      state.conn.send(msgObj);
    } else if (state.hostOrUser === 'host') {
      broadcast(state.savedRoom, msgObj);
    }
  }, [attachMessage, broadcast, getCtx, runPython]);

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

  return (
    <div className="terminal-page">
      <Link to="/" className="back-link">&larr; Home</Link>

      <p>Provide a username. It has to be unique.</p>
      <input type="text" ref={usernameRef} placeholder="username" />

      <p>Provide a room code. It has to be unique also.</p>
      <input type="text" ref={roomCodeRef} placeholder="roomCode" />

      <div className="btn-row">
        <button className="primary" onClick={handleMakeRoom}>Make Room</button>
        <button onClick={handleJoinRoom}>Join Room</button>
        <button className="danger" onClick={handleDisconnect}>Disconnect</button>
        <button onClick={handleHostAudioToggle} disabled={audioControls.hostDisabled}>{audioControls.hostLabel}</button>
        <button onClick={handleMemberAudioEnable} disabled={audioControls.memberDisabled}>{audioControls.memberLabel}</button>
      </div>

      <div className="terminal-body" ref={bodyRef}></div>

      <div className="terminal-input-row">
        <span className="prompt">&gt;&nbsp;</span>
        <span
          className="terminal-input"
          ref={terminalInputRef}
          contentEditable="true"
          onKeyDown={handleTerminalKeyDown}
          suppressContentEditableWarning
        ></span>
      </div>

      <audio
        ref={roomAudioRef}
        className={`room-audio-player ${audioControls.showPlayer ? 'visible' : ''}`}
        controls
        autoPlay
        playsInline
      />
    </div>
  );
}
