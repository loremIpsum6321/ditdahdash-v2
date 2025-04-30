// Dit-Dah-Dash_Refactored/src/js/input/inputHandler.js

import { getElementByIdSafe } from '../ui/domUtils.js';
import { KEYBINDING_DEFAULTS } from '../core/configConstants.js';

/**
 * js/input/inputHandler.js
 * ------------------------
 * Detects raw user input events (keyboard, mouse, touch) related to
 * Dit and Dah actions. Translates these events into simplified press/release
 * notifications via callbacks, without interpreting Morse timing or logic itself.
 */

export class InputHandler {
    /**
     * @param {object} callbacks - Functions to call on detected input actions.
     * @param {function} callbacks.onDitPress - Called when Dit action starts (any method).
     * @param {function} callbacks.onDahPress - Called when Dah action starts (any method).
     * @param {function} callbacks.onDitRelease - Called when Dit action ends (any method).
     * @param {function} callbacks.onDahRelease - Called when Dah action ends (any method).
     * @param {object} initialKeyMappings - Initial keybindings { dit: 'key', dah: 'key' }
     */
    constructor(callbacks, initialKeyMappings) {
        if (!callbacks || typeof callbacks.onDitPress !== 'function' || typeof callbacks.onDahPress !== 'function' ||
            typeof callbacks.onDitRelease !== 'function' || typeof callbacks.onDahRelease !== 'function') {
            throw new Error("InputHandler requires callbacks for onDitPress, onDahPress, onDitRelease, onDahRelease.");
        }
        this.callbacks = callbacks;

        // DOM Element References
        this.ditButton = getElementByIdSafe('dit-button');
        this.dahButton = getElementByIdSafe('dah-button');
        // References to check focus (prevent input capture when typing elsewhere)
        this.playbackInput = getElementByIdSafe('playback-input');
        this.sandboxInput = getElementByIdSafe('sandbox-input');
        this.settingsModal = getElementByIdSafe('settings-modal'); // To check if open
        this.ditKeyInput = getElementByIdSafe('dit-key-input');   // Settings key input
        this.dahKeyInput = getElementByIdSafe('dah-key-input');   // Settings key input

        // Key Mappings
        this.keyMappings = {
            dit: initialKeyMappings?.dit || KEYBINDING_DEFAULTS.dit,
            dah: initialKeyMappings?.dah || KEYBINDING_DEFAULTS.dah
        };

        // Internal state to track active inputs (prevent duplicate callbacks)
        this.isDitPressed = false; // Tracks combined state (mouse/touch)
        this.isDahPressed = false; // Tracks combined state (mouse/touch)
        this.isDitKeyPressed = false; // Tracks key state
        this.isDahKeyPressed = false; // Tracks key state
        this.activeTouchIds = { dit: null, dah: null }; // Track specific touches

        if (!this.ditButton || !this.dahButton) {
            console.error("InputHandler: Dit or Dah button element not found. Mouse/Touch input disabled.");
        }

        this._bindEvents();
        console.log("InputHandler Initialized with keys:", this.keyMappings);
    }

    /** Updates the key mappings used by the input handler. */
    updateKeyMappings(newMappings) {
        if (newMappings && typeof newMappings.dit === 'string' && typeof newMappings.dah === 'string') {
            const newDit = newMappings.dit.trim();
            const newDah = newMappings.dah.trim();
            // Basic validation: ensure keys are not empty and not identical
            if (newDit && newDah && newDit !== newDah) {
                this.keyMappings.dit = newDit;
                this.keyMappings.dah = newDah;
                // console.log("InputHandler Key Mappings Updated:", this.keyMappings); // Debug
            } else {
                console.warn("InputHandler: Invalid key mapping update ignored (empty or identical).", newMappings);
            }
        } else {
            console.warn("InputHandler: Invalid key mapping object received.", newMappings);
        }
    }

