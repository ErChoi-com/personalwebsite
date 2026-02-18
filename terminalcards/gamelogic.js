// Match It! - play cards matching suit or rank, first to empty hand wins

let suits = ['Hearts', 'Spades', 'Diamonds', 'Clubs'];
let ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

// game state (host only)
let gameState = {
    isActive: false,
    deck: [],
    topCard: null,
    playerHands: {},
    playerOrder: [],
    currentPlayerIndex: 0,
    winner: null
};

function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function drawFromDeck() {
    if (gameState.deck.length === 0) {
        attachMessage("Deck is empty! Reshuffling...");
        gameState.deck = shuffleDeck(createDeck());
    }
    return gameState.deck.pop();
}

function cardToString(card) {
    return `${card.rank} of ${card.suit}`;
}

function handToString(hand) {
    if (hand.length === 0) return "(empty)";
    return hand.map(cardToString).join(', ');
}

function getCurrentPlayerId() {
    return gameState.playerOrder[gameState.currentPlayerIndex];
}

function getCurrentPlayerName() {
    let playerId = getCurrentPlayerId();
    return usernames[playerId] || playerId;
}

function isCurrentPlayer(playerId) {
    return getCurrentPlayerId() === playerId;
}

function canPlayCard(card) {
    let top = gameState.topCard;
    return card.suit === top.suit || card.rank === top.rank;
}

function findCardInHand(playerId, rank, suit) {
    let hand = gameState.playerHands[playerId];
    if (!hand) return null;
    return hand.find(card => 
        card.rank.toLowerCase() === rank.toLowerCase() && 
        card.suit.toLowerCase() === suit.toLowerCase()
    );
}

function removeCardFromHand(playerId, card) {
    let hand = gameState.playerHands[playerId];
    let index = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
    if (index !== -1) {
        hand.splice(index, 1);
    }
}

function advanceTurn() {
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.playerOrder.length;
}

function checkWinCondition(playerId) {
    return gameState.playerHands[playerId].length === 0;
}

// send message to all players
function broadcastToAll(message) {
    for (let id in connections) {
        connections[id].send({
            type: "info",
            text: message,
            username: "Game"
        });
    }
    attachMessage(message);
}

function sendHandToPlayer(playerId) {
    let hand = gameState.playerHands[playerId];
    let handStr = handToString(hand);
    
    if (playerId === roomCode.value) {
        attachMessage(`Your hand: ${handStr}`);
    } else if (connections[playerId]) {
        connections[playerId].send({
            type: "info",
            text: `Your hand: ${handStr}`,
            username: "Game"
        });
    }
}

function broadcastGameStatus() {
    let topCardStr = cardToString(gameState.topCard);
    let currentPlayer = getCurrentPlayerName();
    broadcastToAll(`Top card: ${topCardStr}`);
    broadcastToAll(`Current turn: ${currentPlayer}`);
}

function notifyPlayerTurn(playerId) {
    if (playerId === roomCode.value) {
        attachMessage(">>> It's YOUR turn! <<<");
    } else if (connections[playerId]) {
        connections[playerId].send({
            type: "info",
            text: ">>> It's YOUR turn! <<<",
            username: "Game"
        });
    }
}

// sends message to specific player
function sendToPlayer(playerId, msg) {
    if (playerId === roomCode.value) {
        attachMessage(msg);
    } else if (connections[playerId]) {
        connections[playerId].send({ type: "info", text: msg, username: "Game" });
    }
}

function startGame() {
    if (hostOrUser !== 'host') {
        attachMessage("Only the host can start the game.");
        return;
    }
    
    if (gameState.isActive) {
        attachMessage("Game already in progress!");
        return;
    }
    
    gameState.playerOrder = [roomCode.value, ...Object.keys(connections)];
    
    if (gameState.playerOrder.length < 1) {
        attachMessage("Need at least 1 player to start.");
        return;
    }
    
    gameState.deck = shuffleDeck(createDeck());
    
    // deal 7 cards to each player
    for (let playerId of gameState.playerOrder) {
        gameState.playerHands[playerId] = [];
        for (let i = 0; i < 7; i++) {
            gameState.playerHands[playerId].push(drawFromDeck());
        }
    }
    
    gameState.topCard = drawFromDeck();
    gameState.currentPlayerIndex = 0;
    gameState.isActive = true;
    gameState.winner = null;
    
    broadcastToAll("Game Started!");
    broadcastToAll("Commands: play [rank] of [suit] | draw | hand | top");
    broadcastToAll("Match the suit OR rank to play a card!");

    for (let playerId of gameState.playerOrder) {
        sendHandToPlayer(playerId);
    }
    
    broadcastGameStatus();
    notifyPlayerTurn(getCurrentPlayerId());
}

