let peer;
let conn;
let savedUser;
let savedRoom;
let hostOrUser = '';
let inRoom = false;
let pyodide = null; // Pyodide instance
let isHostAudioBroadcasting = false;
let hostAudioStream = null;
let roomAudioCall = null;

// For hosts only: connections and usernames
const connections = {}; // key: peer ID => conn
const usernames = {};   // key: peer ID => username
const memberAudioOptIn = {}; // key: peer ID => member clicked audio enable
const outboundAudioCalls = {}; // key: peer ID => media call
let directory = [];

// UI references
const username = document.getElementById("username");
const roomCode = document.getElementById("roomCode");
const make = document.getElementById("make");
const join = document.getElementById("join");
const disconnect = document.getElementById("disconnect");
const hostAudioToggle = document.getElementById("host-audio-toggle");
const memberAudioEnable = document.getElementById("member-audio-enable");
const body = document.getElementById("body");
const terminalInput = document.getElementById("terminal-input");

const roomAudioElement = document.createElement("audio");
roomAudioElement.autoplay = true;
roomAudioElement.controls = true;
roomAudioElement.style.marginTop = "0.75rem";
roomAudioElement.style.width = "100%";
roomAudioElement.style.maxWidth = "800px";
roomAudioElement.style.display = "none";
document.body.appendChild(roomAudioElement);

function refreshAudioControls() {
    if (!inRoom) {
        hostAudioToggle.disabled = true;
        memberAudioEnable.disabled = true;
        hostAudioToggle.textContent = "Start Room Audio";
        memberAudioEnable.textContent = "Enable Room Audio";
        return;
    }

    if (hostOrUser === "host") {
        hostAudioToggle.disabled = false;
        hostAudioToggle.textContent = isHostAudioBroadcasting ? "Stop Room Audio" : "Start Room Audio";
        memberAudioEnable.disabled = true;
        memberAudioEnable.textContent = "Enable Room Audio";
        return;
    }

    hostAudioToggle.disabled = true;
    memberAudioEnable.disabled = false;
    memberAudioEnable.textContent = roomAudioCall ? "Room Audio Enabled" : "Enable Room Audio";
}

function clearMemberAudioState() {
    if (roomAudioCall) {
        roomAudioCall.close();
    }
    roomAudioCall = null;
    roomAudioElement.pause();
    roomAudioElement.srcObject = null;
    roomAudioElement.style.display = "none";
    refreshAudioControls();
}

function stopHostAudioBroadcast(notifyMembers = true) {
    isHostAudioBroadcasting = false;

    if (hostAudioStream) {
        hostAudioStream.getTracks().forEach((track) => track.stop());
        hostAudioStream = null;
    }

    for (let id in outboundAudioCalls) {
        outboundAudioCalls[id].close();
        delete outboundAudioCalls[id];
    }

    if (notifyMembers && hostOrUser === "host") {
        broadcast(savedRoom, {
            type: "audioBroadcastStopped",
            username: "System"
        });
    }

    refreshAudioControls();
}

function startCallToMember(peerId) {
    if (!isHostAudioBroadcasting || !hostAudioStream || !connections[peerId]) {
        return;
    }

    if (!memberAudioOptIn[peerId]) {
        return;
    }

    if (outboundAudioCalls[peerId]) {
        outboundAudioCalls[peerId].close();
    }

    const mediaCall = peer.call(peerId, hostAudioStream, {
        metadata: {
            type: "roomAudio"
        }
    });

    outboundAudioCalls[peerId] = mediaCall;

    mediaCall.on("close", () => {
        if (outboundAudioCalls[peerId] === mediaCall) {
            delete outboundAudioCalls[peerId];
        }
    });

    mediaCall.on("error", () => {
        if (outboundAudioCalls[peerId] === mediaCall) {
            delete outboundAudioCalls[peerId];
        }
    });
}

