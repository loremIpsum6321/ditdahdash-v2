// Dit-Dah-Dash_Refactored/src/js/ui/views/sandboxScreen.js

import { showElement, hideElement, setTextContent, getElementByIdSafe } from '../domUtils.js';

/**
 * js/ui/views/sandboxScreen.js
 * ----------------------------
 * Manages the display and interaction logic for the Sandbox setup screen.
 */

export class SandboxScreen {
    constructor() {
        this.sandboxArea = getElementByIdSafe('sandbox-area');
        this.sandboxInput = getElementByIdSafe('sandbox-input');
        this.startSandboxButton = getElementByIdSafe('start-sandbox-button');
        this.sandboxMorsePreview = getElementByIdSafe('sandbox-morse-preview');
        this.menuButton = getElementByIdSafe('sandbox-menu-button');

        if (!this.sandboxArea || !this.sandboxInput || !this.startSandboxButton || !this.sandboxMorsePreview || !this.menuButton) {
            console.error("SandboxScreen: Could not find all required sandbox screen elements. Check IDs.");
        }
    }

    /**
     * Shows the sandbox setup screen.
     */
    show() {
        // console.log("SandboxScreen: Showing"); // Debug
        if (this.sandboxArea) {
            this.reset();
            showElement(this.sandboxArea);
            this.sandboxInput?.focus(); // Focus input field when shown
        }
    }

    /**
     * Hides the sandbox setup screen.
     */
    hide() {
        // console.log("SandboxScreen: Hiding"); // Debug
        if (this.sandboxArea) {
            hideElement(this.sandboxArea);
        }
    }

    /**
     * Resets the sandbox screen elements.
     */
    reset() {
        if (this.sandboxInput) {
            this.sandboxInput.value = '';
        }
        this.updateMorsePreview(""); // Clear preview
        // Button state (enabled/disabled) might be handled by main logic based on input value
    }

    /**
     * Updates the text content of the Morse code preview area.
     * @param {string} text - The Morse preview text to display. Use empty string or space for placeholder.
     */
    updateMorsePreview(text) {
        // Use non-breaking space as placeholder if text is empty/falsy
        const displayValue = text || '\u00A0';
        setTextContent(this.sandboxMorsePreview, displayValue);
    }

    /**
     * Gets the current value from the sentence input field.
     * @returns {string} The text entered by the user.
     */
    getSentence() {
        return this.sandboxInput ? this.sandboxInput.value : "";
    }

    /**
     * Adds event listeners to the sandbox screen elements.
     * @param {object} callbacks - An object containing callback functions.
     * @param {function} callbacks.onStartSandbox - Called when 'Start Practice' is clicked.
     * @param {function} callbacks.onShowMainMenu - Called when the menu button is clicked.
     * @param {function} callbacks.onInputChange - Called when the input field value changes.
     */
    addEventListeners(callbacks) {
        if (!callbacks) {
            console.error("SandboxScreen: Missing callbacks object for addEventListeners.");
            return;
        }

        if (this.startSandboxButton && typeof callbacks.onStartSandbox === 'function') {
            this.startSandboxButton.addEventListener('click', callbacks.onStartSandbox);
        }

        if (this.menuButton && typeof callbacks.onShowMainMenu === 'function') {
            this.menuButton.addEventListener('click', callbacks.onShowMainMenu);
        }

        // Update preview as user types
        if (this.sandboxInput && typeof callbacks.onInputChange === 'function') {
            this.sandboxInput.addEventListener('input', callbacks.onInputChange);
        }

        console.log("SandboxScreen: Event listeners added.");
    }
}

// Example Usage (in main.js or uiManagerFacade.js):
// import { SandboxScreen } from './views/sandboxScreen.js';
// const sandboxScreen = new SandboxScreen();
// sandboxScreen.addEventListeners({
//     onStartSandbox: () => { /* get sentence, start sandbox game */ },
//     onShowMainMenu: () => { /* navigate to main menu */ },
//     onInputChange: () => { /* update Morse preview */ }
// });
// sandboxScreen.show();