function handleDraw(playerId) {
    if (!gameState.isActive) {
        attachMessage("No game in progress. Type 'start' to begin.");
        return;
    }
    
    if (!isCurrentPlayer(playerId)) {
        sendToPlayer(playerId, `Not your turn! Waiting for ${getCurrentPlayerName()}`);
        return;
    }
    
    let drawnCard = drawFromDeck();
    gameState.playerHands[playerId].push(drawnCard);
    
    sendToPlayer(playerId, `You drew: ${cardToString(drawnCard)}`);
    broadcastToAll(`${usernames[playerId] || playerId} drew a card.`);
    
    advanceTurn();
    broadcastGameStatus();
    notifyPlayerTurn(getCurrentPlayerId());
}

function handlePlay(playerId, rank, suit) {
    if (!gameState.isActive) {
        attachMessage("No game in progress. Type 'start' to begin.");
        return;
    }
    
    if (!isCurrentPlayer(playerId)) {
        sendToPlayer(playerId, `Not your turn! Waiting for ${getCurrentPlayerName()}`);
        return;
    }
    
    let card = findCardInHand(playerId, rank, suit);
    
    if (!card) {
        sendToPlayer(playerId, `You don't have ${rank} of ${suit}!`);
        return;
    }
    
    if (!canPlayCard(card)) {
        sendToPlayer(playerId, `Can't play that! Must match ${gameState.topCard.rank} or ${gameState.topCard.suit}`);
        return;
    }
    
    removeCardFromHand(playerId, card);
    gameState.topCard = card;
    
    broadcastToAll(`${usernames[playerId] || playerId} played ${cardToString(card)}!`);
    
    if (checkWinCondition(playerId)) {
        gameState.winner = playerId;
        gameState.isActive = false;
        broadcastToAll("=============================");
        broadcastToAll(`🎉 ${usernames[playerId] || playerId} WINS! 🎉`);
        broadcastToAll("=============================");
        broadcastToAll("Type 'start' to play again!");
        return;
    }
    
    advanceTurn();
    broadcastGameStatus();
    notifyPlayerTurn(getCurrentPlayerId());
}

function handleShowHand(playerId) {
    if (!gameState.isActive) {
        attachMessage("No game in progress.");
        return;
    }
    sendHandToPlayer(playerId);
}

function handleShowTop(playerId) {
    if (!gameState.isActive) {
        attachMessage("No game in progress.");
        return;
    }
    sendToPlayer(playerId, `Top card: ${cardToString(gameState.topCard)}`);
}

function handleHelp(playerId) {
    let helpText = [
        "Commands!",
        "start        - Start a new game (host only)",
        "play [rank] of [suit] - Play a card (e.g. play K of Hearts)",
        "draw         - Draw a card from deck",
        "hand         - Show your current hand",
        "top          - Show the top card",
        "help         - Show this help"
    ];
    
    for (let line of helpText) {
        sendToPlayer(playerId, line);
    }
}

// main command parser
function gamelogic(text, senderId = null) {
    let playerId = senderId || (hostOrUser === 'host' ? roomCode.value : peer.id);
    let parts = text.trim().toLowerCase().split(/\s+/);
    let command = parts[0];
    
    switch (command) {
        case 'start':
            startGame();
            break;
        case 'draw':
            handleDraw(playerId);
            break;
        case 'play':
            if (parts.length >= 4 && parts[2] === 'of') {
                let rank = parts[1].toUpperCase();
                let suit = capitalizeFirst(parts[3]);
                handlePlay(playerId, rank, suit);
            } else {
                attachMessage("Usage: play [rank] of [suit]");
                attachMessage("Example: play K of Hearts");
            }
            break;
        case 'hand':
            handleShowHand(playerId);
            break;
        case 'top':
            handleShowTop(playerId);
            break;
        case 'help':
            handleHelp(playerId);
            break;
        default:
            return null;
    }
    
    return true;
}

function capitalizeFirst(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// called from interaction.js when receiving messages
function processGameCommand(senderId, text) {
    let command = text.trim().toLowerCase().split(/\s+/)[0];
    let gameCommands = ['start', 'draw', 'play', 'hand', 'top', 'help'];
    
    if (gameCommands.includes(command)) {
        gamelogic(text, senderId);
        return true;
    }
    return false;
}