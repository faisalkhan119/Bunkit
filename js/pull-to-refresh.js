/**
 * iOS PWA Pull-to-Refresh Implementation
 * Simulates native pull-to-refresh behavior for standalone PWAs
 */

(function () {
    // Only active in standalone mode (PWA) and on touch devices
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isTouch = 'ontouchstart' in window;

    if (!isStandalone || !isTouch) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let refreshThreshold = 150; // px to pull before refresh triggers
    let isRefreshing = false;

    // Create Refresh Indicator
    const spinner = document.createElement('div');
    spinner.id = 'ptr-spinner';
    spinner.innerHTML = '&#8635;'; // Unicode Refresh Icon
    Object.assign(spinner.style, {
        position: 'fixed',
        top: '-50px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        width: '40px',
        height: '40px',
        backgroundColor: 'white',
        borderRadius: '50%',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        transition: 'top 0.2s ease, transform 0.2s ease',
        opacity: '0.8'
    });
    document.body.appendChild(spinner);

    document.addEventListener('touchstart', (e) => {
        if (document.documentElement.scrollTop === 0 && document.body.scrollTop === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
        } else {
            isPulling = false;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isPulling || isRefreshing) return;

        currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        if (diff > 0) {
            // Resistance effect
            const moveY = Math.min(diff * 0.5, refreshThreshold + 50);

            if (moveY > 0) {
                // Prevent default scrolling if we are pulling down at the top
                if (e.cancelable) e.preventDefault();

                spinner.style.top = `${moveY - 40}px`;
                spinner.style.transform = `translateX(-50%) rotate(${moveY * 2}deg)`;

                if (moveY >= refreshThreshold) {
                    spinner.style.color = '#667eea'; // Active color
                } else {
                    spinner.style.color = 'black';
                }
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!isPulling || isRefreshing) return;

        const diff = currentY - startY;
        const moveY = Math.min(diff * 0.5, refreshThreshold + 50);

        if (moveY >= refreshThreshold) {
            // Trigger Refresh
            isRefreshing = true;
            spinner.style.top = '20px';
            spinner.style.animation = 'spin 1s linear infinite';

            // Add spin animation style if not exists
            if (!document.getElementById('ptr-style')) {
                const style = document.createElement('style');
                style.id = 'ptr-style';
                style.innerHTML = '@keyframes spin { 100% { transform: translateX(-50%) rotate(360deg); } }';
                document.head.appendChild(style);
            }

            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(50);

            // Reload page
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            // Reset
            spinner.style.top = '-50px';
            spinner.style.transform = 'translateX(-50%)';
        }

        isPulling = false;
        startY = 0;
        currentY = 0;
    }, { passive: true });

})();