async function startHostAudioBroadcast() {
    if (hostOrUser !== "host") {
        attachMessage("Only the host can start room audio.");
        return;
    }

    if (isHostAudioBroadcasting) {
        attachMessage("Room audio is already running.");
        return;
    }

    try {
        hostAudioStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: false
        });
    } catch (displayErr) {
        try {
            hostAudioStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            attachMessage("Display audio was unavailable. Broadcasting microphone audio instead.");
        } catch (micErr) {
            attachMessage("Unable to start room audio. Check browser permissions and available audio sources.");
            return;
        }
    }

    const audioTrack = hostAudioStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.onended = () => {
            if (isHostAudioBroadcasting) {
                attachMessage("Room audio broadcast ended.");
                stopHostAudioBroadcast(true);
            }
        };
    }

    isHostAudioBroadcasting = true;
    attachMessage("Room audio broadcast started. Members must press 'Enable Room Audio'.");
    broadcast(savedRoom, {
        type: "audioBroadcastAvailable",
        username: "System"
    });

    for (let peerId in connections) {
        startCallToMember(peerId);
    }

    refreshAudioControls();
}

hostAudioToggle.addEventListener("click", async () => {
    if (!inRoom || hostOrUser !== "host") {
        return;
    }

    if (isHostAudioBroadcasting) {
        stopHostAudioBroadcast(true);
        attachMessage("Room audio broadcast stopped.");
    } else {
        await startHostAudioBroadcast();
    }
});

memberAudioEnable.addEventListener("click", () => {
    if (!inRoom || hostOrUser !== "user" || !conn || !conn.open) {
        return;
    }

    conn.send({
        type: "audioOptIn",
        enabled: true
    });

    attachMessage("Audio enabled. Waiting for host broadcast...");
    refreshAudioControls();
});

//just a rewrite so git commit takes this
// HOST: Create room
make.addEventListener("click", () => {
    if (!inRoom) {
        try {
            peer = new Peer(roomCode.value);
        } catch (error) {
            attachMessage(`Failed to create peer: ${error.message}`);
            return;
        }

        peer.on("open", () => {
            attachMessage("Room created. Waiting for peers...");
            inRoom = true;
            hostOrUser = 'host';
            savedUser = username.value;
            savedRoom = roomCode.value;
            
            // Add host to usernames so they can participate in messaging
            usernames[roomCode.value] = username.value;
            
            configureInput(); // host can send too
            refreshAudioControls();
        });

        peer.on("connection", (incomingConn) => {
            const peerId = incomingConn.peer;
            connections[peerId] = incomingConn;

            incomingConn.on("error", (err) => {
                attachMessage(`Connection error with ${usernames[peerId] || peerId}: ${err.message}`);
            });

            incomingConn.on("data", (data) => {
                if (data.type === "intro") {
                    // Save username from the peer
                    usernames[peerId] = data.username;
                    memberAudioOptIn[peerId] = false;
                    attachMessage(`${data.username} joined the room.`);
                    // Optionally notify others
                    broadcast(peerId, {
                        type: "info",
                        text: `${data.username} has joined.`,
                        username: "System"
                    });
                } 

                else if (data.type === "audioOptIn") {
                    memberAudioOptIn[peerId] = Boolean(data.enabled);
                    if (memberAudioOptIn[peerId]) {
                        attachMessage(`${usernames[peerId] || peerId} enabled room audio.`);
                        startCallToMember(peerId);
                    } else if (outboundAudioCalls[peerId]) {
                        outboundAudioCalls[peerId].close();
                    }
                }
                
                else if (data.type === "message") {
                    console.log(`${data.text}`);
                    const user = usernames[peerId] || "Unknown";
                    attachMessage(data.text);
                    
                    const colonIndex = data.text.indexOf(': ');
                    if (colonIndex !== -1) {
                        const rawCommand = data.text.slice(colonIndex + 2);
                        // Try to process as game command (host handles all game logic)
                        if (typeof processGameCommand === 'function') {
                            processGameCommand(peerId, rawCommand);
                        }
                    }
                    
                    broadcast(peerId, {
                        type: "message",
                        text: data.text,
                        username: user
                    });
                }

                else if (data.type === "file") {
                    directory.push({
                        name: data.name,
                        content: data.content
                    });
                }

                else if (data.type === "fileList") {
                    conn.send({
                        type: "fileList",
                        files: directory
                    });
                }
                console.log("message received");
            });

            incomingConn.on("close", () => {
                const user = usernames[peerId] || peerId;
                attachMessage(`${user} disconnected.`);
                broadcast(peerId, {
                    type: "info",
                    text: `${user} has left.`,
                    username: "System"
                });
                delete connections[peerId];
                delete usernames[peerId];
                delete memberAudioOptIn[peerId];
                if (outboundAudioCalls[peerId]) {
                    outboundAudioCalls[peerId].close();
                    delete outboundAudioCalls[peerId];
                }
            });
        });

        peer.on("call", (incomingCall) => {
            incomingCall.close();
        });
    } else {
        attachMessage("Please leave the current room first.");
    }
});