    /** Checks if input should be ignored based on focus or modal state. */
    _shouldIgnoreInput(targetElement) {
        const isSettingsKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput;
        // Ignore if focus is on text inputs, OR if settings modal is open (unless focus is specifically on a key map input *within* settings)
        const isOtherInputFocused = targetElement === this.playbackInput || targetElement === this.sandboxInput ||
                                     (targetElement instanceof HTMLElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') && !isSettingsKeyMapInputFocused);
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        // Ignore if:
        // 1. Focus is on playback/sandbox/other text input.
        // 2. Settings modal is open AND focus is *not* one of the key mapping inputs.
        return isOtherInputFocused || (isSettingsOpen && !isSettingsKeyMapInputFocused);
    }


    /** Binds touch, mouse and keyboard event listeners. */
    _bindEvents() {
        // Touch Events
        if (this.ditButton) {
            this.ditButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dit'), { passive: false });
        }
        if (this.dahButton) {
            this.dahButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dah'), { passive: false });
        }
        // Listen globally for touch end/cancel as touch might move off the button
        document.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this._handleTouchEnd.bind(this), { passive: false });

        // Mouse Events
        if (this.ditButton) {
            this.ditButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dit'));
        }
        if (this.dahButton) {
            this.dahButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dah'));
        }
        // Listen globally for mouse up as pointer might move off button before release
        document.addEventListener('mouseup', this._handleMousePressEnd.bind(this));

        // Prevent Context Menu & Drag on paddles
        [this.ditButton, this.dahButton].forEach(button => {
            button?.addEventListener('contextmenu', e => e.preventDefault());
            button?.addEventListener('dragstart', e => e.preventDefault());
        });

        // Keyboard Events (Listen on document)
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));

        console.log("InputHandler: Core event listeners bound.");
    }

    // --- Raw Event Handlers ---

    _handleKeyDown(event) {
        if (this._shouldIgnoreInput(event.target) || event.repeat) {
            return; // Ignore if input focused, settings open, or key repeat
        }

        const pressedKey = event.key;
        const isDitKey = pressedKey.toLowerCase() === this.keyMappings.dit.toLowerCase();
        const isDahKey = pressedKey.toLowerCase() === this.keyMappings.dah.toLowerCase();

        if (isDitKey && !this.isDitKeyPressed) {
             event.preventDefault();
             this.isDitKeyPressed = true;
             this.callbacks.onDitPress('key'); // Notify press with method
        } else if (isDahKey && !this.isDahKeyPressed) {
             event.preventDefault();
             this.isDahKeyPressed = true;
             this.callbacks.onDahPress('key'); // Notify press with method
        }
    }

    _handleKeyUp(event) {
         if (this._shouldIgnoreInput(event.target)) {
            // Even if ignoring input, ensure key release state is reset if necessary
            // This prevents stuck keys if focus changes while key is held.
             const releasedKey = event.key.toLowerCase();
             if (releasedKey === this.keyMappings.dit.toLowerCase()) this.isDitKeyPressed = false;
             if (releasedKey === this.keyMappings.dah.toLowerCase()) this.isDahKeyPressed = false;
             return;
         }

        const releasedKey = event.key;
        const isDitKey = releasedKey.toLowerCase() === this.keyMappings.dit.toLowerCase();
        const isDahKey = releasedKey.toLowerCase() === this.keyMappings.dah.toLowerCase();

        if (isDitKey && this.isDitKeyPressed) {
             event.preventDefault();
             this.isDitKeyPressed = false;
             this.callbacks.onDitRelease('key'); // Notify release with method
         } else if (isDahKey && this.isDahKeyPressed) {
             event.preventDefault();
             this.isDahKeyPressed = false;
             this.callbacks.onDahRelease('key'); // Notify release with method
         }
    }

    _handleMousePressStart(event, type) {
        if (event.button !== 0) return; // Only handle left clicks
        event.preventDefault();

        if (type === 'dit' && !this.isDitPressed) {
             this.isDitPressed = true;
             this.callbacks.onDitPress('mouse');
        } else if (type === 'dah' && !this.isDahPressed) {
             this.isDahPressed = true;
             this.callbacks.onDahPress('mouse');
        }
    }

    _handleMousePressEnd(event) {
        if (event.button !== 0) return; // Only handle left clicks

        // Check combined state because multiple mouse buttons don't usually overlap
        if (this.isDitPressed) {
            this.isDitPressed = false;
            this.callbacks.onDitRelease('mouse');
        }
        if (this.isDahPressed) {
            this.isDahPressed = false;
            this.callbacks.onDahRelease('mouse');
        }
    }

    _handleTouchStart(event, type) {
        event.preventDefault();
        // Allow multiple touches if they are on different paddles
        const touch = event.changedTouches[0];
        const identifier = touch.identifier;

        if (type === 'dit') {
            if (this.activeTouchIds.dit === null) { // Only process if not already touched
                this.activeTouchIds.dit = identifier;
                this.isDitPressed = true; // Set combined state
                this.callbacks.onDitPress('touch');
            }
        } else if (type === 'dah') {
            if (this.activeTouchIds.dah === null) {
                this.activeTouchIds.dah = identifier;
                this.isDahPressed = true;
                this.callbacks.onDahPress('touch');
            }
        }
    }

    _handleTouchEnd(event) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const endedId = touch.identifier;

            if (this.activeTouchIds.dit === endedId) {
                this.activeTouchIds.dit = null;
                this.isDitPressed = false; // Reset combined state
                this.callbacks.onDitRelease('touch');
            } else if (this.activeTouchIds.dah === endedId) {
                 this.activeTouchIds.dah = null;
                 this.isDahPressed = false;
                 this.callbacks.onDahRelease('touch');
            }
        }
    }
}

// Example Usage (in main.js):
// import { InputHandler } from './input/inputHandler.js';
//
// const inputHandler = new InputHandler(
//     { // Callbacks object
//         onDitPress: (method) => keyingLogic.handlePress('dit', method),
//         onDahPress: (method) => keyingLogic.handlePress('dah', method),
//         onDitRelease: (method) => keyingLogic.handleRelease('dit', method),
//         onDahRelease: (method) => keyingLogic.handleRelease('dah', method)
//     },
//     initialKeyMappings // { dit: '.', dah: '-' } e.g.
// );
// // To update mappings later:
// // inputHandler.updateKeyMappings(newMappings);