// This prototype visualises held notes as radial energy that grows from a shared centre.
import { COLORS, playNote } from './audio.js';

const ANGLE_ATTEMPTS = 12;
const MIN_ANGLE_GAP = (20 * Math.PI) / 180;

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function angleDistance(first, second) {
    const difference = Math.abs(first - second) % (Math.PI * 2);
    return Math.min(difference, Math.PI * 2 - difference);
}

export function createFreeplay(screen) {
    let voice = 'piano';
    // Each branch uses its key's fixed palette colour; only the existing palette control can remap keys.
    let colors = [...COLORS];
    const keys = [...screen.querySelectorAll('.key')];
    const panel = screen.querySelector('.music-canvas');
    const radialCanvas = document.createElement('canvas');
    radialCanvas.className = 'radial-canvas';
    panel.append(radialCanvas);
    const context = radialCanvas.getContext('2d');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    // Released branches remain separate so a repeated note can start while its older branch retracts.
    const activeBranches = new Map();
    const retractingBranches = new Set();
    let displayWidth = 0;
    let displayHeight = 0;
    let smallDimension = 0;
    let animationFrame;
    let lastTimestamp;

    function allBranches() {
        return [...activeBranches.values(), ...retractingBranches];
    }

    // Angle retries reduce overlap, while the best available random angle keeps crowded scenes responsive.
    function chooseBranchAngle() {
        const branches = allBranches();
        if (!branches.length) return randomBetween(0, Math.PI * 2);
        let bestAngle = 0;
        let bestGap = -1;
        for (let attempt = 0; attempt < ANGLE_ATTEMPTS; attempt++) {
            const angle = randomBetween(0, Math.PI * 2);
            const closestGap = Math.min(
                ...branches.map((branch) => angleDistance(angle, branch.angle)),
            );
            if (closestGap >= MIN_ANGLE_GAP) return angle;
            if (closestGap > bestGap) {
                bestAngle = angle;
                bestGap = closestGap;
            }
        }
        return bestAngle;
    }

    function drawGuide() {
        const centreX = displayWidth / 2;
        const centreY = displayHeight / 2;
        const ringSpacing = smallDimension * 0.18;
        const canvasRadius = Math.hypot(centreX, centreY);
        context.save();
        context.strokeStyle = 'rgb(105 105 102 / 7%)';
        context.lineWidth = 1;
        for (let radius = ringSpacing; radius <= canvasRadius + ringSpacing; radius += ringSpacing) {
            context.beginPath();
            context.arc(centreX, centreY, radius, 0, Math.PI * 2);
            context.stroke();
        }
        context.restore();
    }

    // Direction-aware limits use the wider horizontal space while retaining a safe vertical margin.
    function getSafeBranchLength(angle, endpointRadius) {
        const edgeMargin = 10;
        const horizontalRoom = displayWidth / 2 - endpointRadius - edgeMargin;
        const verticalRoom = displayHeight / 2 - endpointRadius - edgeMargin;
        const horizontalLimit =
            Math.abs(Math.cos(angle)) > 0.001
                ? horizontalRoom / Math.abs(Math.cos(angle))
                : Infinity;
        const verticalLimit =
            Math.abs(Math.sin(angle)) > 0.001
                ? verticalRoom / Math.abs(Math.sin(angle))
                : Infinity;
        return Math.max(0, Math.min(horizontalLimit, verticalLimit));
    }

    function drawHub() {
        const centreX = displayWidth / 2;
        const centreY = displayHeight / 2;
        context.save();
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(centreX, centreY, 16, 0, Math.PI * 2);
        context.fill();
        COLORS.forEach((color, index) => {
            const angle = (index / COLORS.length) * Math.PI * 2 - Math.PI / 2;
            context.fillStyle = color;
            context.beginPath();
            context.arc(
                centreX + Math.cos(angle) * 21,
                centreY + Math.sin(angle) * 21,
                5,
                0,
                Math.PI * 2,
            );
            context.fill();
        });
        context.restore();
    }

    function drawBranch(branch, timestamp = 0) {
        const centreX = displayWidth / 2;
        const centreY = displayHeight / 2;
        const breathing =
            branch.phase === 'held' && !reducedMotion.matches
                ? Math.sin(timestamp / 650 + branch.breathPhase) * 2
                : 0;
        const length = Math.max(0, branch.currentLength + breathing);
        const endX = centreX + Math.cos(branch.angle) * length;
        const endY = centreY + Math.sin(branch.angle) * length;

        context.save();
        context.strokeStyle = branch.color;
        context.lineWidth = branch.lineWidth;
        context.lineCap = 'round';
        context.globalAlpha = 0.82;
        context.beginPath();
        context.moveTo(centreX, centreY);
        context.lineTo(endX, endY);
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = branch.color;
        context.beginPath();
        context.arc(endX, endY, branch.endpointRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgb(255 255 255 / 78%)';
        context.beginPath();
        context.arc(endX, endY, branch.endpointRadius * 0.38, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function renderRadialFeedback(timestamp = 0) {
        if (!displayWidth || !displayHeight) return;
        context.clearRect(0, 0, displayWidth, displayHeight);
        drawGuide();
        allBranches().forEach((branch) => drawBranch(branch, timestamp));
        drawHub();
    }

    function updateRadialFeedback(timestamp) {
        // Delta time keeps motion consistent across frame rates, with a cap after long pauses.
        const elapsed =
            lastTimestamp === undefined
                ? 0
                : Math.min((timestamp - lastTimestamp) / 1000, 0.05);
        lastTimestamp = timestamp;
        activeBranches.forEach((branch) => {
            if (branch.phase !== 'growing') return;
            branch.currentLength = Math.min(
                branch.maximumLength,
                branch.currentLength + branch.growthSpeed * elapsed,
            );
            if (branch.currentLength >= branch.maximumLength) branch.phase = 'held';
        });
        retractingBranches.forEach((branch) => {
            branch.currentLength -= branch.retractSpeed * elapsed;
            if (branch.currentLength <= 0) retractingBranches.delete(branch);
        });
        renderRadialFeedback(timestamp);

        // One shared loop runs only while a branch is growing, held, or retracting.
        if (activeBranches.size || retractingBranches.size) {
            animationFrame = requestAnimationFrame(updateRadialFeedback);
        } else {
            animationFrame = undefined;
            lastTimestamp = undefined;
        }
    }

    function ensureAnimationLoop() {
        if (animationFrame !== undefined || reducedMotion.matches) return;
        lastTimestamp = undefined;
        animationFrame = requestAnimationFrame(updateRadialFeedback);
    }

    // Each input moves its branch through growing, held, and retracting phases.
    function startRadialFeedback(index) {
        if (activeBranches.has(index) || !smallDimension) return;
        const endpointRadius = randomBetween(9, 21);
        const angle = chooseBranchAngle();
        const reachRatio = randomBetween(0.92, 0.98);
        const maximumLength = getSafeBranchLength(angle, endpointRadius) * reachRatio;
        // Reduced motion shows a short static branch while held and removes it on release.
        const branch = {
            index,
            color: colors[index],
            angle,
            currentLength: reducedMotion.matches
                ? Math.min(48, maximumLength)
                : randomBetween(24, 38),
            maximumLength,
            reachRatio,
            growthSpeed: randomBetween(120, 210),
            retractSpeed: randomBetween(180, 300),
            endpointRadius,
            lineWidth: randomBetween(4, 9),
            breathPhase: randomBetween(0, Math.PI * 2),
            phase: reducedMotion.matches ? 'held' : 'growing',
        };
        activeBranches.set(index, branch);
        renderRadialFeedback();
        ensureAnimationLoop();
    }

    function releaseRadialFeedback(index) {
        const branch = activeBranches.get(index);
        if (!branch) return;
        activeBranches.delete(index);
        if (reducedMotion.matches) {
            renderRadialFeedback();
            return;
        }
        branch.phase = 'retracting';
        retractingBranches.add(branch);
        ensureAnimationLoop();
    }

    function stopAllRadialFeedback() {
        activeBranches.clear();
        retractingBranches.clear();
        if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
        lastTimestamp = undefined;
        renderRadialFeedback();
    }

    function resizeRadialCanvas() {
        // Resizing scales live branch geometry before redrawing the high-DPI canvas.
        const bounds = panel.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const nextSmallDimension = Math.min(bounds.width, bounds.height);
        const branchProgress = new Map();
        if (smallDimension) {
            const scale = nextSmallDimension / smallDimension;
            allBranches().forEach((branch) => {
                branchProgress.set(
                    branch,
                    branch.maximumLength ? branch.currentLength / branch.maximumLength : 0,
                );
                branch.growthSpeed *= scale;
                branch.retractSpeed *= scale;
                branch.endpointRadius *= scale;
                branch.lineWidth *= scale;
            });
        }
        displayWidth = bounds.width;
        displayHeight = bounds.height;
        smallDimension = nextSmallDimension;
        allBranches().forEach((branch) => {
            branch.maximumLength =
                getSafeBranchLength(branch.angle, branch.endpointRadius) * branch.reachRatio;
            if (branchProgress.has(branch)) {
                branch.currentLength = Math.min(
                    branch.maximumLength,
                    branch.maximumLength * branchProgress.get(branch),
                );
            }
        });
        const pixelRatio = window.devicePixelRatio || 1;
        radialCanvas.width = Math.round(displayWidth * pixelRatio);
        radialCanvas.height = Math.round(displayHeight * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        renderRadialFeedback();
    }

    new ResizeObserver(resizeRadialCanvas).observe(panel);

    // The explicit palette control changes the key mapping without randomising colours per note.
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

    // Leaving Free Play clears transient branches and cancels the shared animation frame.
    return {
        enter() {
            resizeRadialCanvas();
        },
        leave: stopAllRadialFeedback,
        activate: startRadialFeedback,
        release: releaseRadialFeedback,
        press(index) {
            playNote(index, 0.6, voice);
        },
    };
}
