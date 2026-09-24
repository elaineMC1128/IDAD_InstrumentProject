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
const homeScreen = document.querySelector('#home');
const homeModeButtons = [...homeScreen.querySelectorAll('.mode-button')];
const chooseScreen = document.querySelector('#choose');
const chooseGuidance = chooseScreen.querySelector('.choose-guidance');
const chooseGuidanceProgress = chooseGuidance.querySelector('.learning-guide-progress');
const chooseGuidanceSkip = chooseGuidance.querySelector('.learning-guide-skip');
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

let homeIntroTimer,
    homePulseStartTimer,
    homePulseTimer,
    homePulseTarget = 'play',
    homePulseStep = 0,
    homeGuidanceHasPlayed = false;

const freeplayScreen = document.querySelector('#freeplay');
const freeplayOnboarding = freeplayScreen.querySelector('.freeplay-onboarding');
const freeplayOnboardingTitle = freeplayOnboarding.querySelector('.freeplay-step-title');
const freeplayOnboardingProgress = freeplayOnboarding.querySelector('.freeplay-progress');
const freeplayOnboardingSkip = freeplayOnboarding.querySelector('.freeplay-skip');
const freeplayOnboardingCharacter = freeplayOnboarding.querySelector('.freeplay-guide-character');
const freeplayOnboardingSteps = [
    { id: 'key', title: '1. Try a key', character: 'character-3.png' },
    { id: 'voice', title: '2. Change Sound', character: 'character-4.png' },
    { id: 'colors', title: '3. Shuffle Colours', character: 'character-4.png' },
    { id: 'keyboard', title: '4. Show Keyboard', character: 'character-5.png' },
    { id: 'notes', title: '5. Show Note Names', character: 'character-5.png' },
];
let freeplayOnboardingHasPlayed = false,
    freeplayOnboardingStep = -1,
    freeplayOnboardingActive = false,
    freeplayOnboardingCheckTimer,
    freeplayOnboardingFadeTimer,
    freeplayOnboardingCompleteTimer;
let chooseGuidanceHasPlayed = false;

function clearHomeGuidanceTimers() {
    clearTimeout(homeIntroTimer);
    clearTimeout(homePulseStartTimer);
    clearTimeout(homePulseTimer);
    homeIntroTimer = undefined;
    homePulseStartTimer = undefined;
    homePulseTimer = undefined;
    homePulseStep = 0;
}

function setHomePulseTarget(target) {
    homePulseTarget = target;
    homeScreen.classList.toggle('is-pointing-play', target === 'play');
    homeScreen.classList.toggle('is-pointing-learn', target === 'learn');
}

function startHomePulse() {
    clearTimeout(homePulseTimer);
    const sequence = ['play', 'learn', 'play', 'learn'];
    homePulseStep = 0;

    const showNextTarget = () => {
        if (homePulseStep >= sequence.length) {
            homeScreen.classList.remove('is-pointing-play', 'is-pointing-learn');
            homePulseTimer = undefined;
            return;
        }

        setHomePulseTarget(sequence[homePulseStep]);
        homePulseStep++;
        homePulseTimer = setTimeout(showNextTarget, 1200);
    };

    showNextTarget();
}

function showHomeChoices() {
    clearHomeGuidanceTimers();
    homeScreen.classList.remove('is-guidance-intro');
    homeScreen.classList.add('is-guidance-active');
    homeScreen.classList.remove('is-pointing-play', 'is-pointing-learn', 'is-locked-play', 'is-locked-learn');
    homePulseStartTimer = setTimeout(startHomePulse, 1000);
}

function startHomeGuidance() {
    if (homeGuidanceHasPlayed) {
        stopHomeGuidance();
        return;
    }

    homeGuidanceHasPlayed = true;
    clearHomeGuidanceTimers();
    homeScreen.classList.remove('is-guidance-active', 'is-pointing-play', 'is-pointing-learn', 'is-locked-play', 'is-locked-learn');
    homeScreen.classList.add('is-guidance-intro');
    homePulseTarget = 'play';
    homeIntroTimer = setTimeout(showHomeChoices, 2000);
}

function stopHomeGuidance() {
    clearHomeGuidanceTimers();
    homeScreen.classList.remove('is-guidance-intro', 'is-guidance-active', 'is-pointing-play', 'is-pointing-learn', 'is-locked-play', 'is-locked-learn');
}