// USER: Join room
join.addEventListener("click", () => {
    if (!inRoom) {
        try {
            peer = new Peer();
        } catch (error) {
            attachMessage(`Failed to create peer: ${error.message}`);
            return;
        }

        peer.on("open", () => {
            conn = peer.connect(roomCode.value); // connect to host

            conn.on("open", () => {
                attachMessage("Connected to host.");
                conn.send({
                    type: "intro",
                    username: username.value
                });

                configureInput();
                inRoom = true;
                hostOrUser = 'user';
                savedUser = username.value;
                savedRoom = roomCode.value;
                refreshAudioControls();
            });

            conn.on("error", (err) => {
                attachMessage(`Connection error: ${err.message}`);
            });

            conn.on("data", (data) => {
                if (typeof data === "object" && data !== null) {
                    if (data.type === "gameState") {
                        attachMessage(data.text);
                        if (data.currentCard) currentCard = data.currentCard;
                        if (data.currentTurn) currentTurn = data.currentTurn;
                    } else if (data.type === "message") {
                        console.log(`${data.text}`);
                        attachMessage(data.text);
                    } else if (data.type === "info") {
                        attachMessage(data.text);
                    } else if (data.type === "error") {
                        attachMessage(`Error: ${data.text}`);
                    }
                    else if (data.type === "audioBroadcastAvailable") {
                        attachMessage("Host audio is available. Press 'Enable Room Audio' to receive it.");
                    }
                    else if (data.type === "audioBroadcastStopped") {
                        attachMessage("Host audio broadcast stopped.");
                        clearMemberAudioState();
                    }
                    else if (data.type === "fileList") {
                        directory = data.files;
                    }
                } else {
                    attachMessage(String(data));
                }
                console.log("message received");
            });
        });

        peer.on("call", (incomingCall) => {
            if (incomingCall.metadata?.type !== "roomAudio") {
                incomingCall.close();
                return;
            }

            incomingCall.answer();

            incomingCall.on("stream", async (remoteStream) => {
                roomAudioElement.srcObject = remoteStream;
                roomAudioElement.style.display = "block";
                try {
                    await roomAudioElement.play();
                } catch (_err) {
                    attachMessage("Press the audio controls to start playback.");
                }
            });

            incomingCall.on("close", () => {
                if (roomAudioCall === incomingCall) {
                    roomAudioCall = null;
                }
                roomAudioElement.pause();
                roomAudioElement.srcObject = null;
                roomAudioElement.style.display = "none";
                refreshAudioControls();
            });

            roomAudioCall = incomingCall;
            refreshAudioControls();
        });
    } else {
        attachMessage("You're already in a room.");
    }
});

