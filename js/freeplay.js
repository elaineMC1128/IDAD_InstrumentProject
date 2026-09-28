// Free Play combines the shared instrument audio with a temporary colour-ripple matrix.
import { COLORS, playNote } from './audio.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const GRID_ROWS = 5;
const GRID_COLUMNS = 11;
const MATRIX_WIDTH = 1100;
const MATRIX_HEIGHT = 500;
const CELL_RADIUS = 19;
const STEP_DELAY = 60;
const CELL_VISIBLE_DURATION = 150;
const FADE_DURATION = 280;
const NEUTRAL_COLOR = '#d9d9d6';

export function createFreeplay(screen) {
    let voice = 'piano';
    let colors = [...COLORS];
    let previousOrigin = -1;
    let rippleSequence = 0;
    let cleanupGeneration = 0;
    const keys = [...screen.querySelectorAll('.key')];
    const panel = screen.querySelector('.music-canvas');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const pendingTimers = new Set();
    const cells = [];

    function createMatrix() {
        const matrix = document.createElementNS(SVG_NAMESPACE, 'svg');
        matrix.classList.add('ripple-matrix');
        matrix.setAttribute('viewBox', `0 0 ${MATRIX_WIDTH} ${MATRIX_HEIGHT}`);
        matrix.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        matrix.setAttribute('aria-hidden', 'true');
        const horizontalGap = (MATRIX_WIDTH - 140) / (GRID_COLUMNS - 1);
        const verticalGap = (MATRIX_HEIGHT - 110) / (GRID_ROWS - 1);

        for (let row = 0; row < GRID_ROWS; row++) {
            for (let column = 0; column < GRID_COLUMNS; column++) {
                const element = document.createElementNS(SVG_NAMESPACE, 'circle');
                element.classList.add('matrix-cell');
                element.setAttribute('cx', 70 + column * horizontalGap);
                element.setAttribute('cy', 55 + row * verticalGap);
                element.setAttribute('r', CELL_RADIUS);
                matrix.append(element);
                cells.push({
                    element,
                    row,
                    column,
                    latestRippleId: 0,
                    displayedRippleId: 0,
                });
            }
        }
        panel.append(matrix);
    }

    // A few retries make consecutive random origins different without restricting later choices.
    function chooseRandomOrigin() {
        const cellCount = GRID_ROWS * GRID_COLUMNS;
        let origin = Math.floor(Math.random() * cellCount);
        for (let attempt = 0; attempt < 5 && origin === previousOrigin; attempt++) {
            origin = Math.floor(Math.random() * cellCount);
        }
        previousOrigin = origin;
        return origin;
    }

    function schedule(callback, delay) {
        const timer = setTimeout(() => {
            pendingTimers.delete(timer);
            callback();
        }, delay);
        pendingTimers.add(timer);
    }

    function resetCell(cell) {
        cell.element.classList.remove('is-origin');
        cell.element.style.removeProperty('--matrix-transition-duration');
        cell.element.style.fill = NEUTRAL_COLOR;
        cell.element.style.opacity = '1';
        cell.latestRippleId = 0;
        cell.displayedRippleId = 0;
    }

    function updateCell(cell, color, opacity, rippleId, isOrigin, generation) {
        // The newest scheduled ripple owns the cell, so older delayed work cannot overwrite it.
        if (generation !== cleanupGeneration || rippleId !== cell.latestRippleId) return;
        cell.displayedRippleId = rippleId;
        cell.element.style.setProperty('--matrix-transition-duration', '90ms');
        cell.element.style.fill = color;
        cell.element.style.opacity = opacity;
        cell.element.classList.toggle('is-origin', isOrigin);

        const visibleDuration = reducedMotion.matches ? 180 : CELL_VISIBLE_DURATION;
        const fadeDuration = reducedMotion.matches ? 240 : FADE_DURATION;
        schedule(() => {
            if (generation !== cleanupGeneration || cell.displayedRippleId !== rippleId) return;
            cell.displayedRippleId = 0;
            cell.element.classList.remove('is-origin');
            cell.element.style.setProperty(
                '--matrix-transition-duration',
                `${fadeDuration}ms`,
            );
            cell.element.style.fill = NEUTRAL_COLOR;
            cell.element.style.opacity = '1';
        }, visibleDuration);
    }

    function scheduleRippleCell(cell, distance, color, rippleId, generation) {
        // Distance controls travel timing and brightness; reduced motion reveals the cross at once.
        const delay = reducedMotion.matches ? 0 : distance * STEP_DELAY;
        const opacity = Math.max(0.34, 1 - distance * 0.09);
        schedule(
            () => updateCell(cell, color, opacity, rippleId, distance === 0, generation),
            delay,
        );
    }

    function triggerRipple(index) {
        const originIndex = chooseRandomOrigin();
        const origin = cells[originIndex];
        const rippleId = ++rippleSequence;
        const generation = cleanupGeneration;
        const affectedCells = cells
            .filter((cell) => cell.row === origin.row || cell.column === origin.column)
            .map((cell) => ({
                cell,
                distance:
                    cell.row === origin.row
                        ? Math.abs(cell.column - origin.column)
                        : Math.abs(cell.row - origin.row),
            }));

        // Propagation follows only the origin's row and column, forming a travelling cross.
        affectedCells.forEach(({ cell }) => {
            cell.latestRippleId = rippleId;
        });
        affectedCells.forEach(({ cell, distance }) =>
            scheduleRippleCell(cell, distance, colors[index], rippleId, generation),
        );
    }

    // Clearing timers and advancing the generation prevents callbacks from surviving mode exit.
    function clearAllRipples() {
        cleanupGeneration++;
        pendingTimers.forEach(clearTimeout);
        pendingTimers.clear();
        cells.forEach(resetCell);
        previousOrigin = -1;
    }

    createMatrix();

    // Shuffle colours without changing pitch so visual exploration preserves the note mapping.
    screen.querySelector('#change-colors').addEventListener('click', () => {
        const previous = [...colors];
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        if (colors.every((color, i) => color === previous[i])) colors.push(colors.shift());
        keys.forEach((key, i) => key.style.setProperty('--key-color', colors[i]));
    });

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
        leave: clearAllRipples,
        press(index) {
            playNote(index, 0.6, voice);
            triggerRipple(index);
        },
    };
}
