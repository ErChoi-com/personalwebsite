// Turns one log string into a styled terminal line. Peer text only ever
// becomes text nodes (never innerHTML), so a message cannot inject markup.

const CARD = /\b(10|[2-9AKQJ]) of (Hearts|Spades|Diamonds|Clubs)\b/g;
export const SUIT_GLYPH = { Hearts: '♥', Diamonds: '♦', Spades: '♠', Clubs: '♣' };
// Chat lines arrive as `TerminalCards/<room>/<user>: <text>`.
const CHAT = /^TerminalCards\/[^/]*\/([^:]*): ([\s\S]*)$/;
const GAME_KEY = /^(Your hand|Top card|Current turn|You drew): ([\s\S]*)$/;
const TURN = ">>> It's YOUR turn! <<<";

export function isRed(suit) {
  return suit === 'Hearts' || suit === 'Diamonds';
}

export function classifyLine(text, self) {
  const chat = CHAT.exec(text);
  if (chat) return chat[1] === self ? 'self' : 'chat';
  if (/^=+$/.test(text)) return 'rule';
  if (text === TURN) return 'turn';
  if (/ WINS! /.test(text)) return 'win';
  if (GAME_KEY.test(text)) return 'game';
  if (/^Python output:/.test(text)) return 'output';
  if (/error|failed|unable/i.test(text)) return 'error';
  if (/^(Not your turn|You don't have|Can't play|You can only|You already|Stack a 2|Usage:|Example:|No game in progress|Only the host|Game already|Please|You're already|You're watching|Make or join)/.test(text)) {
    return 'warn';
  }
  if (/ played | drew a card| draws \d| passed\.| forgot to call| one card left| left the game|^Reshuffling|^It fits|^Game Started|can't draw/.test(text)) {
    return 'move';
  }
  if (/joined|has left|connected|room created|disconnected|closed the room/i.test(text)) return 'system';
  return 'plain';
}

function cardChip(rank, suit) {
  const chip = document.createElement('span');
  chip.className = `tc-card ${isRed(suit) ? 'red' : 'black'}`;
  const face = document.createElement('span');
  face.setAttribute('aria-hidden', 'true');
  face.textContent = `${rank}${SUIT_GLYPH[suit]}`;
  const spoken = document.createElement('span');
  spoken.className = 'tc-sr-only';
  spoken.textContent = `${rank} of ${suit}`;
  chip.append(face, spoken);
  return chip;
}

// Appends text, drawing every "K of Hearts" as a small playing card.
function appendWithCards(parent, text) {
  let last = 0;
  for (const match of text.matchAll(CARD)) {
    const gap = text.slice(last, match.index);
    // The commas between cards in a hand are noise once cards are chips.
    if (!(last > 0 && gap === ', ')) parent.append(gap);
    parent.append(cardChip(match[1], match[2]));
    last = match.index + match[0].length;
  }
  parent.append(text.slice(last));
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

export function renderLine(text, kind, self) {
  const resolved = kind ?? classifyLine(text, self);
  const line = document.createElement('div');
  line.className = `tc-line tc-${resolved}`;

  const chat = CHAT.exec(text);
  const game = GAME_KEY.exec(text);

  if (resolved === 'rule') {
    line.setAttribute('aria-hidden', 'true');
  } else if ((resolved === 'chat' || resolved === 'self') && chat) {
    line.append(span('tc-who', chat[1]));
    appendWithCards(line, chat[2]);
  } else if (resolved === 'game' && game) {
    line.append(span('tc-key', game[1]));
    appendWithCards(line, game[2]);
  } else if (resolved === 'turn') {
    line.textContent = 'YOUR TURN';
  } else if (resolved === 'win') {
    // Colour emoji don't belong on a phosphor screen.
    line.textContent = text.replace(/\p{Extended_Pictographic}/gu, '').trim();
  } else if (resolved === 'input') {
    const caret = span('tc-caret', '$');
    caret.setAttribute('aria-hidden', 'true');
    line.append(caret, text);
  } else {
    appendWithCards(line, text);
  }
  return line;
}