// Disconnect logic
disconnect.addEventListener("click", () => {
    if (hostOrUser === 'host') {
        stopHostAudioBroadcast(false);
    } else {
        clearMemberAudioState();
    }

    if (conn) {
        conn.close();
        conn = null;
    }

    if (hostOrUser === 'host') {
        for (let id in connections) {
            connections[id].close();
        }
    }

    attachMessage("Disconnected.");
    inRoom = false;
    hostOrUser = '';
    refreshAudioControls();
});

// Terminal message input
terminalInput.addEventListener("keydown", async (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        return;
    }
    else if (e.key === 'Enter') {
        e.preventDefault();
        let text = terminalInput.textContent.trim();
        let lineText = terminalInput.innerText.trim();
        let textArray = text.split(" ");
        terminalInput.innerHTML = '<br>';

        if (text === "-keygen" && !inRoom) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?";
            let key = "";
            for (let i = 0; i < Math.random()*12+14; i++) {
                key+=chars.charAt(Math.floor(Math.random() * chars.length - 26));
            }
            attachMessage(`Generated key: ${key}`);
            return;
        }

        // Run Python code if input starts with 'python:'
        if (text.startsWith("python: ")) {
            const pyCode = lineText.slice(8).trim();
            attachMessage(pyCode);
            const result = await python(pyCode);
            attachMessage(result);
            return;
        }

        if (textArray[0] === "touch" && textArray.length === 2) {
            if (hostOrUser === "host") {
                directory.push({
                    name: textArray[1],
                    content: ""
                });
            } 
            else if (hostOrUser === "user") {
                conn.send({
                    type: "file",
                    name: textArray[1],
                    content: ""
                });
            }
            attachMessage(`${textArray[1]} created`);
            return;
        }

        if (textArray[0] === "ls") {
            if (hostOrUser === "host") {
                for (let file of directory) {
                attachMessage(file.name);
                }
            }
            else if (hostOrUser === "user") {
                conn.send({
                    type: "fileList"
                });
                for (let file of directory) {
                    attachMessage(file.name);
                }
            }
            return;
        }

        if (textArray[0] === "edit") {
            const name = textArray[1];
            const editedCode = text.slice(6 + name.length).trim();
            for (let file of directory) {
                if (file.name === name) {
                    file.content = editedCode;
                }
            }
        }
    

        if (!text || (savedUser == null)) return;

        // Check if this is a game command (host processes locally)
        if (hostOrUser === 'host' && typeof gamelogic === 'function') {
            const result = gamelogic(text);
            if (result !== null) {
                // It was a game command, don't send as chat message
                return;
            }
        }

        const formattedText = `TerminalCards/${savedRoom}/${savedUser}: ${text}`;
        const msgObj = {
            type: "message",
            text: formattedText,
            username: savedUser
        };
        attachMessage(formattedText);

        // Send message to other players
        if (hostOrUser === 'user' && conn && conn.open) {
            conn.send(msgObj);
        } 
        
        else if (hostOrUser === 'host') {
            broadcast(savedRoom, msgObj);
        }
    }
});

// Broadcast to all peers (host only)
function broadcast(senderId, message) {
    for (let id in connections) {
        if (id !== senderId) {
            connections[id].send(message);
        }
    }
}

// Enable typing
function configureInput() {
    terminalInput.contentEditable = true;
    terminalInput.focus();
}

// Display message in chat
function attachMessage(msg) {
    const actualText = document.createElement("div");
    actualText.textContent = msg;
    body.appendChild(actualText);
}

async function python(pyCode) {
    if (!pyodide) {
                attachMessage("Loading Python runtime...");
                pyodide = await loadPyodide();
            }
            try {
                console.log(`attached message: ${pyCode}`);
                pyCode = pyCode.replace(/\u00A0/g, " ");
                const result = await pyodide.runPythonAsync(pyCode);
                return(`Python output: ${result}`);
            } catch (err) {
                return(`Python error: ${err}`);
            }
}