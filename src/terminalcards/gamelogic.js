// Switch: a modern take on Crazy Eights, played with a standard deck.
//
// Match the suit or rank of the top card. Action cards:
//   8  wild: play it on anything and name the next suit
//   2  the next player draws two, unless they stack another 2 (penalties add up)
//   J  skips the next player
//   Q  reverses the turn order (with two players it works like a skip)
// Can't play? Draw one card. If it fits you may play it, otherwise pass.
// Going down to one card? Add "last" to your play, or draw two as a penalty.
//
// The host runs the game. Every move is announced as text, and each player
// also gets a private table view (their own hand, everyone else's card count).

const suits = ['Hearts', 'Spades', 'Diamonds', 'Clubs'];
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const actionRanks = ['8', '2', 'J', 'Q'];
const HAND_SIZE = 7;
// Seven-card hands for six players still leave a real deck; anyone else watches.
const MAX_SEATS = 6;

// A whole line that is a game command. Chat such as "pass the salt" or
// "play again?" stays chat; "play <rank> of ..." is still caught so typos get help.
const COMMAND = /^(start|draw|pass|hand|top|help)$|^play\s+\S+\s+of\b/i;

const PLAY = /^play\s+(10|[2-9akqj])\s+of\s+(hearts|spades|diamonds|clubs)(?:\s+as\s+(hearts|spades|diamonds|clubs))?(\s+last)?$/i;

// game state (host only)
let game = freshGame();

function freshGame() {
    return {
        isActive: false,
        deck: [],
        discard: [],
        topCard: null,
        activeSuit: null,
        playerHands: {},
        playerOrder: [],
        currentPlayerIndex: 0,
        direction: 1,
        pendingDraw: 0,
        drawnCard: null,
        startedWith: 0,
        winner: null
    };
}

export function resetGame() {
    game = freshGame();
}

export function isGameCommand(text) {
    return COMMAND.test(text.trim());
}

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

function cardToString(card) {
    return `${card.rank} of ${card.suit}`;
}

function handToString(hand) {
    if (hand.length === 0) return "(empty)";
    return hand.map(cardToString).join(', ');
}

function sameCard(a, b) {
    return Boolean(a && b) && a.rank === b.rank && a.suit === b.suit;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ─── Messaging ───

function nameOf(playerId, ctx) {
    return ctx.usernames[playerId] || playerId;
}

// send message to all players
function say(ctx, message) {
    for (let id in ctx.connections) {
        ctx.connections[id].send({ type: "info", text: message, username: "Game" });
    }
    ctx.attachMessage(message);
}

// sends message to specific player
function tell(ctx, playerId, message) {
    if (playerId === ctx.roomCodeValue) {
        ctx.attachMessage(message);
    } else if (ctx.connections[playerId]) {
        ctx.connections[playerId].send({ type: "info", text: message, username: "Game" });
    }
}

// ─── Turn bookkeeping ───

function currentPlayerId() {
    return game.playerOrder[game.currentPlayerIndex];
}

function indexAfter(steps) {
    const n = game.playerOrder.length;
    return (((game.currentPlayerIndex + game.direction * steps) % n) + n) % n;
}

function advance(steps = 1) {
    game.currentPlayerIndex = indexAfter(steps);
    game.drawnCard = null;
}

function isPlayable(card) {
    if (game.pendingDraw > 0) return card.rank === '2';
    if (game.drawnCard) return sameCard(card, game.drawnCard);
    return card.rank === '8' || card.suit === game.activeSuit || card.rank === game.topCard.rank;
}

// Draws from the pile, reshuffling the discards back in when it runs out.
function drawCards(count, ctx) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
        if (game.deck.length === 0) {
            if (game.discard.length === 0) break;
            game.deck = shuffleDeck(game.discard);
            game.discard = [];
            say(ctx, "Reshuffling the discard pile into the deck.");
        }
        drawn.push(game.deck.pop());
    }
    return drawn;
}

// ─── Table views ───

