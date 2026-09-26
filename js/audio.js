// Manage Tone.js and the shared eight-note mapping here.
export const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
export const COLORS = [
    '#c43f43',
    '#fc8b17',
    '#ffe253',
    '#69aa77',
    '#17b3a6',
    '#679aca',
    '#bf9ce6',
    '#f899c0',
];
let instruments;
let muted = false;
let starting;

const clickSounds = Array.from({ length: 6 }, () => {
    const sound = new Audio(new URL('../assets/click-sound.mp3?v=2', import.meta.url).href);
    sound.preload = 'auto';
    sound.volume = 0.45;
    return sound;
});
let clickIndex = 0;
export function playClick() {
    if (muted) return;
    const sound = clickSounds[clickIndex++ % clickSounds.length];
    sound.currentTime = 0;
    sound.play().catch(() => {
    });
}

// Initialize audio after a user gesture and share the initialization promise.
export async function initAudio() {
    if (!window.Tone) throw new Error('Sound could not load. Check your connection and refresh.');
    if (!starting) {
        starting = Tone.start()
            .then(() => {
                if (!instruments) {
                    // The two synth envelopes control attack, decay, sustain, and release.
                    instruments = {
                        piano: new Tone.PolySynth(Tone.Synth, {
                            oscillator: { type: 'triangle' },
                            envelope: { attack: 0.005, decay: 0.5, sustain: 0.12, release: 0.8 },
                        }).toDestination(),
                        xylophone: new Tone.PolySynth(Tone.FMSynth, {
                            harmonicity: 3,
                            modulationIndex: 2,
                            envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.25 },
                            modulationEnvelope: {
                                attack: 0.001,
                                decay: 0.2,
                                sustain: 0,
                                release: 0.2,
                            },
                        }).toDestination(),
                    };
                    instruments.piano.volume.value = -12;
                    instruments.xylophone.volume.value = -6;
                }
                Tone.Destination.mute = muted;
            })
            .catch((error) => {
                starting = undefined;
                throw error;
            });
    }
    await starting;
    if (Tone.context.state !== 'running') await Tone.start();
}

// Read pitch by key index so both modes use the same eight-note mapping.
export function playNote(index, duration = 0.45, voice = 'piano') {
    if (instruments && NOTES[index])
        instruments[voice].triggerAttackRelease(NOTES[index], duration);
}

// Mute instruments and button feedback consistently across all screens.
export function setMuted(value) {
    muted = value;
    // Mute both current and future click sounds.
    clickSounds.forEach((sound) => {
        sound.muted = value;
        if (value) sound.pause();
    });
    if (window.Tone) Tone.Destination.mute = value;
}

// Release active synth voices so navigation does not leave sustained notes.
export function stopAudio() {
    if (instruments) Object.values(instruments).forEach((synth) => synth.releaseAll());
}

// Schedule the melody on the audio clock so UI work cannot delay note onsets.
// A dedicated synth lets disposal cancel every scheduled note when playback stops.
export function startMelody(song) {
    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        // Shorten release and lower sustain to keep the melody clear without lingering tails.
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.045 },
    }).toDestination();
    synth.volume.value = -12;
    const startTime = Tone.now() + 0.25;
    let offset = 0;
    const timeline = song.notes.map((note) => {
        const duration = (note.beats * 60) / song.bpm;
        const event = { ...note, time: offset, duration };
        synth.triggerAttackRelease(
            NOTES[note.key],
            Math.max(0.04, duration - 0.055),
            startTime + offset,
        );
        offset += duration;
        return event;
    });
    return {
        timeline,
        duration: offset,
        elapsed: () => Tone.immediate() - startTime,
        stop: () => synth.dispose(),
    };
}
