// Dit-Dah-Dash_Refactored/src/js/ui/uiManagerFacade.js

import { getElementByIdSafe, showElement, hideElement } from './domUtils.js';
import { MainMenu } from './views/mainMenu.js';
import { GameScreen } from './views/gameScreen.js';
import { PaddleControls } from './views/paddleControls.js';
import { PlaybackScreen } from './views/playbackScreen.js';
import { SandboxScreen } from './views/sandboxScreen.js';
import { LevelSelectScreen } from './views/levelSelect.js';
import { ResultsScreen } from './views/resultsScreen.js';
import { AppMode } from '../core/appStatus.js'; // Import AppMode

// Note: SettingsModal UI elements are managed by its own class,
// but the modal container visibility is handled by ModalManager.

/**
 * js/ui/uiManagerFacade.js
 * ------------------------
 * Coordinates the different UI view modules, handling transitions between screens
 * and managing global UI states like themes.
 */

export class UIManagerFacade {
    /**
     * @param {MorseDecoder} morseDecoderInstance - Needed by GameScreen.
     */
    constructor(morseDecoderInstance) {
        // Main containers referenced for visibility toggling
        this.bodyElement = document.body;
        this.displayArea = getElementByIdSafe('display-area');
        this.inputArea = getElementByIdSafe('input-area'); // Paddle area

        // Instantiate specific view controllers
        this.mainMenu = new MainMenu();
        this.gameScreen = new GameScreen(morseDecoderInstance);
        this.paddleControls = new PaddleControls();
        this.playbackScreen = new PlaybackScreen();
        this.sandboxScreen = new SandboxScreen();
        this.levelSelectScreen = new LevelSelectScreen();
        this.resultsScreen = new ResultsScreen();
        // Note: ModalManager for settings modal is instantiated separately

        this.activeView = null; // Track the currently active view module

        console.log("UIManagerFacade Initialized.");
    }

    /**
     * Hides all primary view areas managed by the facade.
     * @private
     */
    _hideAllViews() {
        this.mainMenu.hide();
        this.gameScreen.hide();
        this.playbackScreen.hide();
        this.sandboxScreen.hide();
        this.levelSelectScreen.hide();
        this.resultsScreen.hide();
        // The input area (paddles) visibility is handled separately by view transitions
    }

    /**
     * Manages the visibility of the paddle input area based on the active view.
     * @param {boolean} showPaddles - True to show the input area, false to hide.
     * @private
     */
    _setInputAreaVisibility(showPaddles) {
        if (this.inputArea) {
            if (showPaddles) {
                showElement(this.inputArea);
            } else {
                hideElement(this.inputArea);
            }
        }
         // Toggle body class for display area resizing based on paddle visibility
         this.bodyElement.classList.toggle('input-area-hidden', !showPaddles);
    }

    // --- View Switching Methods ---

    showMainMenu() {
        this._hideAllViews();
        this.mainMenu.show();
        this._setInputAreaVisibility(false); // No paddles on main menu
        this.activeView = this.mainMenu;
        console.log("UI Facade: Showing Main Menu");
    }

    /** Shows the main game screen UI, used for Game, Sandbox, and LoremIpsum modes. */
    showGameScreen() {
        this._hideAllViews();
        this.gameScreen.show();
        this.paddleControls.updatePaddleLabels('game'); // Set paddle labels for game mode
        this._setInputAreaVisibility(true); // Show paddles for game
        this.activeView = this.gameScreen;
        // Log specific mode later when setting up listeners/state
        console.log("UI Facade: Showing Game Screen (for Game/Sandbox/LoremIpsum)");
    }

    showPlaybackScreen() {
        this._hideAllViews();
        this.playbackScreen.show();
        this._setInputAreaVisibility(false); // No paddles for playback setup
        this.activeView = this.playbackScreen;
        console.log("UI Facade: Showing Playback Screen");
    }

    showSandboxScreen() {
        this._hideAllViews();
        this.sandboxScreen.show();
        this._setInputAreaVisibility(false); // No paddles for sandbox setup
        this.activeView = this.sandboxScreen;
        console.log("UI Facade: Showing Sandbox Screen");
    }

    /**
     * Shows the level selection screen and populates the list.
     * @param {Array<object>} levelsWithStatus - Data from LevelManager.
     */
    showLevelSelectScreen(levelsWithStatus) {
        this._hideAllViews();
        this.levelSelectScreen.populateLevelList(levelsWithStatus);
        this.levelSelectScreen.show();
        this._setInputAreaVisibility(false); // No paddles for level select
        this.activeView = this.levelSelectScreen;
        console.log("UI Facade: Showing Level Select Screen");
    }

