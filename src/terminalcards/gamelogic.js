// Match It! - play cards matching suit or rank, first to empty hand wins
// Kept as close to the original as possible — only change is accepting
// shared state / callbacks as parameters instead of relying on globals.

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

function drawFromDeck(attachMessage) {
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

function getCurrentPlayerName(usernames) {
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
function broadcastToAll(message, connections, attachMessage) {
    for (let id in connections) {
        connections[id].send({
            type: "info",
            text: message,
            username: "Game"
        });
    }
    attachMessage(message);
}

function sendHandToPlayer(playerId, roomCodeValue, connections, attachMessage) {
    let hand = gameState.playerHands[playerId];
    let handStr = handToString(hand);
    
    if (playerId === roomCodeValue) {
        attachMessage(`Your hand: ${handStr}`);
    } else if (connections[playerId]) {
        connections[playerId].send({
            type: "info",
            text: `Your hand: ${handStr}`,
            username: "Game"
        });
    }
}

function broadcastGameStatus(connections, usernames, attachMessage) {
    let topCardStr = cardToString(gameState.topCard);
    let currentPlayer = getCurrentPlayerName(usernames);
    broadcastToAll(`Top card: ${topCardStr}`, connections, attachMessage);
    broadcastToAll(`Current turn: ${currentPlayer}`, connections, attachMessage);
}

function notifyPlayerTurn(playerId, roomCodeValue, connections, attachMessage) {
    if (playerId === roomCodeValue) {
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
function sendToPlayer(playerId, msg, roomCodeValue, connections, attachMessage) {
    if (playerId === roomCodeValue) {
        attachMessage(msg);
    } else if (connections[playerId]) {
        connections[playerId].send({ type: "info", text: msg, username: "Game" });
    }
}

function startGame(ctx) {
    const { hostOrUser, connections, usernames, roomCodeValue, attachMessage } = ctx;
    if (hostOrUser !== 'host') {
        attachMessage("Only the host can start the game.");
        return;
    }
    
    if (gameState.isActive) {
        attachMessage("Game already in progress!");
        return;
    }
    
    gameState.playerOrder = [roomCodeValue, ...Object.keys(connections)];
    
    if (gameState.playerOrder.length < 1) {
        attachMessage("Need at least 1 player to start.");
        return;
    }
    
    gameState.deck = shuffleDeck(createDeck());
    
    // deal 7 cards to each player
    for (let playerId of gameState.playerOrder) {
        gameState.playerHands[playerId] = [];
        for (let i = 0; i < 7; i++) {
            gameState.playerHands[playerId].push(drawFromDeck(attachMessage));
        }
    }
    
    gameState.topCard = drawFromDeck(attachMessage);
    gameState.currentPlayerIndex = 0;
    gameState.isActive = true;
    gameState.winner = null;
    
    broadcastToAll("Game Started!", connections, attachMessage);
    broadcastToAll("Commands: play [rank] of [suit] | draw | hand | top", connections, attachMessage);
    broadcastToAll("Match the suit OR rank to play a card!", connections, attachMessage);

    for (let playerId of gameState.playerOrder) {
        sendHandToPlayer(playerId, roomCodeValue, connections, attachMessage);
    }
    
    broadcastGameStatus(connections, usernames, attachMessage);
    notifyPlayerTurn(getCurrentPlayerId(), roomCodeValue, connections, attachMessage);
}

function handleDraw(playerId, ctx) {
    const { connections, usernames, roomCodeValue, attachMessage } = ctx;
    if (!gameState.isActive) {
        attachMessage("No game in progress. Type 'start' to begin.");
        return;
    }
    
    if (!isCurrentPlayer(playerId)) {
        sendToPlayer(playerId, `Not your turn! Waiting for ${getCurrentPlayerName(usernames)}`, roomCodeValue, connections, attachMessage);
        return;
    }
    
    let drawnCard = drawFromDeck(attachMessage);
    gameState.playerHands[playerId].push(drawnCard);
    
    sendToPlayer(playerId, `You drew: ${cardToString(drawnCard)}`, roomCodeValue, connections, attachMessage);
    broadcastToAll(`${usernames[playerId] || playerId} drew a card.`, connections, attachMessage);
    
    advanceTurn();
    broadcastGameStatus(connections, usernames, attachMessage);
    notifyPlayerTurn(getCurrentPlayerId(), roomCodeValue, connections, attachMessage);
}

function handlePlay(playerId, rank, suit, ctx) {
    const { connections, usernames, roomCodeValue, attachMessage } = ctx;
    if (!gameState.isActive) {
        attachMessage("No game in progress. Type 'start' to begin.");
        return;
    }
    
    if (!isCurrentPlayer(playerId)) {
        sendToPlayer(playerId, `Not your turn! Waiting for ${getCurrentPlayerName(usernames)}`, roomCodeValue, connections, attachMessage);
        return;
    }
    
    let card = findCardInHand(playerId, rank, suit);
    
    if (!card) {
        sendToPlayer(playerId, `You don't have ${rank} of ${suit}!`, roomCodeValue, connections, attachMessage);
        return;
    }
    
    if (!canPlayCard(card)) {
        sendToPlayer(playerId, `Can't play that! Must match ${gameState.topCard.rank} or ${gameState.topCard.suit}`, roomCodeValue, connections, attachMessage);
        return;
    }
    
    removeCardFromHand(playerId, card);
    gameState.topCard = card;
    
    broadcastToAll(`${usernames[playerId] || playerId} played ${cardToString(card)}!`, connections, attachMessage);
    
    if (checkWinCondition(playerId)) {
        gameState.winner = playerId;
        gameState.isActive = false;
        broadcastToAll("=============================", connections, attachMessage);
        broadcastToAll(`🎉 ${usernames[playerId] || playerId} WINS! 🎉`, connections, attachMessage);
        broadcastToAll("=============================", connections, attachMessage);
        broadcastToAll("Type 'start' to play again!", connections, attachMessage);
        return;
    }
    
    advanceTurn();
    broadcastGameStatus(connections, usernames, attachMessage);
    notifyPlayerTurn(getCurrentPlayerId(), roomCodeValue, connections, attachMessage);
}

function handleShowHand(playerId, ctx) {
    const { connections, roomCodeValue, attachMessage } = ctx;
    if (!gameState.isActive) {
        attachMessage("No game in progress.");
        return;
    }
    sendHandToPlayer(playerId, roomCodeValue, connections, attachMessage);
}

function handleShowTop(playerId, ctx) {
    const { connections, roomCodeValue, attachMessage } = ctx;
    if (!gameState.isActive) {
        attachMessage("No game in progress.");
        return;
    }
    sendToPlayer(playerId, `Top card: ${cardToString(gameState.topCard)}`, roomCodeValue, connections, attachMessage);
}

function handleHelp(playerId, ctx) {
    const { connections, roomCodeValue, attachMessage } = ctx;
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
        sendToPlayer(playerId, line, roomCodeValue, connections, attachMessage);
    }
}

function capitalizeFirst(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// main command parser
export function gamelogic(text, ctx, senderId = null) {
    const { hostOrUser, roomCodeValue, peer, attachMessage } = ctx;
    let playerId = senderId || (hostOrUser === 'host' ? roomCodeValue : peer?.id);
    let parts = text.trim().toLowerCase().split(/\s+/);
    let command = parts[0];
    
    switch (command) {
        case 'start':
            startGame(ctx);
            break;
        case 'draw':
            handleDraw(playerId, ctx);
            break;
        case 'play':
            if (parts.length >= 4 && parts[2] === 'of') {
                let rank = parts[1].toUpperCase();
                let suit = capitalizeFirst(parts[3]);
                handlePlay(playerId, rank, suit, ctx);
            } else {
                attachMessage("Usage: play [rank] of [suit]");
                attachMessage("Example: play K of Hearts");
            }
            break;
        case 'hand':
            handleShowHand(playerId, ctx);
            break;
        case 'top':
            handleShowTop(playerId, ctx);
            break;
        case 'help':
            handleHelp(playerId, ctx);
            break;
        default:
            return null;
    }
    
    return true;
}

// called from interaction when receiving messages
export function processGameCommand(senderId, text, ctx) {
    let command = text.trim().toLowerCase().split(/\s+/)[0];
    let gameCommands = ['start', 'draw', 'play', 'hand', 'top', 'help'];
    
    if (gameCommands.includes(command)) {
        gamelogic(text, ctx, senderId);
        return true;
    }
    return false;
}
