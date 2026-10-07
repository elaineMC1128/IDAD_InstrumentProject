// Free play: color shuffling, voice selection, and dynamic light-bar feedback.
import { COLORS, playNote } from './audio.js';

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

export function createFreeplay(screen) {
    let voice = 'piano';
    let colors = [...COLORS];
    const keys = [...screen.querySelectorAll('.key')];
    const canvas = screen.querySelector('.music-canvas');
    const lightBars = document.createElement('div');
    lightBars.className = 'light-bars';
    canvas.append(lightBars);

    // Keep sound, input, key, and feedback references in one reusable mapping.
    const keyConfig = keys.map((key, index) => {
        const bar = document.createElement('div');
        bar.className = 'light-bar';
        bar.style.setProperty('--bar-color', colors[index]);
        bar.innerHTML = '<div class="light-bar-rise"><div class="light-bar-stack"></div></div>';
        lightBars.append(bar);
        return {
            keyElement: key,
            lightBarElement: bar,
        };
    });

    function generateBarVariation(index) {
        const config = keyConfig[index];
        if (!config) return;
        // I keep each response slightly different so exploration feels playful, while these limits prevent the display from becoming busy or startling.
        const blockCount = Math.round(randomBetween(6, 12));
        const stack = config.lightBarElement.querySelector('.light-bar-stack');
        config.lightBarElement.style.setProperty('--bar-height', `${randomBetween(48, 91)}%`);
        config.lightBarElement.style.setProperty('--rise-speed', `${randomBetween(260, 520)}ms`);
        config.lightBarElement.style.setProperty('--pulse-speed', `${randomBetween(1100, 1800)}ms`);
        stack.replaceChildren();

        for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
            const block = document.createElement('span');
            block.className = 'light-block';
            block.style.setProperty('--block-width', `${randomBetween(78, 100)}%`);
            block.style.setProperty('--block-weight', randomBetween(0.82, 1.18));
            stack.append(block);
        }
    }

    function renderLightBar(index) {
        const bar = keyConfig[index]?.lightBarElement;
        if (!bar) return;
        // I restart the rise on every new press so even quick taps receive an immediate response.
        bar.classList.remove('is-active');
        void bar.offsetWidth;
        bar.classList.add('is-active');
    }

    function activateKey(index) {
        if (!keyConfig[index]) return;
        generateBarVariation(index);
        renderLightBar(index);
    }

    function releaseKey(index) {
        // The soft return leaves room for another sound without treating release as a mistake.
        keyConfig[index]?.lightBarElement.classList.remove('is-active');
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
        keyConfig.forEach((config, index) => {
            config.keyElement.style.setProperty('--key-color', colors[index]);
            config.lightBarElement.style.setProperty('--bar-color', colors[index]);
        });
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
            keyConfig.forEach((_, index) => releaseKey(index));
        },

        activate: activateKey,
        release: releaseKey,

        press(index) {
            playNote(index, 0.6, voice);
        },
    };
}
