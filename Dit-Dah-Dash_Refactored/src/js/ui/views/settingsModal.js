// Dit-Dah-Dash_Refactored/src/js/ui/views/settingsModal.js

import { getElementByIdSafe, setTextContent } from '../domUtils.js';
import {
    DEFAULT_WPM, AUDIO_DEFAULT_TONE_FREQUENCY, AUDIO_MIN_FREQUENCY, AUDIO_MAX_FREQUENCY, AUDIO_DEFAULT_VOLUME,
    KEYBINDING_DEFAULTS, getKeyDisplay
} from '../../core/configConstants.js';

/**
 * js/ui/views/settingsModal.js
 * ----------------------------
 * Manages the UI elements and interactions within the settings modal.
 */

export class SettingsModal {
    constructor() {
        // Element References (within the modal)
        this.wpmSlider = getElementByIdSafe('wpm-slider');
        this.wpmValueDisplay = getElementByIdSafe('wpm-value-display');
        this.frequencySlider = getElementByIdSafe('frequency-slider');
        this.frequencyValueDisplay = getElementByIdSafe('frequency-value-display');
        this.soundToggle = getElementByIdSafe('sound-toggle');
        this.darkModeToggle = getElementByIdSafe('dark-mode-toggle');
        this.resetProgressButton = getElementByIdSafe('reset-progress-button');
        this.ditKeyInput = getElementByIdSafe('dit-key-input');
        this.dahKeyInput = getElementByIdSafe('dah-key-input');
        // Note: Modal container, header, close button are managed by ModalManager

        // Internal state for key mapping
        this.keyInputCurrentlyListening = null; // 'dit' or 'dah' or null
        this.currentKeyMappings = { // Store locally for validation during key input
            dit: KEYBINDING_DEFAULTS.dit,
            dah: KEYBINDING_DEFAULTS.dah
        };

        // Basic validation
        if (!this.wpmSlider || !this.wpmValueDisplay || !this.frequencySlider || !this.frequencyValueDisplay ||
            !this.soundToggle || !this.darkModeToggle || !this.resetProgressButton ||
            !this.ditKeyInput || !this.dahKeyInput) {
            console.warn("SettingsModal: One or more settings elements not found. Check IDs.");
        }

        // Set initial range for frequency slider if element exists
        if (this.frequencySlider) {
             this.frequencySlider.min = String(AUDIO_MIN_FREQUENCY);
             this.frequencySlider.max = String(AUDIO_MAX_FREQUENCY);
        }

        console.log("SettingsModal Initialized.");
    }

    /**
     * Updates all UI elements within the modal to reflect the provided settings.
     * @param {object} settings - An object containing current settings values.
     * @param {number} settings.wpm
     * @param {number} settings.frequency
     * @param {number} settings.volume - (Note: Volume slider is in gameScreen.js, not modal)
     * @param {boolean} settings.soundEnabled
     * @param {boolean} settings.darkModeEnabled
     * @param {string} settings.ditKey
     * @param {string} settings.dahKey
     * @param {boolean} [settings.hintVisible] - (Hint toggle not typically in modal)
     */
    updateDisplayValues(settings) {
        if (!settings) return;

        // WPM
        if (this.wpmSlider && typeof settings.wpm === 'number') {
            this.wpmSlider.value = settings.wpm;
        }
        if (this.wpmValueDisplay && typeof settings.wpm === 'number') {
            setTextContent(this.wpmValueDisplay, settings.wpm);
        }

        // Frequency
        if (this.frequencySlider && typeof settings.frequency === 'number') {
            this.frequencySlider.value = settings.frequency;
        }
        if (this.frequencyValueDisplay && typeof settings.frequency === 'number') {
            setTextContent(this.frequencyValueDisplay, settings.frequency);
        }

        // Sound Toggle
        if (this.soundToggle && typeof settings.soundEnabled === 'boolean') {
            this.soundToggle.checked = settings.soundEnabled;
        }

        // Dark Mode Toggle
        if (this.darkModeToggle && typeof settings.darkModeEnabled === 'boolean') {
            this.darkModeToggle.checked = settings.darkModeEnabled;
        }

        // Key Mappings (Store locally and update display)
        if (typeof settings.ditKey === 'string' && typeof settings.dahKey === 'string') {
             this.currentKeyMappings.dit = settings.ditKey;
             this.currentKeyMappings.dah = settings.dahKey;
             this._updateKeyMappingDisplay(); // Update UI based on stored values
        }
    }


    // --- Key Mapping UI Logic ---

