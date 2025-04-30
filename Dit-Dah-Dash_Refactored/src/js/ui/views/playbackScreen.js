// Dit-Dah-Dash_Refactored/src/js/ui/views/playbackScreen.js

import { showElement, hideElement, setTextContent, enableElement, disableElement, getElementByIdSafe } from '../domUtils.js';

/**
 * js/ui/views/playbackScreen.js
 * -----------------------------
 * Manages the display and interaction logic for the Sentence Playback screen.
 */

export class PlaybackScreen {
    constructor() {
        this.playbackArea = getElementByIdSafe('playback-area');
        this.playbackInput = getElementByIdSafe('playback-input');
        this.playSentenceButton = getElementByIdSafe('play-sentence-button');
        this.playbackMorseDisplay = getElementByIdSafe('playback-morse-display');
        this.menuButton = getElementByIdSafe('playback-menu-button');

        if (!this.playbackArea || !this.playbackInput || !this.playSentenceButton || !this.playbackMorseDisplay || !this.menuButton) {
            console.error("PlaybackScreen: Could not find all required playback screen elements. Check IDs.");
        }
    }

    /**
     * Shows the playback screen.
     * Resets the input field and display area.
     */
    show() {
        // console.log("PlaybackScreen: Showing"); // Debug
        if (this.playbackArea) {
            this.reset();
            showElement(this.playbackArea);
            this.playbackInput?.focus(); // Focus input field when shown
        }
    }

    /**
     * Hides the playback screen.
     */
    hide() {
        // console.log("PlaybackScreen: Hiding"); // Debug
        if (this.playbackArea) {
            hideElement(this.playbackArea);
        }
    }

    /**
     * Resets the playback screen elements to their default state.
     */
    reset() {
        if (this.playbackInput) {
            this.playbackInput.value = '';
        }
        this.updateMorseDisplay(""); // Clear display
        this.setPlayButtonState(true, 'Play Morse'); // Reset button
    }

    /**
     * Updates the text content of the Morse code display area.
     * @param {string} text - The Morse text to display. Use an empty string or space for placeholder.
     */
    updateMorseDisplay(text) {
        // Use non-breaking space as placeholder if text is empty/falsy
        const displayValue = text || '\u00A0';
        setTextContent(this.playbackMorseDisplay, displayValue);
    }

    /**
     * Sets the enabled state and text of the main play/stop button.
     * @param {boolean} enabled - True to enable the button, false to disable.
     * @param {string} [text] - Optional text content for the button.
     */
    setPlayButtonState(enabled, text) {
        if (this.playSentenceButton) {
            if (enabled) {
                enableElement(this.playSentenceButton);
            } else {
                disableElement(this.playSentenceButton);
            }
            if (typeof text === 'string') {
                setTextContent(this.playSentenceButton, text);
            }
        }
    }

    /**
     * Gets the current value from the sentence input field.
     * @returns {string} The text entered by the user.
     */
    getSentence() {
        return this.playbackInput ? this.playbackInput.value : "";
    }

    /**
     * Adds event listeners to the playback screen buttons.
     * @param {object} callbacks - An object containing callback functions.
     * @param {function} callbacks.onPlaySentence - Called when 'Play/Stop Morse' is clicked.
     * @param {function} callbacks.onShowMainMenu - Called when the menu button is clicked.
     */
    addEventListeners(callbacks) {
        if (!callbacks) {
            console.error("PlaybackScreen: Missing callbacks object for addEventListeners.");
            return;
        }

        if (this.playSentenceButton && typeof callbacks.onPlaySentence === 'function') {
            this.playSentenceButton.addEventListener('click', callbacks.onPlaySentence);
        }

        if (this.menuButton && typeof callbacks.onShowMainMenu === 'function') {
            this.menuButton.addEventListener('click', callbacks.onShowMainMenu);
        }

        // Optional: Listen for Enter key in input field to trigger play?
        // if (this.playbackInput && typeof callbacks.onPlaySentence === 'function') {
        //     this.playbackInput.addEventListener('keydown', (e) => {
        //         if (e.key === 'Enter') {
        //             callbacks.onPlaySentence();
        //         }
        //     });
        // }

        console.log("PlaybackScreen: Event listeners added.");
    }
}

// Example Usage (in main.js or uiManagerFacade.js):
// import { PlaybackScreen } from './views/playbackScreen.js';
// const playbackScreen = new PlaybackScreen();
// playbackScreen.addEventListeners({
//     onPlaySentence: () => { /* get sentence, call sequence player */ },
//     onShowMainMenu: () => { /* navigate to main menu */ }
// });
// playbackScreen.show();