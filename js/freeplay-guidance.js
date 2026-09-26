// Free Play guidance: five compact demonstrations controlled by the progress dots.
import { initAudio, playNote, stopAudio } from './audio.js';

const STEP_TITLES = [
    'Try a Key',
    'Change Sound',
    'Shuffle Colours',
    'Use Your Keyboard',
    'Show Note Names',
];

const TRY_KEY_FRAMES = [
    'assets/guidanceOnDemand/play-guidance-1.1.png',
    'assets/guidanceOnDemand/play-guidance-1.2.png',
    'assets/guidanceOnDemand/play-guidance-1.3.png',
];

export function createFreeplayGuidance(root, trigger, reportError) {
    const title = root.querySelector('#freeplay-guidance-title');
    const stage = root.querySelector('#freeplay-guidance-stage');
    const closeButton = root.querySelector('#close-freeplay-guidance');
    const dots = [...root.querySelectorAll('#freeplay-guidance-progress button')];
    let currentStep = 0;
    let demoVersion = 0;
    const timers = new Set();

    function later(callback, delay) {
        const timer = window.setTimeout(() => {
            timers.delete(timer);
            callback();
        }, delay);
        timers.add(timer);
        return timer;
    }

    function repeat(callback, delay) {
        const timer = window.setInterval(callback, delay);
        timers.add(timer);
    }

    // I cancel every moving part together so no sound or highlight leaks into another step.
    function stopDemo() {
        demoVersion++;
        timers.forEach((timer) => {
            window.clearTimeout(timer);
            window.clearInterval(timer);
        });
        timers.clear();
        stopAudio();
        stage.replaceChildren();
    }

    function keySample(labels = ['', '', ''], shuffled = false) {
        return `
            <div class="guidance-key-sample${shuffled ? ' is-shuffled' : ''}">
                ${labels.map((label) => `<span>${label}</span>`).join('')}
            </div>
        `;
    }

    function startTryKey() {
        const image = document.createElement('img');
        image.className = 'try-key-demo';
        image.alt = 'Keyboard key demonstration';
        const progress = document.createElement('span');
        progress.className = 'try-key-progress';
        stage.append(image, progress);
        let frame = 0;
        const showFrame = () => {
            image.src = TRY_KEY_FRAMES[frame];
            progress.textContent = `${frame + 1}/${TRY_KEY_FRAMES.length}`;
            frame = (frame + 1) % TRY_KEY_FRAMES.length;
        };
        showFrame();
        // One second leaves enough time to understand each cause-and-effect frame.
        repeat(showFrame, 1000);
    }

    function startSoundDemo() {
        stage.innerHTML = `
            <div class="guidance-demo-pair">
                <div class="guidance-demo-card sound-demo-card is-active" data-demo-voice="piano">
                    <img src="assets/guidanceOnDemand/choose-piano.png" alt="Piano selected">
                    <span>Piano</span>
                </div>
                <div class="guidance-demo-card sound-demo-card" data-demo-voice="xylophone">
                    <img src="assets/guidanceOnDemand/choose- xylophone.png" alt="Xylophone selected">
                    <span>Xylophone</span>
                </div>
            </div>
        `;
        const version = demoVersion;
        let audioReady = false;
        const cards = [...stage.querySelectorAll('[data-demo-voice]')];
        initAudio()
            .then(() => {
                if (version === demoVersion && !root.hidden) audioReady = true;
            })
            .catch((error) => {
                if (version === demoVersion) reportError(error);
            });

        function selectVoice(voice) {
            cards.forEach((card) => card.classList.toggle('is-active', card.dataset.demoVoice === voice));
        }

        function playScale(voice, offset = 0) {
            [0, 1, 2].forEach((note, index) =>
                later(() => {
                    if (audioReady) playNote(note, 0.38, voice);
                }, offset + index * 520),
            );
        }

        // I repeat the paired phrase so the visual border and timbre can be compared more than once.
        function cycle() {
            selectVoice('piano');
            playScale('piano');
            later(() => {
                selectVoice('xylophone');
                playScale('xylophone');
            }, 1800);
            later(cycle, 3800);
        }
        cycle();
    }

    function controlDemoMarkup(kind) {
        if (kind === 'shuffle') {
            return `
                <div class="guidance-control-demo is-shuffle">
                    <div class="guidance-shuffle-button">
                        <img class="change-icon" src="assets/icon/change.png" alt="">
                        <img class="palette-icon" src="assets/icon/color-palette.png" alt="">
                    </div>
                    <div class="guidance-result-row">
                        <div class="guidance-demo-card is-active">${keySample()}</div>
                        <span class="guidance-arrow">→</span>
                        <div class="guidance-demo-card">${keySample(['', '', ''], true)}</div>
                    </div>
                </div>
            `;
        }
        const keyboard = kind === 'keyboard';
        const labels = keyboard ? ['A', 'S', 'D'] : ['Do', 'Re', 'Mi'];
        return `
            <div class="guidance-control-demo">
                <div class="guidance-control-preview">
                    <img src="assets/icon/${keyboard ? 'keyboard' : 'note'}.png" alt="">
                    <span class="guidance-demo-toggle"></span>
                </div>
                <div class="guidance-result-row">
                    <div class="guidance-demo-card is-active">${keySample()}</div>
                    <span class="guidance-arrow">→</span>
                    <div class="guidance-demo-card">${keySample(labels)}</div>
                </div>
            </div>
        `;
    }

    function startControlDemo(kind) {
        stage.innerHTML = controlDemoMarkup(kind);
        const control = stage.querySelector(
            kind === 'shuffle' ? '.guidance-shuffle-button' : '.guidance-demo-toggle',
        );
        const cards = [...stage.querySelectorAll('.guidance-demo-card')];

        function showBefore() {
            control.classList.remove('is-on', 'is-pressed');
            cards[0].classList.add('is-active');
            cards[1].classList.remove('is-active');
        }

        function cycle() {
            showBefore();
            later(() => control.classList.add(kind === 'shuffle' ? 'is-pressed' : 'is-on'), 700);
            later(() => {
                cards[0].classList.remove('is-active');
                cards[1].classList.add('is-active');
            }, 900);
            later(() => control.classList.remove('is-pressed'), 1050);
            later(cycle, 2600);
        }
        cycle();
    }

    function showStep(index) {
        stopDemo();
        currentStep = index;
        title.textContent = STEP_TITLES[index];
        dots.forEach((dot, dotIndex) => {
            const active = dotIndex === index;
            dot.classList.toggle('is-active', active);
        });
        if (index === 0) startTryKey();
        if (index === 1) startSoundDemo();
        if (index === 2) startControlDemo('shuffle');
        if (index === 3) startControlDemo('keyboard');
        if (index === 4) startControlDemo('note');
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