function lockHomeGuidanceOnButton(button) {
    if (!homeScreen.classList.contains('is-guidance-active')) return;
    clearHomeGuidanceTimers();
    const target = button.dataset.screen === 'freeplay' ? 'play' : 'learn';
    homeScreen.classList.remove('is-pointing-play', 'is-pointing-learn', 'is-locked-play', 'is-locked-learn');
    homeScreen.classList.add(`is-locked-${target}`);
}

homeScreen.addEventListener(
    'click',
    (event) => {
        if (!homeScreen.classList.contains('is-guidance-intro')) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.target.closest('.guide-skip')) {
            stopHomeGuidance();
            return;
        }
        showHomeChoices();
    },
    true,
);

homeModeButtons.forEach((button) => {
    button.addEventListener('pointerenter', () => lockHomeGuidanceOnButton(button));
    button.addEventListener('focusin', () => lockHomeGuidanceOnButton(button));
});

function renderFreeplayOnboardingStep() {
    const step = freeplayOnboardingSteps[freeplayOnboardingStep];
    if (!step) return;

    freeplayOnboarding.classList.remove('is-progress-fading', 'is-complete-card-visible');
    freeplayOnboarding.dataset.step = step.id;
    freeplayOnboardingTitle.textContent = step.title;
    freeplayOnboardingCharacter.src = `assets/character/${step.character}`;
    freeplayOnboardingProgress.replaceChildren(
        ...freeplayOnboardingSteps.map((item, index) => {
            const dot = document.createElement('span');
            if (index < freeplayOnboardingStep) dot.classList.add('is-done');
            return dot;
        }),
    );
}

function renderFreeplayOnboardingComplete() {
    const finalStep = freeplayOnboardingSteps.at(-1);
    freeplayOnboarding.classList.remove('is-progress-fading', 'is-complete-card-visible');
    freeplayOnboarding.dataset.step = 'complete';
    freeplayOnboardingTitle.textContent = finalStep.title;
    freeplayOnboardingCharacter.src = `assets/character/${finalStep.character}`;
    freeplayOnboardingProgress.replaceChildren(
        ...freeplayOnboardingSteps.map(() => {
            const dot = document.createElement('span');
            dot.className = 'is-done';
            return dot;
        }),
    );

    freeplayOnboardingCheckTimer = setTimeout(() => {
        const complete = document.createElement('span');
        complete.className = 'is-complete';
        freeplayOnboardingProgress.append(complete);
    }, 500);

    freeplayOnboardingFadeTimer = setTimeout(() => {
        freeplayOnboarding.classList.add('is-progress-fading', 'is-complete-card-visible');
        freeplayOnboardingCompleteTimer = setTimeout(stopFreeplayOnboarding, 2500);
    }, 1000);
}

function startFreeplayOnboarding() {
    if (freeplayOnboardingHasPlayed) return;
    freeplayOnboardingHasPlayed = true;
    freeplayOnboardingActive = true;
    freeplayOnboardingStep = 0;
    freeplayOnboarding.hidden = false;
    renderFreeplayOnboardingStep();
}

function stopFreeplayOnboarding() {
    clearTimeout(freeplayOnboardingCheckTimer);
    clearTimeout(freeplayOnboardingFadeTimer);
    clearTimeout(freeplayOnboardingCompleteTimer);
    freeplayOnboardingCheckTimer = undefined;
    freeplayOnboardingFadeTimer = undefined;
    freeplayOnboardingCompleteTimer = undefined;
    freeplayOnboardingActive = false;
    freeplayOnboardingStep = -1;
    freeplayOnboarding.hidden = true;
    freeplayOnboarding.classList.remove('is-progress-fading', 'is-complete-card-visible');
    delete freeplayOnboarding.dataset.step;
}

function advanceFreeplayOnboarding(expectedStep) {
    if (!freeplayOnboardingActive) return;
    const step = freeplayOnboardingSteps[freeplayOnboardingStep];
    if (step?.id !== expectedStep) return;

    freeplayOnboardingStep++;
    if (freeplayOnboardingStep >= freeplayOnboardingSteps.length) {
        freeplayOnboardingActive = false;
        renderFreeplayOnboardingComplete();
        freeplayOnboardingCompleteTimer = setTimeout(stopFreeplayOnboarding, 2500);
        return;
    }

    renderFreeplayOnboardingStep();
}

