let peer;
let conn;
let savedUser;
let savedRoom;
let hostOrUser = '';
let inRoom = false;
let pyodide = null; // Pyodide instance

// For hosts only: connections and usernames
const connections = {}; // key: peer ID => conn
const usernames = {};   // key: peer ID => username
let directory = [];

// UI references
const username = document.getElementById("username");
const roomCode = document.getElementById("roomCode");
const make = document.getElementById("make");
const join = document.getElementById("join");
const disconnect = document.getElementById("disconnect");
const body = document.getElementById("body");
const terminalInput = document.getElementById("terminal-input");

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
                    attachMessage(`${data.username} joined the room.`);
                    // Optionally notify others
                    broadcast(peerId, {
                        type: "info",
                        text: `${data.username} has joined.`,
                        username: "System"
                    });
                } 
                
                else if (data.type === "message") {
                    console.log(`${data.text}`);
                    const user = usernames[peerId] || "Unknown";
                    attachMessage(data.text);
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
            });
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
                    else if (data.type === "fileList") {
                        directory = data.files;
                    }
                } else {
                    attachMessage(String(data));
                }
                console.log("message received");
            });
        });
    } else {
        attachMessage("You're already in a room.");
    }
});

// Disconnect logic
disconnect.addEventListener("click", () => {
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