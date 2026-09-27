// Learning Mode guidance: seven concise views controlled by the progress dots.
const STEP_TITLES = [
    'Follow the Note',
    'Find the Key',
    'Play the Note',
    'Music Library',
    'Play Song Demo',
    'Use Your Keyboard',
    'Show Note Names',
];

const IMAGE_STEPS = [
    'assets/guidanceOnDemand/1.png',
    'assets/guidanceOnDemand/2.png',
    'assets/guidanceOnDemand/3.png',
    'assets/guidanceOnDemand/4.png',
];

const DEMO_KEYS = [
    ['A', '#c43f43'],
    ['S', '#fc8b17'],
    ['D', '#ffe253'],
    ['F', '#69aa77'],
    ['G', '#17b3a6'],
    ['H', '#679aca'],
    ['J', '#bf9ce6'],
    ['K', '#f899c0'],
];
const DEMO_MELODY = [0, 2, 4, 5];

export function createLearningGuidance(root, trigger) {
    const title = root.querySelector('#learning-guidance-title');
    const stage = root.querySelector('#learning-guidance-stage');
    const closeButton = root.querySelector('#close-learning-guidance');
    const dots = [...root.querySelectorAll('#learning-guidance-progress button')];
    let currentStep = 0;
    const timers = new Set();

    function later(callback, delay) {
        const timer = window.setTimeout(() => {
            timers.delete(timer);
            callback();
        }, delay);
        timers.add(timer);
    }

    function stopDemo() {
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.clear();
        stage.replaceChildren();
    }

    function keySample(labels = ['', '', '']) {
        return `
            <div class="guidance-key-sample">
                ${labels.map((label) => `<span>${label}</span>`).join('')}
            </div>
        `;
    }

    function settingMarkup(kind) {
        const keyboard = kind === 'keyboard';
        const labels = keyboard ? ['A', 'S', 'D'] : ['Do', 'Re', 'Mi'];
        const icon = keyboard ? 'keyboard' : 'note';
        return `
            <div class="learning-setting-demo">
                <div class="learning-setting-control">
                    <img src="assets/icon/${icon}.png">
                    <span class="guidance-demo-toggle"></span>
                </div>
                <div class="learning-setting-control is-enabled">
                    <img src="assets/icon/${icon}.png">
                    <span class="guidance-demo-toggle is-on"></span>
                </div>
                <div class="guidance-demo-card learning-setting-card is-before">
                    ${keySample()}
                </div>
                <span class="guidance-arrow">→</span>
                <div class="guidance-demo-card learning-setting-card is-after is-active">
                    ${keySample(labels)}
                </div>
            </div>
        `;
    }

    function startSongDemo() {
        stage.innerHTML = `
            <div class="learning-song-demo">
                <div class="learning-demo-lanes">
                    ${DEMO_MELODY.map(
                        (key, index) => `
                            <span
                                class="learning-demo-note"
                                style="--note-left: ${(key + 0.5) * 12.5}%; --note-color: ${DEMO_KEYS[key][1]}; --note-delay: ${index * 0.45}s"
                            ></span>
                        `,
                    ).join('')}
                </div>
                <div class="learning-demo-keys">
                    ${DEMO_KEYS.map(
                        ([letter, color], index) => `
                            <span class="learning-demo-key" data-demo-key="${index}" style="--key-color: ${color}">
                                ${letter}
                                <span class="learning-demo-wave"><i></i><i></i><i></i></span>
                            </span>
                        `,
                    ).join('')}
                </div>
                <button class="learning-demo-play">♫</button>
                <img class="learning-demo-hand" src="assets/icon/hand-cursor.png" alt="">
            </div>
        `;
        const demo = stage.querySelector('.learning-song-demo');
        const lanes = stage.querySelector('.learning-demo-lanes');
        const playButton = stage.querySelector('.learning-demo-play');
        const hand = stage.querySelector('.learning-demo-hand');
        const keys = [...stage.querySelectorAll('.learning-demo-key')];

        function pulseKey(keyIndex, delay) {
            later(() => {
                const key = keys[keyIndex];
                key.classList.add('is-playing');
                later(() => key.classList.remove('is-playing'), 320);
            }, delay);
        }

        function cycle() {
            demo.classList.remove('is-running');
            lanes.classList.remove('is-running');
            playButton.classList.remove('is-pressed');
            hand.classList.remove('is-clicking', 'is-hidden');
            keys.forEach((key) => key.classList.remove('is-playing'));
            void lanes.offsetWidth;

            later(() => {
                hand.classList.add('is-clicking');
                playButton.classList.add('is-pressed');
            }, 350);
            later(() => {
                hand.classList.add('is-hidden');
                hand.classList.remove('is-clicking');
                playButton.classList.remove('is-pressed');
                demo.classList.add('is-running');
                lanes.classList.add('is-running');
            }, 650);
            DEMO_MELODY.forEach((keyIndex, index) => {
                pulseKey(keyIndex, 1500 + index * 450);
            });
            later(cycle, 3600);
        }

        cycle();
    }

    function showStep(index) {
        stopDemo();
        currentStep = index;
        title.textContent = STEP_TITLES[index];
        dots.forEach((dot, dotIndex) => {
            dot.classList.toggle('is-active', dotIndex === index);
        });
        if (index < IMAGE_STEPS.length) {
            stage.innerHTML = `<img class="learning-guidance-image" src="${IMAGE_STEPS[index]}" alt="${STEP_TITLES[index]}">`;
            return;
        }
        if (index === 4) {
            startSongDemo();
            return;
        }
        stage.innerHTML = settingMarkup(index === 5 ? 'keyboard' : 'note');
    }

    function open() {
        root.hidden = false;
        showStep(0);
        closeButton.focus();
    }

    function close(restoreFocus = true) {
        if (root.hidden) return;
        stopDemo();
        root.hidden = true;
        if (restoreFocus) trigger.focus();
    }

    dots.forEach((dot, index) => dot.addEventListener('click', () => showStep(index)));
    closeButton.addEventListener('click', () => close());
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !root.hidden) close();
    });

    return { open, close, get currentStep() { return currentStep; } };
}
