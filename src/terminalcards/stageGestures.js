// Turns scroll gestures (wheel, trackpad, touch, keys) into single steps:
// one gesture moves the page one stage forward or back, never a free scroll.

const QUIET_MS = 220; // a gesture's trailing events (trackpad momentum) must stop this long

// Can this element (or an ancestor inside the page) still scroll in direction
// dy on its own? Then the gesture belongs to it, not to the page.
function scrollsInside(target, dy, page) {
  if (!(target instanceof Element)) return false;
  for (let el = target; el && el !== page; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (!/(auto|scroll)/.test(style.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
}

function isTyping(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

// onStep(+1 | -1) moves a stage; onJump('first' | 'last') goes to an end.
// busyMs is how long a step's animation runs; gestures during it are absorbed.
export function createStageGestures(page, { onStep, onJump, busyMs }) {
  let busyUntil = 0;
  let quietUntil = 0;
  let innerUntil = 0;
  let touchY = null;
  let touchX = 0;

  function step(dir) {
    const now = performance.now();
    // Still moving, or the same gesture still trailing: absorb it and keep waiting.
    if (now < busyUntil || now < quietUntil) {
      quietUntil = Math.max(quietUntil, now + QUIET_MS);
      return;
    }
    // A gesture that was just scrolling the log must not, on reaching the log's
    // edge, carry on and move the page. That takes a fresh gesture.
    if (now < innerUntil) {
      innerUntil = now + QUIET_MS;
      return;
    }
    busyUntil = now + busyMs;
    quietUntil = busyUntil + QUIET_MS;
    onStep(dir);
  }

  function onWheel(e) {
    if (Math.abs(e.deltaY) < 2 || e.ctrlKey) return; // ctrl+wheel is pinch-zoom
    if (scrollsInside(e.target, e.deltaY, page)) {
      innerUntil = performance.now() + QUIET_MS;
      return;
    }
    e.preventDefault();
    step(e.deltaY > 0 ? 1 : -1);
  }

  function onTouchStart(e) {
    touchY = e.touches[0].clientY;
    touchX = e.touches[0].clientX;
  }
  function onTouchMove(e) {
    if (touchY === null) return;
    const dy = touchY - e.touches[0].clientY;
    // Sideways swipes (through the hand of cards) scroll natively.
    if (Math.abs(touchX - e.touches[0].clientX) > Math.abs(dy)) return;
    if (scrollsInside(e.target, dy, page)) {
      innerUntil = performance.now() + QUIET_MS;
      return;
    }
    e.preventDefault();
    if (Math.abs(dy) > 40) {
      step(dy > 0 ? 1 : -1);
      touchY = null;
    }
  }

  function onKey(e) {
    if (isTyping(document.activeElement) || e.altKey || e.ctrlKey || e.metaKey) return;
    // Space on a focused button or link presses it.
    if (e.key === ' ' && /^(BUTTON|A)$/.test(document.activeElement?.tagName)) return;
    const down = ['PageDown', 'ArrowDown', ' '].includes(e.key) && !(e.key === ' ' && e.shiftKey);
    const up = ['PageUp', 'ArrowUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onJump(e.key === 'Home' ? 'first' : 'last');
    } else if (down || up) {
      e.preventDefault();
      step(down ? 1 : -1);
    }
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('keydown', onKey);

  return function destroy() {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
  };
}