function tableFor(viewerId, ctx) {
    const current = currentPlayerId();
    const yourTurn = game.isActive && viewerId === current;
    const hand = game.playerHands[viewerId] || [];
    return {
        active: game.isActive,
        top: game.topCard,
        activeSuit: game.activeSuit,
        pendingDraw: game.pendingDraw,
        direction: game.direction,
        deckCount: game.deck.length,
        discardCount: game.discard.length,
        players: game.playerOrder.map((id) => ({
            name: nameOf(id, ctx),
            count: (game.playerHands[id] || []).length,
            current: game.isActive && id === current,
            you: id === viewerId
        })),
        hand: hand.map((card) => ({ ...card, playable: yourTurn && isPlayable(card) })),
        inGame: game.playerOrder.includes(viewerId),
        yourTurn,
        canDraw: yourTurn && !game.drawnCard,
        canPass: yourTurn && Boolean(game.drawnCard),
        winner: game.winner ? nameOf(game.winner, ctx) : null
    };
}

// Sends every player (and anyone watching) their own private view.
export function publishTables(ctx) {
    if (!game.topCard) return;
    const viewers = [ctx.roomCodeValue, ...Object.keys(ctx.connections)];
    for (let id of viewers) {
        const table = tableFor(id, ctx);
        if (id === ctx.roomCodeValue) {
            ctx.onTable?.(table);
        } else {
            ctx.connections[id]?.send({ type: "table", table });
        }
    }
}

function announceTurn(ctx) {
    const id = currentPlayerId();
    const suitNote = game.activeSuit !== game.topCard.suit ? ` (suit is ${game.activeSuit})` : '';
    say(ctx, `Top card: ${cardToString(game.topCard)}${suitNote}`);
    say(ctx, `Current turn: ${nameOf(id, ctx)}`);
    tell(ctx, id, ">>> It's YOUR turn! <<<");
    tell(ctx, id, `Your hand: ${handToString(game.playerHands[id])}`);
    if (game.pendingDraw > 0) {
        tell(ctx, id, `Stack a 2 or type draw to take ${game.pendingDraw} cards.`);
    }
    publishTables(ctx);
}

function endGame(winnerId, ctx) {
    game.isActive = false;
    game.winner = winnerId;
    say(ctx, "=============================");
    say(ctx, `🎉 ${nameOf(winnerId, ctx)} WINS! 🎉`);
    say(ctx, "=============================");
    say(ctx, "The host can type 'start' to play again.");
    publishTables(ctx);
}

// ─── Commands ───

function needsTurn(playerId, ctx) {
    if (!game.isActive) {
        tell(ctx, playerId, "No game in progress. The host can type 'start'.");
        return false;
    }
    if (!game.playerOrder.includes(playerId)) {
        tell(ctx, playerId, "You're watching this game. Wait for the next one.");
        return false;
    }
    if (currentPlayerId() !== playerId) {
        tell(ctx, playerId, `Not your turn! Waiting for ${nameOf(currentPlayerId(), ctx)}.`);
        return false;
    }
    return true;
}

function startGame(playerId, ctx) {
    const { roomCodeValue, connections } = ctx;
    if (playerId !== roomCodeValue) {
        tell(ctx, playerId, "Only the host can start the game.");
        return;
    }
    if (game.isActive) {
        tell(ctx, playerId, "Game already in progress!");
        return;
    }

    game = freshGame();
    game.playerOrder = [roomCodeValue, ...Object.keys(connections)].slice(0, MAX_SEATS);
    game.startedWith = game.playerOrder.length;
    game.deck = shuffleDeck(createDeck());

    for (let id of game.playerOrder) {
        game.playerHands[id] = game.deck.splice(-HAND_SIZE);
    }

    // Start on a plain card: action cards go back under the deck.
    let starter = game.deck.pop();
    for (let tries = game.deck.length; tries > 0 && actionRanks.includes(starter.rank); tries--) {
        game.deck.unshift(starter);
        starter = game.deck.pop();
    }
    game.topCard = starter;
    game.activeSuit = starter.suit;
    game.isActive = true;

    say(ctx, "Game Started! Switch rules: 8 is wild, 2 makes the next player draw two (stack them), J skips, Q reverses.");
    say(ctx, "Type help for the commands.");
    const watching = Object.keys(connections).length + 1 - game.playerOrder.length;
    if (watching > 0) say(ctx, `The table seats ${MAX_SEATS}, so ${watching} will watch this round.`);
    announceTurn(ctx);
}