freeplayOnboardingSkip.addEventListener('click', () => {
    freeplayOnboardingHasPlayed = true;
    stopFreeplayOnboarding();
});

function renderLearningProgress(container, completed, total = 5, complete = false) {
    container.replaceChildren(
        ...Array.from({ length: total }, (_, index) => {
            const dot = document.createElement('span');
            if (index < completed) dot.classList.add('is-done');
            return dot;
        }),
    );
    if (complete) {
        const done = document.createElement('span');
        done.className = 'is-complete';
        container.append(done);
    }
}

function startChooseGuidance() {
    if (chooseGuidanceHasPlayed) return;
    chooseGuidanceHasPlayed = true;
    chooseScreen.classList.add('is-learning-song-guidance');
    chooseGuidance.hidden = false;
    renderLearningProgress(chooseGuidanceProgress, 0);
}

function stopChooseGuidance() {
    chooseScreen.classList.remove('is-learning-song-guidance');
    chooseGuidance.hidden = true;
}

chooseGuidanceSkip.addEventListener('click', stopChooseGuidance);
document.querySelector('#song-options').addEventListener('click', (event) => {
    if (!chooseGuidance.hidden && event.target.closest('.song-card')) stopChooseGuidance();
});

// the song-library remembers the entry screen
// the learning screen always goes back to Home
function navigate(next) {
    if (!screens.some((screen) => screen.id === next)) return;
    if (next === 'choose' && current !== 'choose')
        songLibraryOrigin = current === 'learning' ? 'learning' : 'home';
    navigationVersion++;
    if (current === 'home') stopHomeGuidance();
    if (current === 'freeplay') stopFreeplayOnboarding();
    if (current === 'choose') stopChooseGuidance();
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
    if (next === 'home') startHomeGuidance();
    if (next === 'freeplay') startFreeplayOnboarding();
    if (next === 'choose') startChooseGuidance();
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

freeplayScreen
    .querySelector('#change-colors')
    .addEventListener('click', () => advanceFreeplayOnboarding('colors'));
freeplayScreen
    .querySelectorAll('[data-voice]')
    .forEach((button) =>
        button.addEventListener('click', () => advanceFreeplayOnboarding('voice')),
    );

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
        if (button.closest('#freeplay')) advanceFreeplayOnboarding('key');
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
        if (button.closest('#freeplay')) advanceFreeplayOnboarding('key');
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

// Label visibility is retained independently for each performance mode.
const labelSettings = {
    freeplay: { keyboard: false, note: false },
    learning: { keyboard: true, note: false },
};
document.querySelectorAll('.performance').forEach((screen) => {
    const panel = document.createElement('div');
    panel.className = 'label-settings';
    panel.dataset.mode = screen.id;
    const modeSettings = labelSettings[screen.id];
    for (const [type, label] of [
        ['keyboard', 'Show keyboard letters'],
        ['note', 'Show solfege'],
    ]) {
        const toggle = document.createElement('button');
        toggle.className = 'label-toggle';
        toggle.title = label;
        toggle.dataset.labelType = type;
        toggle.innerHTML = `<img src="assets/icon/${type}.png"><span class="switch-track"></span>`;
        toggle.classList.toggle('is-on', modeSettings[type]);
        toggle.addEventListener('click', () => {
            modeSettings[type] = !modeSettings[type];
            if (panel.dataset.mode === 'freeplay')
                advanceFreeplayOnboarding(type === 'keyboard' ? 'keyboard' : 'notes');
            toggle.classList.toggle('is-on', modeSettings[type]);
            const labelClass = type === 'keyboard' ? '.shortcut-label' : '.solfege-label';
            screen.querySelectorAll(labelClass).forEach((text) => {
                text.hidden = !modeSettings[type];
            });
            screen.querySelectorAll('.keyboard').forEach((keyboard) => {
                keyboard.classList.toggle(
                    'both-labels',
                    modeSettings.keyboard && modeSettings.note,
                );
            });
        });
        panel.append(toggle);
    }
    screen.querySelectorAll('.shortcut-label').forEach((text) => {
        text.hidden = !modeSettings.keyboard;
    });
    screen.querySelectorAll('.solfege-label').forEach((text) => {
        text.hidden = !modeSettings.note;
    });
    panel.hidden = true;
    document.querySelector('.app').append(panel);
});