    /** Resets the display of the key mapping inputs (e.g., after listening or blur). */
    _updateKeyMappingDisplay() {
        if (this.ditKeyInput) {
            this.ditKeyInput.value = getKeyDisplay(this.currentKeyMappings.dit);
            this.ditKeyInput.classList.remove('listening');
            this.ditKeyInput.placeholder = "Click to set";
        }
        if (this.dahKeyInput) {
            this.dahKeyInput.value = getKeyDisplay(this.currentKeyMappings.dah);
            this.dahKeyInput.classList.remove('listening');
            this.dahKeyInput.placeholder = "Click to set";
        }
        this.keyInputCurrentlyListening = null; // Ensure listening state is reset
    }

    /** Handles focus event on key mapping inputs to start listening. */
    _handleKeyMappingInputFocus(event) {
        const inputElement = event.target;
        const type = (inputElement === this.ditKeyInput) ? 'dit' : 'dah';

        // If already listening on another input, reset its display first
        if (this.keyInputCurrentlyListening && this.keyInputCurrentlyListening !== type) {
            this._updateKeyMappingDisplay();
        }

        inputElement.value = "Listening...";
        inputElement.classList.add('listening');
        this.keyInputCurrentlyListening = type;
        // console.log(`Key mapping: Listening for ${type} key...`); // Debug
    }

     /** Handles keydown event when a key mapping input is focused. */
     _handleKeyMappingKeyDown(event, changeCallback) {
        if (!this.keyInputCurrentlyListening) return; // Only act if listening

        event.preventDefault();
        event.stopPropagation();

        const newKey = event.key;
        const type = this.keyInputCurrentlyListening; // 'dit' or 'dah'
        let isValid = true;
        let errorMessage = "";

        // console.log(`Key mapping: Detected key "${newKey}" for ${type}`); // Debug

        // --- Basic Validation ---
        if (newKey.trim() === '' || newKey === ' ') {
            isValid = false;
            errorMessage = "Key cannot be empty or space.";
        } else if (newKey === 'Escape') { // Allow Escape to cancel listening
             console.log("Key mapping: Escape pressed, cancelling listen.");
             this._updateKeyMappingDisplay(); // Revert display and clear listening state
             inputElement.blur(); // Remove focus
             return; // Don't process further
        }
        // Check against the *other* key's current assignment
        else if (type === 'dit' && newKey === this.currentKeyMappings.dah) {
            isValid = false;
            errorMessage = `Key "${getKeyDisplay(newKey)}" is already assigned to Dah.`;
        } else if (type === 'dah' && newKey === this.currentKeyMappings.dit) {
            isValid = false;
            errorMessage = `Key "${getKeyDisplay(newKey)}" is already assigned to Dit.`;
        }
        // Add any other restricted keys here (e.g., maybe function keys?)

        const inputElement = (type === 'dit') ? this.ditKeyInput : this.dahKeyInput;

        // --- Update or Reject ---
        if (isValid) {
            // console.log(`Key mapping: Assigning "${newKey}" to ${type}.`); // Debug

            // Update the internal state immediately for subsequent validation
            if (type === 'dit') this.currentKeyMappings.dit = newKey;
            else this.currentKeyMappings.dah = newKey;

            // Update the display and clear listening state
            this._updateKeyMappingDisplay();
            inputElement.blur(); // Remove focus after successful assignment

            // Trigger the callback to notify the application/settings manager
            if (typeof changeCallback === 'function') {
                 try {
                    changeCallback({ dit: this.currentKeyMappings.dit, dah: this.currentKeyMappings.dah });
                 } catch (e) {
                      console.error("Error in onKeyMappingChange callback:", e);
                 }
            }

        } else {
            console.warn(`Key mapping: Invalid key "${newKey}" for ${type}. Reason: ${errorMessage}`);
            // Briefly show error? Or just keep listening? Alert might be annoying.
            // alert(`Invalid key: ${errorMessage}`);
            if (inputElement) inputElement.value = "Invalid..."; // Show temporary feedback
            // Revert to listening after a short delay
            setTimeout(() => {
                if (inputElement && this.keyInputCurrentlyListening === type) { // Check if still listening for this type
                    inputElement.value = "Listening...";
                }
            }, 500);
        }
    }

    /** Handles blur event on key mapping inputs to stop listening if no key was pressed. */
    _handleKeyMappingBlur(event) {
        // Use a small timeout because blur might fire slightly before the keydown if keydown causes blur
        setTimeout(() => {
            if (this.keyInputCurrentlyListening) {
                 const relatedTarget = event.relatedTarget;
                 // Don't reset if focus moved to the *other* key input
                 if(relatedTarget !== this.ditKeyInput && relatedTarget !== this.dahKeyInput) {
                    // console.log("Key mapping: Blurred while listening, reverting display."); // Debug
                    this._updateKeyMappingDisplay(); // Reverts display and clears listening state
                 }
            }
        }, 50);
    }