function handlePlay(playerId, rank, suit, chosenSuit, calledLast, ctx) {
    if (!needsTurn(playerId, ctx)) return;

    const hand = game.playerHands[playerId];
    const card = hand.find((c) => c.rank === rank && c.suit === suit);
    if (!card) {
        tell(ctx, playerId, `You don't have ${rank} of ${suit}!`);
        return;
    }
    if (!isPlayable(card)) {
        if (game.pendingDraw > 0) {
            tell(ctx, playerId, `You can only stack a 2 now, or type draw to take ${game.pendingDraw} cards.`);
        } else if (game.drawnCard) {
            tell(ctx, playerId, `You can only play the card you drew (${cardToString(game.drawnCard)}), or pass.`);
        } else {
            tell(ctx, playerId, `Can't play that! Match ${game.activeSuit} or ${game.topCard.rank}, or play an 8.`);
        }
        return;
    }

    hand.splice(hand.indexOf(card), 1);
    game.discard.push(game.topCard);
    game.topCard = card;
    game.activeSuit = card.rank === '8' ? chosenSuit || card.suit : card.suit;

    const name = nameOf(playerId, ctx);
    let steps = 1;
    let effect = '';
    if (card.rank === '2') {
        game.pendingDraw += 2;
        effect = ` Next player draws ${game.pendingDraw} unless they stack a 2.`;
    } else if (card.rank === 'J') {
        steps = 2;
        effect = ` ${nameOf(game.playerOrder[indexAfter(1)], ctx)} is skipped.`;
    } else if (card.rank === 'Q') {
        game.direction *= -1;
        if (game.playerOrder.length === 2) steps = 2;
        effect = " Turn order reversed.";
    } else if (card.rank === '8') {
        effect = ` The suit is now ${game.activeSuit}.`;
    }
    say(ctx, `${name} played ${cardToString(card)}!${effect}`);

    if (hand.length === 0) {
        endGame(playerId, ctx);
        return;
    }
    if (hand.length === 1) {
        if (calledLast) {
            say(ctx, `${name} has one card left!`);
        } else {
            hand.push(...drawCards(2, ctx));
            say(ctx, `${name} forgot to call last card and draws 2.`);
        }
    }

    advance(steps);
    announceTurn(ctx);
}

function handleDraw(playerId, ctx) {
    if (!needsTurn(playerId, ctx)) return;
    const name = nameOf(playerId, ctx);
    const hand = game.playerHands[playerId];

    if (game.drawnCard) {
        tell(ctx, playerId, `You already drew. Play ${cardToString(game.drawnCard)} or pass.`);
        return;
    }

    if (game.pendingDraw > 0) {
        const cards = drawCards(game.pendingDraw, ctx);
        hand.push(...cards);
        game.pendingDraw = 0;
        tell(ctx, playerId, `You drew: ${handToString(cards)}`);
        say(ctx, `${name} draws ${cards.length}.`);
        advance();
        announceTurn(ctx);
        return;
    }

    const [card] = drawCards(1, ctx);
    if (!card) {
        say(ctx, `${name} can't draw: the deck is empty, so they pass.`);
        advance();
        announceTurn(ctx);
        return;
    }
    hand.push(card);
    tell(ctx, playerId, `You drew: ${cardToString(card)}`);

    if (card.rank === '8' || card.suit === game.activeSuit || card.rank === game.topCard.rank) {
        game.drawnCard = card;
        tell(ctx, playerId, "It fits! Play it or type pass.");
        say(ctx, `${name} drew a card.`);
        publishTables(ctx);
        return;
    }

    say(ctx, `${name} drew a card and passed.`);
    advance();
    announceTurn(ctx);
}

