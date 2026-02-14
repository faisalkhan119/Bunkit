/**
 * PWA Compatibility & Edge Case Handling
 * Covers: Android Back Button, Dark Mode Sync, Persistent Storage
 */

(function () {
    'use strict';

    // 1. Persistent Storage Request
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
            if (granted) {
                console.log("✅ Persistent storage granted");
            } else {
                console.log("⚠️ Persistent storage denied");
            }
        });
    }

    // 2. Dark Mode Sync with System
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function updateTheme(e) {
        // Only auto-switch if user hasn't manually overridden (optional logic, 
        // here we simply sync with system if no local preference is strictly set to opposite)
        // For Bunkit, let's prioritize system preference if no manual toggle logic interferes.
        // Assuming body.dark-mode is the toggle.

        if (e.matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Initial Check
    updateTheme(darkModeQuery);

    // Listen for changes
    darkModeQuery.addEventListener('change', updateTheme);


    // 3. Android Hardware Back Button for Modals (History API)
    // When a modal opens, we push a state. When back is pressed, we close the modal.

    // We need to hook into the existing modal opening logic. 
    // Since we can't easily rewrite all openModal calls, we can use a MutationObserver 
    // or expose a global helper. 

    // Simplest approach for existing app: 
    // Monitor style='display: block' on .modal elements.

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.classList.contains('modal')) {
                    if (target.style.display === 'block' || target.style.display === 'flex') {
                        // Modal Opened -> Push History State
                        // Avoid pushing duplicate states if already there
                        if (!history.state || history.state.modalId !== target.id) {
                            history.pushState({ modalId: target.id }, '', '#modal-open');
                        }
                    }
                }
            }
        });
    });

    // Observe all modals
    document.addEventListener('DOMContentLoaded', () => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            observer.observe(modal, { attributes: true });
        });

        // Also sync theme again on load
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }
    });

    // Handle Back Button
    window.addEventListener('popstate', (event) => {
        // If we are going back from a modal state
        const openModals = document.querySelectorAll('.modal');
        let closedAny = false;

        openModals.forEach(modal => {
            if (modal.style.display === 'block' || modal.style.display === 'flex') {
                // Determine if this exact modal was linked to the state is hard without strict tracking,
                // but generally back button should close the top-most or all open modals.
                // For Bunkit, usually only one modal is open.

                // Existing close logic might rely on `closeModal()` function being global
                if (window.closeModal) {
                    window.closeModal(modal.id);
                } else {
                    modal.style.display = 'none';
                }
                closedAny = true;
            }
        });

        // If we popped state but no modal was open (maybe disjointed state), do nothing special.
        // If we closed a modal, we are good.
    });

})();
