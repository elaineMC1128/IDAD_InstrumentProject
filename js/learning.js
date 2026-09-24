// Learning mode: song selection, demonstration, note matching, and retained progress.
import { SONGS } from './songs.js';
import { COLORS, initAudio, playNote, stopAudio, startMelody } from './audio.js';

export function createLearning(screen, navigate, reportError) {
    let song = SONGS[0],
        position = 0,
        playing = false,
        active = false,
        generation = 0;
    let melody;
    let animationFrame;
    const status = screen.querySelector('#learning-status');
    const guide = screen.querySelector('#note-guide');
    const demo = screen.querySelector('#demo');
    const restart = screen.querySelector('#restart');
    const completion = screen.querySelector('#completion');
    const onboarding = screen.querySelector('.learning-onboarding');
    const onboardingTitle = onboarding.querySelector('.learning-guide-title');
    const onboardingProgress = onboarding.querySelector('.learning-guide-progress');
    const onboardingSkip = onboarding.querySelector('.learning-guide-skip');
    const onboardingCharacter = onboarding.querySelector('.performance-guide-character');
    const onboardingLibraryConfirm = onboarding.querySelector('.learning-library-confirm');
    const songLibraryButton = screen.querySelector('#song-library');
    const celebrations = [
        { title: 'So Good!', icon: 'so-good.png' },
        { title: 'Well Done!', icon: 'well-done.png' },
        { title: 'GoodJob!', icon: 'good-job.png' },
    ];
    let celebration;
    let onboardingHasPlayed = false,
        onboardingActive = false,
        onboardingStep,
        onboardingTimer,
        onboardingColumnTimer,
        onboardingCompleteTimer;
    const onboardingSteps = [
        { id: 'choose', title: '1. Choose a song', character: 'character-7.png' },
        { id: 'watch', title: '2. Watch the Note', character: 'character-9.png' },
        { id: 'press', title: '3. Press the Key', character: 'character-9.png' },
        { id: 'hear', title: '4. Hear the Song', character: 'character-9.png' },
        { id: 'library', title: '5. Music Library', character: 'character-7.png' },
    ];
    screen.querySelector('#completion-songs').addEventListener('click', () => navigate('choose'));
    const keys = [...screen.querySelectorAll('.key')];

    function clearOnboardingTimers() {
        clearTimeout(onboardingTimer);
        clearTimeout(onboardingColumnTimer);
        clearTimeout(onboardingCompleteTimer);
        onboardingTimer = undefined;
        onboardingColumnTimer = undefined;
        onboardingCompleteTimer = undefined;
    }

    // Progress dots make each task feel achievable: they show that the child is already on the way and only has a little more to finish.
    function renderOnboardingProgress(completed, complete = false) {
        onboardingProgress.replaceChildren(
            ...Array.from({ length: onboardingSteps.length }, (_, index) => {
                const dot = document.createElement('span');
                if (index < completed) dot.classList.add('is-done');
                return dot;
            }),
        );
        if (complete) {
            const done = document.createElement('span');
            done.className = 'is-complete';
            onboardingProgress.append(done);
        }
    }

    function setOnboardingStep(index) {
        const step = onboardingSteps[index];
        onboardingStep = step.id;
        screen.classList.remove('learning-guidance-hear', 'learning-guidance-library');
        onboarding.dataset.step = step.id;
        onboardingTitle.textContent = step.title;
        onboardingCharacter.src = `assets/character/${step.character}`;
        onboarding.classList.remove(
            'is-library-confirmed',
            'is-press-guidance-dismissed',
            'is-progress-fading',
            'is-complete-card-visible',
        );
        if (!['watch', 'press'].includes(step.id))
            screen.classList.remove('learning-column-visible', 'learning-column-blinking');
        renderOnboardingProgress(index);
    }

    function showGuideColumn() {
        screen.classList.add('learning-column-visible');
    }

    function stopOnboarding() {
        clearOnboardingTimers();
        onboardingActive = false;
        onboardingStep = undefined;
        onboarding.hidden = true;
        screen.classList.remove('learning-guidance-hear', 'learning-guidance-library');
        screen.classList.remove('learning-column-visible', 'learning-column-blinking');
        onboarding.classList.remove(
            'is-library-confirmed',
            'is-press-guidance-dismissed',
            'is-progress-fading',
            'is-complete-card-visible',
        );
        delete onboarding.dataset.step;
    }

    function renderOnboardingComplete() {
        onboardingStep = 'complete';
        onboarding.dataset.step = 'complete';
        onboarding.classList.add('is-progress-fading', 'is-complete-card-visible');
        onboardingCompleteTimer = setTimeout(stopOnboarding, 2800);
    }

    function enterLibraryGuidance() {
        setOnboardingStep(4);
        screen.classList.add('learning-guidance-library');
    }

    function completeLibraryGuidance() {
        if (!onboardingActive || onboardingStep !== 'library') return;
        if (onboarding.classList.contains('is-library-confirmed')) return;
        onboarding.classList.add('is-library-confirmed');
        renderOnboardingProgress(onboardingSteps.length, true);
        onboardingTimer = setTimeout(() => {
            screen.classList.remove('learning-guidance-library');
            renderOnboardingComplete();
        }, 500);
    }

    function enterHearGuidance() {
        setOnboardingStep(3);
        screen.classList.add('learning-guidance-hear');
    }

    function enterPressGuidance() {
        setOnboardingStep(2);
        guide.querySelectorAll('.is-guide-note-framed').forEach((item) =>
            item.classList.remove('is-guide-note-framed'),
        );
    }

    function startLearningOnboarding() {
        if (onboardingHasPlayed) return;
        onboardingHasPlayed = true;
        onboardingActive = true;
        onboarding.hidden = false;
        showGuideColumn();
        screen.classList.add('learning-column-blinking');
        onboardingColumnTimer = setTimeout(() => {
            screen.classList.remove('learning-column-blinking');
            guide.querySelector('.falling-note')?.classList.add('is-guide-note-framed');
            onboardingTimer = setTimeout(enterPressGuidance, 1800);
        }, 900);
        onboardingTimer = setTimeout(() => {
            setOnboardingStep(1);
        }, 680);
    }

    onboardingSkip.addEventListener('click', stopOnboarding);
    onboardingLibraryConfirm.addEventListener('click', completeLibraryGuidance);
    songLibraryButton.addEventListener(
        'click',
        (event) => {
            if (!onboardingActive || onboardingStep !== 'library') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            completeLibraryGuidance();
        },
        true,
    );

    /* --------------------------------------------------------------------------
     * Build song buttons from data and reset practice when a song is selected.
     * -------------------------------------------------------------------------- */
    for (const item of SONGS) {
        const button = document.createElement('button');
        button.className = 'song-card';
        button.innerHTML = `
      <span class="picture">
        <img src="assets/icon/${item.icon}">
      </span>
      <span>${item.title}</span>
    `;
        button.addEventListener('click', () => {
            song = item;
            position = 0;
            celebration = undefined;
            navigate('learning');
        });
        document.querySelector('#song-options').append(button);
    }

    // Render the current note, progress, and completion state.
    function render() {
        const finished = position >= song.notes.length;
        keys.forEach((key, i) =>
            key.classList.toggle('expected', !finished && i === song.notes[position].key),
        );
        guide.replaceChildren();
        // Space circles evenly and add one quarter of a gap at phrase endings.
        let visualOffset = 0;
        song.notes.slice(position, position + 6).forEach((note) => {
            const dot = document.createElement('span');
            dot.className = 'falling-note';
            dot.style.setProperty('--key-color', COLORS[note.key]);
            dot.style.left = `${(note.key + 0.5) * 12.5}%`;
            dot.style.top = `${91 - visualOffset * 22}%`;
            guide.append(dot);
            // Notes wait at the bottom but can also be caught early during their descent.
            const duration = matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 0
                : playing
                  ? 180
                  : 600;
            dot.animate(
                [
                    { transform: 'translate(-50%, -50%) translateY(-6cqw)' },
                    { transform: 'translate(-50%, -50%) translateY(0)' },
                ],
                { duration, easing: 'linear', fill: 'forwards' },
            );
            visualOffset += note.phraseEnd ? 1.25 : 1;
        });
        // Pick once per completion and preserve the result when returning from the song library.
        completion.hidden = !finished;
        screen.classList.toggle('completed', finished);
        demo.hidden = finished;
        if (finished) {
            if (!celebration) {
                celebration = celebrations[Math.floor(Math.random() * celebrations.length)];
            }
            screen.querySelector('#completion-title').textContent = celebration.title;
            screen.querySelector('#completion-icon').src = `assets/icon/${celebration.icon}`;
        }
        const instruction = playing ? 'Listen to the melody' : 'Play the highlighted key';
        status.textContent = finished
            ? 'Beautifully played! ★'
            : `${instruction} · ${position + 1} / ${song.notes.length}`;
    }
    // Cancel the timer and invalidate playback callbacks when stopping or leaving.
    function stop() {
        generation++;
        cancelAnimationFrame(animationFrame);
        melody?.stop();
        melody = undefined;
        guide.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
        playing = false;
        demo.textContent = '♫';
        stopAudio();
    }

    // Capture a playback token and verify it after asynchronous audio initialization.
    demo.addEventListener('click', async () => {
        if (onboardingActive && onboardingStep === 'hear') {
            screen.classList.remove('learning-guidance-hear');
        }
        if (playing) {
            stop();
            if (onboardingActive && onboardingStep === 'hear') enterLibraryGuidance();
            position = 0;
            render();
            return;
        }
        if (onboardingActive && onboardingStep === 'hear') {
            renderOnboardingProgress(4);
        }
        const token = ++generation;
        try {
            await initAudio();
        } catch (error) {
            reportError(error);
            return;
        }
        if (!active || token !== generation) return;
        playing = true;
        position = 0;
        demo.textContent = '■';
        // Keep demo circles mounted and move them by audio time instead of rebuilding each beat.
        guide.replaceChildren();
        completion.hidden = true;
        melody = startMelody(song);
        // Separate visual spacing from duration so short notes never crowd together.
        let visualOffset = 0;
        const visualPositions = melody.timeline.map((note) => {
            const offset = visualOffset;
            visualOffset += note.phraseEnd ? 1.25 : 1;
            return offset;
        });
        const circles = melody.timeline.map((note) => {
            const circle = document.createElement('span');
            circle.className = 'falling-note';
            circle.style.setProperty('--key-color', COLORS[note.key]);
            circle.style.left = `${(note.key + 0.5) * 12.5}%`;
            circle.style.transform = 'translate(-50%, -50%)';
            guide.append(circle);
            return circle;
        });
        function updatePlayback() {
            if (!active || token !== generation || !melody) return;
            const elapsed = melody.elapsed();
            if (elapsed >= melody.duration + 0.2) {
                stop();
                position = 0;
                render();
                return;
            }
            // Interpolate visual positions smoothly while audio keeps the original beat durations.
            while (
                position + 1 < melody.timeline.length &&
                elapsed >= melody.timeline[position + 1].time
            )
                position++;
            if (onboardingActive && onboardingStep === 'hear' && position >= 14) {
                stop();
                position = 0;
                render();
                enterLibraryGuidance();
                return;
            }
            const currentNote = melody.timeline[position];
            const fraction = (elapsed - currentNote.time) / currentNote.duration;
            const step = currentNote.phraseEnd ? 1.25 : 1;
            const scrollPosition = visualPositions[position] + fraction * step;
            melody.timeline.forEach((note, index) => {
                const distance = visualPositions[index] - scrollPosition;
                circles[index].style.top = `${91 - distance * 22}%`;
                circles[index].hidden = elapsed > note.time + 0.12 || distance > 5;
            });
            keys.forEach((key, index) => {
                key.classList.toggle(
                    'expected',
                    elapsed >= 0 && index === song.notes[position].key,
                );
            });
            animationFrame = requestAnimationFrame(updatePlayback);
        }
        updatePlayback();
    });
    restart.addEventListener('click', () => {
        celebration = undefined;
        stop();
        position = 0;
        render();
    });
    return {
        // Preserve progress on return; selecting a song or restarting resets it.
        enter() {
            active = true;
            stop();
            screen.querySelector('#selected-title').textContent = song.title;
            screen.querySelector('#selected-icon').src = `assets/icon/${song.icon}`;
            render();
            startLearningOnboarding();
        },
        leave() {
            active = false;
            stopOnboarding();
            stop();
        },

        // Advance only for a correct pitch; wrong keys show guidance without skipping notes.
        press(index) {
            if (playing || position >= song.notes.length) return;
            playNote(index);
            if (onboardingActive && onboardingStep === 'press') {
                onboarding.classList.add('is-press-guidance-dismissed');
            }
            if (index === song.notes[position].key) {
                const matchedPosition = position;
                // Catch the current note immediately; guidance animation never gates correct input.
                keys[index].classList.remove('wrong');
                keys[index].animate([{ filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], {
                    duration: 220,
                });
                position++;
                if (onboardingActive && onboardingStep === 'press') {
                    screen.classList.remove('learning-column-visible', 'learning-column-blinking');
                }
                render();
                // Twinkle Twinkle has seven notes in each phrase. I wait for one full phrase (positions 0–6) so Step 4
                // does not interrupt the child after the first key.
                if (
                    onboardingActive &&
                    matchedPosition >= 6 &&
                    onboardingStep === 'press'
                ) {
                    enterHearGuidance();
                }
            } else {
                status.textContent = 'Try the key with the white dot';
                keys[index].classList.remove('wrong');
                void keys[index].offsetWidth;
                keys[index].classList.add('wrong');
            }
        },
    };
}
