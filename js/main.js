// Application initialization, navigation, mute state, and shared input dispatch.
import { NOTES, COLORS, initAudio, setMuted, stopAudio, playClick } from './audio.js';
import { createFreeplay } from './freeplay.js';
import { createLearning } from './learning.js';

/* --------------------------------------------------------------------------
 * Keep screen and navigation references together so transitions share one state.
 * -------------------------------------------------------------------------- */
const screens = [...document.querySelectorAll('.screen')];
const back = document.querySelector('#nav-back');
const volume = document.querySelector('#volume');
const shortcuts = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
const parents = { home: 'welcome', freeplay: 'home', choose: 'home', learning: 'home' };
let current = 'welcome',
    muted = false,
    navigationVersion = 0;
let songLibraryOrigin = 'home';
const held = new Set();

// A message is displayed when audio loading fails, allowing users to still browse the interface.
export function reportError(error) {
    const message = document.querySelector('#audio-status');
    message.textContent = error.message;
    message.hidden = false;
}

// Build shared keys (each mode handles its own playing behavior).
document.querySelectorAll('.keyboard').forEach((keyboard) => {
    NOTES.forEach((note, index) => {
        const button = document.createElement('button');
        button.className = 'key';
        button.dataset.key = index;
        button.style.setProperty('--key-color', COLORS[index]);
        button.title = `${note} (${shortcuts[index].toUpperCase()})`;
        // Independent labels allow solfege and keyboard hints to appear together.
        const solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'Do'];
        button.innerHTML = `
            <span class="solfege-label" hidden>${solfege[index]}</span>
            <span class="shortcut-label" hidden>${shortcuts[index].toUpperCase()}</span>
        `;
        keyboard.append(button);
    });
});

const modes = {
    freeplay: createFreeplay(document.querySelector('#freeplay')),
    learning: createLearning(document.querySelector('#learning'), navigate, reportError),
};

// the song-library remembers the entry screen
// the learning screen always goes back to Home
function navigate(next) {
    if (!screens.some((screen) => screen.id === next)) return;
    if (next === 'choose' && current !== 'choose')
        songLibraryOrigin = current === 'learning' ? 'learning' : 'home';
    navigationVersion++;
    modes[current]?.leave();
    stopAudio();
    held.clear();
    document.querySelectorAll('.key.active').forEach((key) => key.classList.remove('active'));
    current = next;
    screens.forEach((screen) => {
        screen.hidden = screen.id !== next;
    });
    back.hidden = next === 'welcome';
    back.querySelector('img').src = `assets/icon/${next === 'home' ? 'home' : 'back'}.png`;
    document.querySelectorAll('.label-settings').forEach((panel) => {
        panel.hidden = panel.dataset.mode !== next;
    });
    modes[next]?.enter();
}
document.querySelectorAll('[data-screen]').forEach((button) =>
    button.addEventListener('click', () => {
        // Unlock browser audio through a user gesture.
        initAudio().catch(reportError);
        navigate(button.dataset.screen);
    }),
);
back.addEventListener('click', () =>
    navigate(current === 'choose' ? songLibraryOrigin : parents[current] || 'welcome'),
);

// Update the mute icon while the audio module controls sound.
volume.addEventListener('click', () => {
    muted = !muted;
    setMuted(muted);
    volume.querySelector('img').src = `assets/icon/volume-${muted ? 'off' : 'on'}.png`;
});

// After audio initialization, verify that navigation has not invalidated this input.
async function press(button) {
    const version = navigationVersion;
    const mode = modes[current];
    if (!mode) return;
    button.classList.add('active');
    try {
        await initAudio();
        if (version === navigationVersion) {
            document.querySelector('#audio-status').hidden = true;
            mode.press(Number(button.dataset.key));
        }
    } catch (error) {
        reportError(error);
    }
}

// Bind "press, release, cancel" interaction logic to all keys (.key).
document.querySelectorAll('.key').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        press(button);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((event) =>
        button.addEventListener(event, () => button.classList.remove('active')),
    );
    button.addEventListener('click', (event) => {
        if (event.detail === 0) {
            press(button);
            setTimeout(() => button.classList.remove('active'), 150);
        }
    });
});

// Ignore repeated presses and system modifiers to preserve browser shortcuts.
document.addEventListener('keydown', (event) => {
    const letter = event.key.toLowerCase();
    const index = shortcuts.indexOf(letter);
    if (
        index < 0 ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        held.has(letter)
    )
        return;
    const button = document.querySelector(`#${current} [data-key="${index}"]`);
    if (button) {
        event.preventDefault();
        held.add(letter);
        press(button);
    }
});
document.addEventListener('keyup', (event) => {
    held.delete(event.key.toLowerCase());
    const index = shortcuts.indexOf(event.key.toLowerCase());
    document
        .querySelectorAll(`[data-key="${index}"]`)
        .forEach((button) => button.classList.remove('active'));
});

// Click feedback is only for non-piano buttons; all piano inputs play instrument audio only.
document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && !button.classList.contains('key')) playClick();
});

// Both switches control labels only, preserve keyboard input, and share state across modes.
const labelSettings = { keyboard: true, note: false };
document.querySelectorAll('.performance').forEach((screen) => {
    const panel = document.createElement('div');
    panel.className = 'label-settings';
    for (const [type, label] of [
        ['keyboard', 'Show keyboard letters'],
        ['note', 'Show solfege'],
    ]) {
        const toggle = document.createElement('button');
        toggle.className = 'label-toggle';
        toggle.title = label;
        toggle.dataset.labelType = type;
        toggle.innerHTML = `<img src="assets/icon/${type}.png"><span class="switch-track"></span>`;
        toggle.classList.toggle('is-on', labelSettings[type]);
        toggle.addEventListener('click', () => {
            labelSettings[type] = !labelSettings[type];
            document.querySelectorAll(`[data-label-type="${type}"]`).forEach((button) => {
                button.classList.toggle('is-on', labelSettings[type]);
            });
            const labelClass = type === 'keyboard' ? '.shortcut-label' : '.solfege-label';
            document.querySelectorAll(labelClass).forEach((text) => {
                text.hidden = !labelSettings[type];
            });
            document.querySelectorAll('.keyboard').forEach((keyboard) => {
                keyboard.classList.toggle(
                    'both-labels',
                    labelSettings.keyboard && labelSettings.note,
                );
            });
        });
        panel.append(toggle);
    }
    screen.querySelectorAll('.shortcut-label').forEach((text) => {
        text.hidden = !labelSettings.keyboard;
    });
    panel.dataset.mode = screen.id;
    panel.hidden = true;
    document.querySelector('.app').append(panel);
});
