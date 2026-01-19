// attachable card game logic
/* const suits = ['Hearts', 'Spades', 'Diamonds', 'Clubs'];
const ranks = ['Ace', 'King', 'Queen', 'Jack', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const playerCardMap = new Map();
let hand = [];
let pile = []; // basically the cards that aren't in the deck
let deckCount = 0;
let startingCount = 7;
let gameInitialized = false;
let displayAll = false;
let currentTurn = null; // stores the ID of the player whose turn it is
let playerOrder = []; // array to store the order of players
let turnIndex = 0; // keeps track of whose turn it is in the playerOrder
let gameState = "";

let othelloGrid = [];

// pls work?
function startGame(startingCount, gameMode) {
    if (gameInitialized) {
        attachMessage("Game has already been started.");
        return -1;
    }

    else if (hostOrUser === 'user') {
        attachMessage("Can't start game, has to be host.");
    }

    // Initialize turn system with host first
    playerOrder = [roomCode.value, ...Object.keys(connections)];
    turnIndex = 0;
    currentTurn = playerOrder[turnIndex];
    
    // Deal cards to all players including host
    for (let id of playerOrder) {
        const tempHand = [];
        for (let i = 0; i < startingCount; i++) {
            tempHand.push(drawCard());
        }
        playerCardMap.set(id, tempHand);
    }

    // Announce game start and first turn
    attachMessage(`Game started! It's ${usernames[currentTurn]}'s turn.`);

    switch(gameMode) {
        case("poker"):
            pokerRules();
            gameState
            break;
        case("demo"):
            simplestDemoRules();
            break;
        case("othello"):
            othello();
            break;
    }
}

function gamelogic(text) {
    text = text.trim().toLowerCase().split(" ");
    input(text);
    return null;
}

function input(text) {
    // Get player ID based on whether they're host or user
    const playerId = hostOrUser === 'host' ? roomCode.value : peer.id;

    if (gameState === "poker") {
        pokerInput(text);
    }
    
    if (gameState === "othello") {
        processOthello(text);
    }

    return text;
}

function goThroughTurn() {
    turnIndex = (turnIndex + 1) % playerOrder.length;
    currentTurn = playerOrder[turnIndex];
    
    // Get the player's display name (host or username)
    const playerName = currentTurn === roomCode.value ? savedUser : usernames[currentTurn];
    const turnMessage = `It's ${playerName}'s turn.`;
    
    attachMessage(turnMessage);
    
    // Host specific: notify all players about turn change
    if (hostOrUser === 'host') {
        // Broadcast general message to everyone
        broadcast(null, {
            type: "info",
            text: turnMessage,
            username: "System"
        });

        // Send direct turn status to each player
        for (let id in connections) {
            const isCurrent = id === currentTurn;
            connections[id].send({
                type: "turn_status",
                text: isCurrent ? "It's your turn!" : `Waiting for ${playerName} to play...`,
                isYourTurn: isCurrent,
                username: "System"
            });
        }

        // Handle host's own turn status
        if (currentTurn === roomCode.value) {
            attachMessage("It's your turn!");
        }
    }
}

function isPlayerTurn(playerId) {
    const expectedId = hostOrUser === 'host' ? roomCode.value : peer.id;
    return currentTurn === expectedId;
}

function validateTurn(playerId, action) {
    if (!isPlayerTurn(playerId)) {
        attachMessage("It's not your turn!");
        return false;
    }
    return true;
}

// othello code now
function othelloDisplay() {
    attachMessage("Grid is: ")
    for (let i = 0; i < othelloGrid.length; i++) {
        let row = "";
        let bottom = "";
        for (let j = 0; j < othelloGrid[i].length; j++) {
            row += othelloGrid[i][j] + " | ";
            bottom += "-----";
        }
        console.log(row);
        console.log(bottom);
        attachMessage(row);
    }
}

function othello(gridCount) {
    let Xcounter;
    let Ocounter;

    if (Object.keys(connections).length > 1) {
        attachMessage("This is a two player game");
        return;
    }

    for (let i = 0; i < gridCount; i++) {
        othelloGrid[i] = [];
        for (let j = 0; j < gridCount; j++) {
            othelloGrid[i][j] = " ";
        }
    }
    // it's a two player game with a tile of grids
    // works by just placing the pieces on the coordinates
}

function processOthello(text) {
        if (input(text)[0] === "othelloDisplay") {
            othelloDisplay();
        }

            if (parseInt(input(text.split)[1]) && parseInt(input(text.split)[4])) {
                let x = parseInt(input(text.split)[1]);
                let y = parseInt(input(text.split)[4]);
                if (othelloGrid[x][y] === " ") {
                    othelloGrid[x][y] = turn === "host" ? "X" : "O";
                    turn = turn === "host" ? "user" : "host";
                } else {
                    attachMessage("Invalid move! Try again.");
                }
            }
            turn = turn === "host" ? "user" : "host"
            attachMessage(`It's ${turn}'s turn`);


        if (Xcounter > Math.pow(gridCount, 2) || Ocounter > Math.pow(gridCount, 2) ) {
            let winner = Xcounter > Ocounter ? "X" : "O";
            attachMessage(`${winner} wins!`);
        }
}

//Othello code ends here

/* STOP HERE




YES HERE



STOP


WHY AM I DOING THIS? BECAUSE IT'S FUCKING HARD TO KEEP TRACK OF STUFF

⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠞⠛⠉⢙⡛⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⠋⠀⠀⠀⢰⠁⠀⠀⠉⢻⣷⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⠇⠀⠀⠀⠀⠘⠀⠀⠀⠀⠀⠹⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡟⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠜⢹⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⡶⠶⠮⠭⠵⢖⠒⠿⢤⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣠⡶⠿⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠲⣄⡀⠀⠀⠀⠀⠀⣰⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⣴⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠚⠿⡷⣄⣀⣴⠞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣠⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠪⣻⣄⠀⠀⠀⣀⣀⠤⠴⠒⠚⢋⣭⣟⣯⣍⠉⠓⠒⠦⠤⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⣼⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⡝⣧⠔⠋⠁⠀⣀⠤⠔⣶⣿⡿⠿⠿⠿⠍⠉⠒⠢⢤⣀⠈⠑⠦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⣼⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡦⠤⢤⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣞⣧⠤⠒⠉⠀⠀⠾⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢲⣴⣾⣷⢤⡀⠀⠀⠀⠀⠀⠀⠀
⢰⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡜⠀⠀⠀⠀⠈⠙⠳⢦⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⠟⢿⣿⣧⠙⢦⠀⠀⠀⠀⠀⠀
⡜⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠿⣦⣄⡀⠀⠐⢄⠀⠀⠀⢻⡇⠀⠀⠀⠀⡠⢊⣭⣬⣭⣶⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢿⡀⠀⠑⣄⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣦⡀⠀⠑⢄⣀⢿⠇⠀⠀⠀⡜⣼⠟⠁⠀⠀⠉⢿⡄⠀⠀⠀⠀⣠⠤⠤⠤⣀⡀⠈⠙⡄⠀⠈⢆⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣝⢦⡀⠀⣠⡞⠢⢄⠀⡜⣼⠁⣠⣴⣶⢦⡀⠀⢻⠀⠀⢀⣎⡴⠟⠛⠛⠶⣝⢦⠀⠘⡄⠀⠈⢧⠀⠀
⢢⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣧⣄⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢦⢻⡾⠋⠀⣀⣀⠁⠁⡇⢰⢿⣄⣿⣎⢷⠀⢸⡇⠀⢸⡝⢀⣤⣄⡀⠀⠙⢷⡀⠀⢱⠀⠀⠈⡇⠀
⠸⡆⠀⠀⠀⠀⠀⠀⠀⠀⡸⠀⠀⠈⠙⣳⢦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠟⣧⠀⢀⣀⣀⡉⠱⣿⣼⣆⢿⠻⣯⡞⠀⢸⡇⠀⢸⣷⣏⢙⣿⡻⡆⠀⠀⢳⠀⠀⠀⠀⠀⢸⡀
⠀⢳⡀⠀⠀⠀⠀⠀⠉⠚⠁⠀⠀⠀⠀⠀⠉⠻⢿⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⣰⡏⠈⠁⠀⠀⠉⠢⠈⠛⢻⣿⠿⠛⠁⢀⣿⠇⠀⠈⣿⣿⢿⡟⣧⡷⠀⠀⢸⡄⠀⠀⠀⠀⠈⡇
⠀⠈⢷⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⢧⡀⠀⠀⠀⠢⠤⠔⡽⠁⠚⠉⠉⠉⢗⢷⣄⡠⣀⢻⣆⣀⣠⡿⠋⠀⠀⠀⠈⢿⡷⠿⠟⠁⠀⠀⣼⠀⠀⠀⠀⠀⠀⢱
⠀⠀⠀⠻⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢣⠻⡄⠀⢀⣀⡤⠞⠁⠀⠀⠀⠀⠀⠘⢦⡈⠁⠀⠀⠸⡟⠉⠀⠀⠀⠀⠀⠀⠀⠙⢦⣀⣤⡶⠟⠉⠙⠒⠀⠀⠀⠀⢘
⠀⠀⠀⠀⠈⠳⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⡀⠀⡇⣿⠛⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣤⡀⠀⠈⠁⠀⠀⠀⠀⠀⠀⠀⠀⢠⠞⠍⠠⠤⠒⠂⢄⠀⠀⠀⠀⠀⢸
⠀⠀⠀⠀⠀⠀⠈⠙⠲⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢀⣽⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⡉⠓⠦⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⣉⡿⠓⠲⠄⠀⠀⠀⠀⡆
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠶⢤⣤⣄⣀⣠⣤⡤⠶⠛⣿⡀⠀⢢⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣄⠀⠀⠉⠙⠒⠲⠤⠤⠤⣤⣤⡤⠖⠚⠁⠀⠀⠀⠀⠀⢰⠃
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣷⠀⠀⠱⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣦⣄⡀⠀⠀⠀⢀⣼⣿⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡞⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣧⡀⠀⠙⢄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢫⠙⢻⣿⣿⣿⣿⣿⣿⣿⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡼⠁⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢳⡱⡀⠀⠀⠣⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠳⣔⢹⡉⢻⣿⣿⣿⣿⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡞⠁⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣆⠀⠀⠈⠢⡀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠳⣥⣠⣹⣿⡿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠞⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠳⣕⢄⠀⠀⠈⠂⠀⠀⠀⠀⠀⠀⠀⠈⠓⠢⠌⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠃⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⢷⡦⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠔⠋⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠺⢕⣦⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⠴⠚⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠛⠻⠤⢄⣀⣀⣀⣀⣀⣀⣠⠤⠴⠒⠊⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
*/
/*
function drawCard() {
    if (pile.length === 52) {
        pile = [];
        deckCount++;
    }

    const suit = suits[Math.floor(Math.random() * suits.length)];
    const rank = ranks[Math.floor(Math.random() * ranks.length)];
    const card = {suit, rank};

    if (pileSearch(card)) {
        return drawCard();
    }

    hand.push(card);
    pile.push(card);
    return card;
}

function playCard(text) {
    if (handSearch(text)) {
        hand = hand.filter(card => card.rank !== cardFormat.rank && card.suit !== cardFormat.suit);
        return 0;
    }
    else {
        attachMessage("Card doesn't exist in your hand.");
        return -1;
    }
}

// the start of the search for cards thing in hand
function handSearch(text) {
    const card = text.split(" ");
    // format should be "play 10 of suits" or something like that
    const cardFormat = {suit: card[1], rank: card[3]};
    return hand.find(card => card.rank === cardFormat.rank && card.suit === cardFormat.suit);
}

function handSearch({suit, rank}) {
    return hand.find(card => card.rank === rank && card.suit === suit);
}
// end of it

//start of the search for cards thing in pile
function pileSearch(text) {
    const card = text.split(" ");
    // format should be "play 10 of suits" or something like that
    const cardFormat = {suit: card[1], rank: card[3]};
    return pile.find(card => card.rank === cardFormat.rank && card.suit === cardFormat.suit);
}

function pileSearch({suit, rank}) {
    return pile.find(card => card.rank === rank && card.suit === suit);
}
//the end of searching for it
/*
function pokerInput(text) {
    if (text[0] === "draw") {
        if (!validateTurn(playerId, 'draw')) return;
        const drawnCard = drawCard();
        attachMessage(`You drew a ${drawnCard.rank} of ${drawnCard.suit}`);
        goThroughTurn(); // Move to next player after drawing
        return;
    }

    if (text[0] === "play") {
        if (!validateTurn(playerId, 'play')) return;
        const result = playCard(text);
        if (result === 0) {
            goThroughTurn(); // Move to next player after playing
        }
        return;
    }

    if (text[0] === "display") {
        const displayHand = hand.map(card => `${card.rank} of ${card.suit}`).join(", "); 
        //difficult line, essentially internal function runs and new array is printed through use of line, then joined line through use of ","                                                                                    
        if (displayAll) {
            playerCardMap.forEach((id, cards) => {
                attachMessage(`${id}: ${cards.map(card => `${card.rank} of ${card.suit}`).join(", ")}`); // Display all players' hands
            });
        }
        else {
            attachMessage(`Your hand: ${displayHand}`);
        }
        return;
    }

    if (text[0] === "start") {
        startGame(text[1], text[2]);
        return;
    }
    

    if (text[0] === "end") {
        endGame();
        return;
    }
}

function pokerRules() {
    gameState = "poker";
}

// Game state variables
let currentCard = null; // The current card on top of the play pile
let gameWinner = null;

function simplestDemoRules() {
    gameInitialized = true;
    gameState = "demo";
    
    // Draw and set the first card
    currentCard = drawCard();
    pile.pop(); // Remove from player's hand since it's the starting card
    hand.pop();

    attachMessage("=== Simple Demo Game Started ===");
    attachMessage("Rules:");
    attachMessage("1. Each player starts with 7 cards");
    attachMessage("2. Play cards that match either the suit OR rank of the top card");
    attachMessage("3. Commands:");
    attachMessage("   - Type 'draw' to draw a card");
    attachMessage("   - Type 'play [rank] of [suit]' to play a card");
    attachMessage("   - Type 'display' to see your hand");
    attachMessage("4. First player to play all their cards wins!");
    attachMessage(`\nStarting card is: ${currentCard.rank} of ${currentCard.suit}`);
    
    return "Game started!";
}

// Check if a card can be legally played
function isValidPlay(card) {
    if (!currentCard) return false;
    return card.suit === currentCard.suit || card.rank === currentCard.rank;
}

// Override the playCard function to include game rules
function playCard(text) {
    const card = text.split(" ");
    const cardToPlay = {suit: card[3], rank: card[1]};
    
    // Check if player has this card
    if (!handSearch(cardToPlay)) {
        attachMessage("Card doesn't exist in your hand.");
        return -1;
    }

    // Check if it's a valid play
    if (!isValidPlay(cardToPlay)) {
        attachMessage(`Invalid play! You must play a ${currentCard.rank} or a ${currentCard.suit}`);
        return -1;
    }

    // Remove card from hand
    hand = hand.filter(c => !(c.rank === cardToPlay.rank && c.suit === cardToPlay.suit));
    
    // Update current card
    currentCard = cardToPlay;
    
    // Check for win condition
    if (hand.length === 0) {
        gameWinner = savedUser;
        attachMessage(`🎉 ${gameWinner} wins the game! 🎉`);
        return 1;
    }

    attachMessage(`Played ${cardToPlay.rank} of ${cardToPlay.suit}`);
    return 0;
}

// Override drawCard to include game rules
function drawCard() {
    if (pile.length === 52) {
        pile = [];
        deckCount++;
    }

    const suit = suits[Math.floor(Math.random() * suits.length)];
    const rank = ranks[Math.floor(Math.random() * ranks.length)];
    const card = {suit, rank};

    if (pileSearch(card)) {
        return drawCard();
    }

    hand.push(card);
    pile.push(card);
    
    // Announce what was drawn
    attachMessage(`Drew a ${card.rank} of ${card.suit}`);
    
    return card;
}
*/