function handlePass(playerId, ctx) {
    if (!needsTurn(playerId, ctx)) return;
    if (!game.drawnCard) {
        tell(ctx, playerId, "You can only pass after drawing a card that fits.");
        return;
    }
    say(ctx, `${nameOf(playerId, ctx)} passed.`);
    advance();
    announceTurn(ctx);
}

// A player left the room: take them out so the game never waits on them.
export function removePlayer(playerId, ctx) {
    const index = game.playerOrder.indexOf(playerId);
    if (!game.isActive || index === -1) return;

    const wasCurrent = index === game.currentPlayerIndex;
    game.discard.push(...game.playerHands[playerId]);
    delete game.playerHands[playerId];
    game.playerOrder.splice(index, 1);
    say(ctx, `${nameOf(playerId, ctx)} left the game.`);

    if (game.playerOrder.length === 0) {
        resetGame();
        return;
    }
    const n = game.playerOrder.length;
    if (wasCurrent) {
        // The seat after the leaver, in the direction of play.
        game.currentPlayerIndex = game.direction === 1 ? index % n : (index - 1 + n) % n;
    } else if (index < game.currentPlayerIndex) {
        game.currentPlayerIndex--;
    }

    if (game.startedWith > 1 && game.playerOrder.length === 1) {
        endGame(game.playerOrder[0], ctx);
    } else if (wasCurrent) {
        game.drawnCard = null;
        announceTurn(ctx);
    } else {
        publishTables(ctx);
    }
}

function handleHelp(playerId, ctx) {
    const helpText = [
        "Commands:",
        "start                       deal a new game (host only)",
        "play 7 of Clubs             play a card that matches the suit or rank",
        "play 8 of Hearts as Spades  8s are wild: name the next suit",
        "play 5 of Clubs last        add 'last' when you go down to one card",
        "draw                        draw a card, or take a stacked penalty",
        "pass                        keep the card you just drew",
        "hand / top                  show your hand or the top card",
        "Rules: 2 = next player draws two (stackable), J = skip, Q = reverse."
    ];
    for (let line of helpText) tell(ctx, playerId, line);
}

// main command parser
export function gamelogic(text, ctx, senderId = null) {
    const { hostOrUser, roomCodeValue, peer } = ctx;
    const playerId = senderId || (hostOrUser === 'host' ? roomCodeValue : peer?.id);
    const command = text.trim().toLowerCase().split(/\s+/)[0];

    switch (command) {
        case 'start':
            startGame(playerId, ctx);
            break;
        case 'play': {
            const match = PLAY.exec(text.trim());
            if (!match) {
                tell(ctx, playerId, "Usage: play [rank] of [suit] (e.g. play K of Hearts)");
                tell(ctx, playerId, "Example: play 8 of Clubs as Hearts, or add 'last' at the end.");
                break;
            }
            handlePlay(
                playerId,
                match[1].toUpperCase(),
                capitalizeFirst(match[2]),
                match[3] ? capitalizeFirst(match[3]) : null,
                Boolean(match[4]),
                ctx
            );
            break;
        }
        case 'draw':
            handleDraw(playerId, ctx);
            break;
        case 'pass':
            handlePass(playerId, ctx);
            break;
        case 'hand':
            if (!game.isActive) tell(ctx, playerId, "No game in progress.");
            else tell(ctx, playerId, `Your hand: ${handToString(game.playerHands[playerId] || [])}`);
            break;
        case 'top':
            if (!game.isActive) tell(ctx, playerId, "No game in progress.");
            else tell(ctx, playerId, `Top card: ${cardToString(game.topCard)} (suit is ${game.activeSuit})`);
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
    if (!isGameCommand(text)) return false;
    gamelogic(text, ctx, senderId);
    return true;
}
