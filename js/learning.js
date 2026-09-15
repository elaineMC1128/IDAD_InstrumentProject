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
    const celebrations = [
        { title: 'So Good!', icon: 'so-good.png' },
        { title: 'Well Done!', icon: 'well-done.png' },
        { title: 'GoodJob!', icon: 'good-job.png' },
    ];
    let celebration;
    screen.querySelector('#completion-songs').addEventListener('click', () => navigate('choose'));
    const keys = [...screen.querySelectorAll('.key')];

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
        if (playing) {
            stop();
            position = 0;
            render();
            return;
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
        },
        leave() {
            active = false;
            stop();
        },

        // Advance only for a correct pitch; wrong keys show guidance without skipping notes.
        press(index) {
            if (playing || position >= song.notes.length) return;
            playNote(index);
            if (index === song.notes[position].key) {
                // Catch the current note immediately; guidance animation never gates correct input.
                keys[index].classList.remove('wrong');
                keys[index].animate([{ filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], {
                    duration: 220,
                });
                position++;
                render();
            } else {
                status.textContent = 'Try the key with the white dot';
                keys[index].classList.remove('wrong');
                void keys[index].offsetWidth;
                keys[index].classList.add('wrong');
            }
        },
    };
}