    /**
     * Shows the results screen, populates it, and configures paddles.
     * Note: Results screen is typically NOT shown for LoremIpsum mode.
     * @param {object} scores - Calculated scores.
     * @param {number | null} unlockedLevelId - ID of unlocked level, if any.
     * @param {boolean} hasNextLevelOption - If 'Next' option is valid.
     * @param {AppMode} mode - Game mode (GAME/SANDBOX/LOREM_IPSUM).
     * @param {object} keyMappings - Current key mappings for hints.
     */
    showResultsScreen(scores, unlockedLevelId, hasNextLevelOption, mode, keyMappings) {
        // Do not show results for LoremIpsum mode
        if (mode === AppMode.LOREM_IPSUM) {
             console.log("UI Facade: Skipping results screen for LoremIpsum mode.");
             // Potentially navigate somewhere else, like main menu? Or just stay?
             // For now, we assume the GameController handles the flow for LoremIpsum.
             return;
        }

        this._hideAllViews();
        this.resultsScreen.show(scores, unlockedLevelId, hasNextLevelOption, mode, keyMappings);
        this.paddleControls.updatePaddleLabels('results', hasNextLevelOption, mode); // Set paddle labels for results
        this._setInputAreaVisibility(true); // Show paddles for results input
        this.activeView = this.resultsScreen;
        console.log("UI Facade: Showing Results Screen");
    }

    // --- Global UI Management ---

    /**
     * Applies the dark mode theme to the body element.
     * @param {boolean} enable - True to enable dark mode, false for light mode.
     */
    applyDarkMode(enable) {
        this.bodyElement.classList.toggle('dark-mode', enable);
        console.log(`UI Facade: Dark Mode ${enable ? 'Enabled' : 'Disabled'}`);
    }

    // --- Accessors for View Modules (Optional) ---
    // Provides controlled access if other modules need direct interaction
    getGameScreen() { return this.gameScreen; }
    getPaddleControls() { return this.paddleControls; }
    getPlaybackScreen() { return this.playbackScreen; }
    getSandboxScreen() { return this.sandboxScreen; }
    getMainMenu() { return this.mainMenu; } // Added getter for main menu
    // ... add others if needed

     /**
      * Adds event listeners by delegating to the appropriate view modules.
      * This centralizes listener setup after all modules are instantiated.
      * @param {object} callbacks - A comprehensive object containing all necessary callbacks for all views.
      * @param {function} callbacks.onShowMainMenu
      * @param {function} callbacks.onShowLevelSelect
      * @param {function} callbacks.onStartLoremIpsum - Renamed from onStartEndless
      * @param {function} callbacks.onShowSandbox
      * @param {function} callbacks.onShowPlayback
      * @param {function} callbacks.onLevelSelect
      * @param {function} callbacks.onStartSandbox
      * @param {function} callbacks.onPlaySentence
      * @param {function} callbacks.onVolumeChange
      * @param {function} callbacks.onHintToggle
      * @param {function} callbacks.onSandboxInputChange
      */
     addEventListeners(callbacks) {
         if (!callbacks) {
             console.error("UIManagerFacade: Missing callbacks object for addEventListeners.");
             return;
         }

         // Call addEventListeners on each view module, passing relevant callbacks
         this.mainMenu.addEventListeners({
             onShowLevelSelect: callbacks.onShowLevelSelect,
             onStartLoremIpsum: callbacks.onStartLoremIpsum, // Use renamed callback
             onShowSandbox: callbacks.onShowSandbox,
             onShowPlayback: callbacks.onShowPlayback,
             // onShowSettings handled by ModalManager instance setup in main.js
         });

         this.gameScreen.addEventListeners({
             onVolumeChange: callbacks.onVolumeChange, // Handle volume slider in game screen
             onHintToggle: callbacks.onHintToggle,
             onShowMainMenu: callbacks.onShowMainMenu,
         });

          this.playbackScreen.addEventListeners({
             onPlaySentence: callbacks.onPlaySentence,
             onShowMainMenu: callbacks.onShowMainMenu,
         });

          this.sandboxScreen.addEventListeners({
             onStartSandbox: callbacks.onStartSandbox,
             onShowMainMenu: callbacks.onShowMainMenu,
             onInputChange: callbacks.onSandboxInputChange,
         });

         this.levelSelectScreen.addEventListeners({
              onLevelSelect: callbacks.onLevelSelect,
              onShowMainMenu: callbacks.onShowMainMenu,
         });

          this.resultsScreen.addEventListeners({
              onShowMainMenu: callbacks.onShowMainMenu,
              // Retry/Next input handled globally by input/keying logic
         });

         // Note: PaddleControls doesn't need listeners setup here, it handles its own drag/drop internally.
         // Note: SettingsModal listeners setup separately when modal instance is created.

        console.log("UIManagerFacade: Event listeners delegated to views.");
     }

}

// Example Usage (in main.js):
// import { UIManagerFacade } from './ui/uiManagerFacade.js';
// import { MorseDecoder } from './game/morseDecoder.js';
//
// const morseDecoder = new MorseDecoder();
// const uiFacade = new UIManagerFacade(morseDecoder);
//
// // Setup all callbacks needed by ANY view module
// const uiCallbacks = {
//      onShowLevelSelect: () => { /* show level select logic */ },
//      onStartLoremIpsum: () => { /* start lorem ipsum mode logic */ }, // Renamed callback
//      onShowSandbox: () => { /* show sandbox logic */ },
//      // ... all other callbacks ...
//      onShowMainMenu: () => uiFacade.showMainMenu(),
// };
// uiFacade.addEventListeners(uiCallbacks);
//
// uiFacade.showMainMenu(); // Show initial view
// uiFacade.applyDarkMode(true);