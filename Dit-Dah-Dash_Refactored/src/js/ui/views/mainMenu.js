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
        this.startEndlessButton = getElementByIdSafe('start-endless-button'); // Added Endless button reference
        this.showSandboxButton = getElementByIdSafe('show-sandbox-button');
        this.showPlaybackButton = getElementByIdSafe('show-playback-button');
        this.showSettingsButton = getElementByIdSafe('show-settings-button'); // Needed for settings modal trigger

        if (!this.mainMenuOverlay || !this.startGameButton || !this.startEndlessButton ||
            !this.showSandboxButton || !this.showPlaybackButton || !this.showSettingsButton) {
            console.error("MainMenu: Could not find all required main menu elements (including endless). Check IDs.");
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
     * @param {function} callbacks.onStartEndless - Called when 'Endless Mode' is clicked.
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
        if (this.startEndlessButton && typeof callbacks.onStartEndless === 'function') { // Added listener for Endless button
            this.startEndlessButton.addEventListener('click', callbacks.onStartEndless);
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
//     onStartEndless: () => { /* start endless mode */ }, // Added callback
//     onShowSandbox: () => { /* navigate to sandbox */ },
//     onShowPlayback: () => { /* navigate to playback */ }
// });
// mainMenu.show();