    // --- End Key Mapping UI Logic ---


    /**
     * Adds event listeners to the controls within the settings modal.
     * @param {object} callbacks - Callbacks for user interactions.
     * @param {function} callbacks.onWpmChange - Called when WPM slider value is committed.
     * @param {function} callbacks.onFrequencyChange - Called when frequency slider value is committed.
     * @param {function} callbacks.onSoundToggle - Called when sound checkbox changes.
     * @param {function} callbacks.onDarkModeToggle - Called when dark mode checkbox changes.
     * @param {function} callbacks.onKeyMappingChange - Called when a valid key mapping is set.
     * @param {function} callbacks.onResetProgress - Called when the reset progress button is clicked.
     */
    addEventListeners(callbacks) {
        if (!callbacks) {
            console.error("SettingsModal: Missing callbacks object for addEventListeners.");
            return;
        }

        // WPM Slider
        if (this.wpmSlider) {
            this.wpmSlider.addEventListener('input', (e) => {
                // Update display while dragging
                if (this.wpmValueDisplay) setTextContent(this.wpmValueDisplay, e.target.value);
            });
            this.wpmSlider.addEventListener('change', (e) => {
                // Trigger callback when user releases slider
                if (typeof callbacks.onWpmChange === 'function') {
                    callbacks.onWpmChange(parseInt(e.target.value, 10));
                }
            });
             this.wpmSlider.addEventListener('mouseup', () => this.wpmSlider.blur());
             this.wpmSlider.addEventListener('touchend', () => this.wpmSlider.blur());
        }

        // Frequency Slider
        if (this.frequencySlider) {
            this.frequencySlider.addEventListener('input', (e) => {
                 if (this.frequencyValueDisplay) setTextContent(this.frequencyValueDisplay, e.target.value);
            });
            this.frequencySlider.addEventListener('change', (e) => {
                 if (typeof callbacks.onFrequencyChange === 'function') {
                    callbacks.onFrequencyChange(parseInt(e.target.value, 10));
                 }
            });
             this.frequencySlider.addEventListener('mouseup', () => this.frequencySlider.blur());
             this.frequencySlider.addEventListener('touchend', () => this.frequencySlider.blur());
        }

        // Sound Toggle
        if (this.soundToggle && typeof callbacks.onSoundToggle === 'function') {
            this.soundToggle.addEventListener('change', (e) => {
                callbacks.onSoundToggle(e.target.checked);
            });
        }

        // Dark Mode Toggle
        if (this.darkModeToggle && typeof callbacks.onDarkModeToggle === 'function') {
            this.darkModeToggle.addEventListener('change', (e) => {
                callbacks.onDarkModeToggle(e.target.checked);
            });
        }

        // Key Mapping Inputs
        if (this.ditKeyInput) {
             this.ditKeyInput.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
             this.ditKeyInput.addEventListener('keydown', (e) => this._handleKeyMappingKeyDown(e, callbacks.onKeyMappingChange));
             this.ditKeyInput.addEventListener('blur', this._handleKeyMappingBlur.bind(this));
        }
         if (this.dahKeyInput) {
             this.dahKeyInput.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
             this.dahKeyInput.addEventListener('keydown', (e) => this._handleKeyMappingKeyDown(e, callbacks.onKeyMappingChange));
             this.dahKeyInput.addEventListener('blur', this._handleKeyMappingBlur.bind(this));
        }

        // Reset Progress Button
        if (this.resetProgressButton && typeof callbacks.onResetProgress === 'function') {
            this.resetProgressButton.addEventListener('click', callbacks.onResetProgress);
        }

        console.log("SettingsModal: Event listeners added.");
    }
}

// Example Usage (likely managed by uiManagerFacade.js):
// import { SettingsModal } from './views/settingsModal.js';
// const settingsModalUI = new SettingsModal();
// settingsModalUI.addEventListeners({
//     onWpmChange: (wpm) => { /* notify settingsManager */ },
//     onFrequencyChange: (freq) => { /* notify settingsManager */ },
//     onSoundToggle: (enabled) => { /* notify settingsManager */ },
//     onDarkModeToggle: (enabled) => { /* notify settingsManager */ },
//     onKeyMappingChange: (mappings) => { /* notify settingsManager */ },
//     onResetProgress: () => { /* call main reset logic */ }
// });
// // When opening modal:
// const currentSettings = settingsManager.getSettings();
// settingsModalUI.updateDisplayValues(currentSettings);
// modalManager.open(); // Assuming a modalManager instance handles the actual modal visibility