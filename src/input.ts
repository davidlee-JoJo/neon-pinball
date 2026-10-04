import { Game } from './rules';
import { initAudio, isMuted, setMuted, sfx } from './audio';
import type { Scene3D } from './scene3d';

export function bindInput(game: Game, scene3d: Scene3D, muteBtn: HTMLButtonElement, pauseBtn: HTMLButtonElement) {
  const press = (el: HTMLElement, onDown: () => void, onUp?: () => void) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture((e as PointerEvent).pointerId);
      } catch {
        /* ignore */
      }
      el.classList.add('pressed');
      initAudio();
      onDown();
    });
    const up = () => {
      el.classList.remove('pressed');
      if (onUp) onUp();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  };

  const flipL = document.getElementById('btn-flip-l')!;
  const flipR = document.getElementById('btn-flip-r')!;
  const launch = document.getElementById('btn-launch')!;
  const nudgeL = document.getElementById('btn-nudge-l')!;
  const nudgeR = document.getElementById('btn-nudge-r')!;

  const launchDown = () => {
    if (game.state === 'attract' || game.state === 'over') game.newGame();
    else game.startCharge();
  };
  const launchUp = () => {
    if (game.state === 'attract' || game.state === 'over') return;
    game.releaseCharge();
  };

  press(flipL, () => {
    sfx.flipper();
    game.pressFlipper('L');
  }, () => game.releaseFlipper('L'));
  press(flipR, () => {
    sfx.flipper();
    game.pressFlipper('R');
  }, () => game.releaseFlipper('R'));
  press(launch, launchDown, launchUp);
  press(nudgeL, () => game.nudge('L'));
  press(nudgeR, () => game.nudge('R'));

  const updateMute = () => {
    muteBtn.textContent = isMuted() ? '音效 OFF' : '音效 ON';
  };
  const updatePause = () => {
    pauseBtn.textContent = game.paused ? 'RESUME' : 'PAUSE';
  };
  muteBtn.addEventListener('click', () => {
    initAudio();
    setMuted(!isMuted());
    updateMute();
  });
  pauseBtn.addEventListener('click', () => {
    game.togglePause();
    updatePause();
  });
  updateMute();
  updatePause();

  const keys: Record<string, () => void> = {};
  const upKeys: Record<string, () => void> = {};
  const flipLDown = () => {
    sfx.flipper();
    game.pressFlipper('L');
  };
  const flipRDown = () => {
    sfx.flipper();
    game.pressFlipper('R');
  };
  for (const k of ['ArrowLeft', 'KeyZ', 'KeyA']) keys[k] = flipLDown;
  for (const k of ['ArrowRight', 'Slash', 'KeyD']) keys[k] = flipRDown;
  for (const k of ['Space', 'Enter']) {
    keys[k] = launchDown;
    upKeys[k] = launchUp;
  }
  keys['ShiftLeft'] = () => game.nudge('L');
  keys['ShiftRight'] = () => game.nudge('R');
  keys['ArrowUp'] = () => game.nudge('U');
  keys['KeyP'] = () => {
    game.togglePause();
    updatePause();
  };
  keys['KeyM'] = () => {
    initAudio();
    setMuted(!isMuted());
    updateMute();
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const fn = keys[e.code];
    if (fn) {
      e.preventDefault();
      initAudio();
      fn();
    }
  });
  window.addEventListener('keyup', (e) => {
    const fn = upKeys[e.code];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });

  window.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('#deck')) e.preventDefault();
  });

  void scene3d;
}
