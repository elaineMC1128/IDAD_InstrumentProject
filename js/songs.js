// Simplified prototype arrangements: indices 0–7 correspond to C4–C5.
// Notes store key indices and beat durations, separately from UI logic.
const phrase = (degrees, beats) =>
    degrees.split(' ').map((n, i) => ({ key: Number(n), beats: beats?.[i] ?? 1 }));
const twinkleA = phrase('0 0 4 4 5 5 4 3 3 2 2 1 1 0', [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2]);
const twinkleB = phrase('4 4 3 3 2 2 1', [1, 1, 1, 1, 1, 1, 2]);
export const SONGS = [
    {
        id: 'twinkle',
        title: 'Twinkle Twinkle',
        icon: 'star.png',
        bpm: 100,
        notes: [...twinkleA, ...twinkleB, ...twinkleB, ...twinkleA],
    },
    {
        id: 'happy',
        title: 'If You’re Happy',
        icon: 'clap.png',
        bpm: 112,
        notes: [
            ...phrase('0 0 3 3 3 3 3 2 3 4', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 2]),
            ...phrase('0 0 4 4 4 4 4 3 4 5', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 2]),
            ...phrase(
                '5 5 6 6 6 6 1 1 6 6 5 5 4 4 3 3',
                [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1],
            ),
            ...phrase('3 2 2 1 1 2 3', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2]),
        ],
    },
    {
        id: 'joy',
        title: 'Ode to Joy',
        icon: 'happy.png',
        bpm: 108,
        notes: [
            ...phrase(
                '2 2 3 4 4 3 2 1 0 0 1 2 2 1 1',
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2],
            ),
            ...phrase(
                '2 2 3 4 4 3 2 1 0 0 1 2 1 0 0',
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 1.5, 2],
            ),
        ],
    },
];

// Phrase boundaries add visual breathing room without changing musical timing.
const phraseEnds = {
    twinkle: [6, 13, 20, 27, 34, 41],
    happy: [9, 19, 35, 42],
    joy: [14, 29],
};
SONGS.forEach((song) => {
    song.notes = song.notes.map((note, index) => ({
        ...note,
        phraseEnd: phraseEnds[song.id].includes(index),
    }));
});
