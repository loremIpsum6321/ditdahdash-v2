// Dit-Dah-Dash_Refactored/src/js/ui/views/mainMenu.js

import { showElement, hideElement, getElementByIdSafe } from '../domUtils.js';

/**
 * js/ui/views/mainMenu.js
 * -----------------------
 * Manages the display and interaction logic for the main menu overlay.
 */

export class MainMenu {
    constructor() {
        this.mainMenuOverlay = getElementByIdSafe('main-menu-overlay');
        this.startGameButton = getElementByIdSafe('start-game-button');
        this.startLoremIpsumButton = getElementByIdSafe('start-lorem-ipsum-button'); // Changed reference and ID
        this.showSandboxButton = getElementByIdSafe('show-sandbox-button');
        this.showPlaybackButton = getElementByIdSafe('show-playback-button');
        this.showSettingsButton = getElementByIdSafe('show-settings-button'); // Needed for settings modal trigger

        if (!this.mainMenuOverlay || !this.startGameButton || !this.startLoremIpsumButton || // Updated check
            !this.showSandboxButton || !this.showPlaybackButton || !this.showSettingsButton) {
            console.error("MainMenu: Could not find all required main menu elements (including loremipsum). Check IDs.");
        }
    }

    /**
     * Shows the main menu overlay.
     */
    show() {
        // console.log("MainMenu: Showing"); // Debug
        if (this.mainMenuOverlay) {
            showElement(this.mainMenuOverlay);
            // Optional: Focus the first button when shown for accessibility
            // this.startGameButton?.focus();
        }
    }

    /**
     * Hides the main menu overlay.
     */
    hide() {
         // console.log("MainMenu: Hiding"); // Debug
        if (this.mainMenuOverlay) {
            hideElement(this.mainMenuOverlay);
        }
    }

    /**
     * Adds event listeners to the main menu buttons.
     * @param {object} callbacks - An object containing callback functions for button clicks.
     * @param {function} callbacks.onShowLevelSelect - Called when 'Start Game' is clicked.
     * @param {function} callbacks.onStartLoremIpsum - Called when 'LoremIpsum Mode' is clicked. (Renamed callback)
     * @param {function} callbacks.onShowSandbox - Called when 'Sandbox Mode' is clicked.
     * @param {function} callbacks.onShowPlayback - Called when 'Sentence Playback' is clicked.
     * @param {function} [callbacks.onShowSettings] - Called when 'Settings' is clicked (optional, might be handled by ModalManager).
     */
    addEventListeners(callbacks) {
        if (!callbacks) {
            console.error("MainMenu: Missing callbacks object for addEventListeners.");
            return;
        }

        if (this.startGameButton && typeof callbacks.onShowLevelSelect === 'function') {
            this.startGameButton.addEventListener('click', callbacks.onShowLevelSelect);
        }
        if (this.startLoremIpsumButton && typeof callbacks.onStartLoremIpsum === 'function') { // Updated listener for LoremIpsum button
            this.startLoremIpsumButton.addEventListener('click', callbacks.onStartLoremIpsum);
        }
        if (this.showSandboxButton && typeof callbacks.onShowSandbox === 'function') {
            this.showSandboxButton.addEventListener('click', callbacks.onShowSandbox);
        }
        if (this.showPlaybackButton && typeof callbacks.onShowPlayback === 'function') {
            this.showPlaybackButton.addEventListener('click', callbacks.onShowPlayback);
        }
        // Note: The Settings button ('show-settings-button') click is typically handled
        // by the ModalManager instance itself, which listens for its assigned openButtonId.
        // If separate handling is needed here, uncomment the following:
        // if (this.showSettingsButton && typeof callbacks.onShowSettings === 'function') {
        //     this.showSettingsButton.addEventListener('click', callbacks.onShowSettings);
        // }

        console.log("MainMenu: Event listeners added.");
    }
}

// Example Usage (in main.js or uiManagerFacade.js):
// import { MainMenu } from './views/mainMenu.js';
// const mainMenu = new MainMenu();
// mainMenu.addEventListeners({
//     onShowLevelSelect: () => { /* navigate to level select */ },
//     onStartLoremIpsum: () => { /* start lorem ipsum mode */ }, // Renamed callback
//     onShowSandbox: () => { /* navigate to sandbox */ },
//     onShowPlayback: () => { /* navigate to playback */ }
// });
// mainMenu.show();