// Free play: color shuffling, voice selection, and note feedback.
import { COLORS, playNote } from './audio.js';

export function createFreeplay(screen) {
    let voice = 'piano';
    let colors = [...COLORS];
    const keys = [...screen.querySelectorAll('.key')];
    const canvas = screen.querySelector('.music-canvas');
    const tapHint = screen.querySelector('#freeplay-tap-hint');
    let hasPlayed = false;

    function dismissTapHint() {
        if (hasPlayed) return;
        hasPlayed = true;
        tapHint.classList.add('is-dismissed');
        tapHint.addEventListener('transitionend', () => (tapHint.hidden = true), {
            once: true,
        });
    }
    // Shuffle colors without changing pitch so visual exploration preserves the note mapping.
    screen.querySelector('#change-colors').addEventListener('click', () => {
        const previous = [...colors];
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }

        // Rotate an unchanged shuffle so the user always sees a change.
        if (colors.every((color, i) => color === previous[i])) colors.push(colors.shift());
        keys.forEach((key, i) => key.style.setProperty('--key-color', colors[i]));
    });

    // Keep the selection mutually exclusive so the current instrument remains clear.
    screen.querySelectorAll('[data-voice]').forEach((button) =>
        button.addEventListener('click', () => {
            voice = button.dataset.voice;
            screen
                .querySelectorAll('[data-voice]')
                .forEach((item) => item.classList.toggle('is-selected', item === button));
        }),
    );
    return {
        enter() {},
        leave() {
            canvas.replaceChildren();
        },

        // The hint responds to the physical gesture instead of waiting for audio initialization.
        beginPress() {
            dismissTapHint();
        },

        // Match visual notes to the current key color to connect each sound with its key.
        press(index) {
            playNote(index, 0.6, voice);
            const note = document.createElement('span');
            note.className = 'floating-note';
            note.textContent = '♪';
            note.style.color = colors[index];
            note.style.left = `${8 + index * 11}%`;
            note.style.top = `${45 + Math.random() * 25}%`;
            canvas.append(note);
            note.addEventListener('animationend', () => note.remove(), { once: true });
        },
    };
}
