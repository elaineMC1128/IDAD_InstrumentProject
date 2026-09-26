// Choose Song guidance: cycle the focus frame and hand through all three songs.
export function createChooseGuidance(root, trigger) {
    const closeButton = root.querySelector('#close-choose-guidance');
    const cards = [...root.querySelectorAll('.choose-guidance-card')];
    let timer;
    let current = 0;

    function show(index) {
        current = index;
        cards.forEach((card, cardIndex) => {
            card.classList.toggle('is-active', cardIndex === current);
        });
    }

    function stop() {
        window.clearInterval(timer);
        timer = undefined;
    }

    function open() {
        stop();
        show(0);
        root.hidden = false;
        timer = window.setInterval(() => show((current + 1) % cards.length), 1000);
        closeButton.focus();
    }

    function close(restoreFocus = true) {
        if (root.hidden) return;
        stop();
        root.hidden = true;
        if (restoreFocus) trigger.focus();
    }

    closeButton.addEventListener('click', () => close());
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !root.hidden) close();
    });

    return { open, close };
}
