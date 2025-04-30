// Dit-Dah-Dash_Refactored/src/js/main.js

// Core Modules
import { GameState } from './core/gameState.js';
import { AppMode, GameStatus } from './core/appStatus.js'; // Import enums
import { STORAGE_KEYS, KEYBINDING_DEFAULTS, DEFAULT_WPM } from './core/configConstants.js'; // Import constants

// Data & Config
// import { LEVELS_DATA } from './data/levelsData.js'; // Not directly needed here

// Game Logic Modules
import { MorseDecoder } from './game/morseDecoder.js';
import { LevelManager } from './game/levelManager.js';
import { ScoreCalculator } from './game/scoreCalculator.js';
import { GameController } from './game/gameController.js';

// Audio Modules
import { AudioContextManager } from './audio/audioContextManager.js';
import { TonePlayer } from './audio/tonePlayer.js';
import { SequencePlayer } from './audio/sequencePlayer.js';

// Input Modules
import { InputHandler } from './input/inputHandler.js';
import { KeyingLogic } from './input/keyingLogic.js';

// UI Modules
import { UIManagerFacade } from './ui/uiManagerFacade.js';
import { Modal } from './ui/modalManager.js'; // Use the correct export name 'Modal'
import { SettingsModal } from './ui/views/settingsModal.js';

// Settings Module
import { SettingsManager } from './settingsManager.js';

/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, wires up dependencies and event callbacks,
 * manages the main application lifecycle.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Dit-Dah-Dash Refactored Initializing...");

    // --- Instantiate Core Modules ---
    const gameState = new GameState();
    const morseDecoder = new MorseDecoder();
    const levelManager = new LevelManager();
    const scoreCalculator = new ScoreCalculator();

    // --- Instantiate Audio Modules ---
    const audioCtxManager = new AudioContextManager();
    const tonePlayer = new TonePlayer(audioCtxManager);
    const sequencePlayer = new SequencePlayer(audioCtxManager);

    // --- Instantiate UI Modules ---
    const uiFacade = new UIManagerFacade(morseDecoder);
    const settingsModalUI = new SettingsModal(); // UI elements *inside* modal
    let settingsModalManager = null; // Handles modal container visibility/drag

    // --- Declare helper functions BEFORE they are needed by callbacks ---
    let gameTimerIntervalId = null;
    let lastUpdateTime = 0;

    /** Starts the UI timer interval to update stats display. */
    function startGameUpdateTimer() {
        if (gameTimerIntervalId) return; // Already running
        const gameScreen = uiFacade.getGameScreen();
        if (!gameScreen) return;
        // console.log("Starting UI Update Timer..."); // Debug
        lastUpdateTime = performance.now();
        gameTimerIntervalId = setInterval(() => {
            const now = performance.now();
            // Update timer based on gameState's tracking
            gameScreen.updateTimer(gameState.getCurrentElapsedTime());
            // Note: WPM/Accuracy calculation for live update is complex.
            // For now, we only update the timer display.
            // Actual WPM/Acc are calculated at the end.
            lastUpdateTime = now;
        }, 100); // Update UI ~10 times/sec
    }

    /** Stops the UI timer interval. */
    function stopGameUpdateTimer() {
        if (gameTimerIntervalId) {
            // console.log("Stopping UI Update Timer..."); // Debug
            clearInterval(gameTimerIntervalId);
            gameTimerIntervalId = null;
        }
    }

    /** Navigates to the level selection screen. */
    function navigateToLevelSelect() {
        console.log("Main: Navigating to Level Select.");
        const levels = levelManager.getAllLevelsWithStatus();
        uiFacade.showLevelSelectScreen(levels);
        gameState.currentMode = AppMode.GAME; // Assume starting game unless sandbox chosen
        gameState.status = GameStatus.LEVEL_SELECT;
    }

    /** Handles Dit/Dah input on the results screen. */
    function handleResultsInput(type) { // type is 'dit' or 'dah'
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        if (type === 'dit') { // Retry
            console.log("Main: Results Retry selected.");
            gameController.retryCurrent();
        } else if (type === 'dah') { // Next
            // Check if 'Next' is actually enabled (handled by GameController)
            console.log("Main: Results Next selected.");
            gameController.proceedToNext();
        }
    }

    /** Plays the Morse sequence for the text in the playback input field. */
    function playSentenceFromInput() {
        const sentence = uiFacade.getPlaybackScreen()?.getSentence();
        const playbackScreen = uiFacade.getPlaybackScreen();
        if (!playbackScreen || !sentence) {
             if(playbackScreen) playbackScreen.updateMorseDisplay("Please enter text.");
             return;
        }
        if (sequencePlayer.isCurrentlyPlayingBack) {
             sequencePlayer.stopPlayback();
             if(playbackScreen) playbackScreen.setPlayButtonState(true, 'Play Morse');
        } else {
             const morseSequence = morseDecoder.encodeSentence(sentence);
             if(playbackScreen) playbackScreen.updateMorseDisplay(morseSequence || '(No valid Morse)');
             if (morseSequence) {
                 settingsManager.applySettings(); // Ensure WPM/freq are current
                 audioCtxManager.initializeContext(); // Ensure context is active
                 if(playbackScreen) playbackScreen.setPlayButtonState(false, 'Playing...');
                 sequencePlayer.playMorseSequence(morseSequence, () => {
                     // Completion callback
                     if(playbackScreen) playbackScreen.setPlayButtonState(true, 'Play Morse');
                     gameState.status = GameStatus.PLAYBACK_INPUT; // Ready for new input
                 });
                 gameState.status = GameStatus.PLAYING_BACK;
             }
        }
    }

    /** Updates the Morse preview in the sandbox screen based on input. */
    function updateSandboxPreview() {
        const sandboxScreen = uiFacade.getSandboxScreen();
        if (sandboxScreen) {
            const sentence = sandboxScreen.getSentence();
            const morsePreview = morseDecoder.encodeSentence(sentence);
            sandboxScreen.updateMorsePreview(morsePreview || '\u00A0'); // Show nbsp if empty
        }
    }

    /** Resets saved progress (high scores, unlocked levels). */
    function resetProgress() {
         if (confirm("Are you sure you want to reset all your progress? This cannot be undone.")) {
             levelManager.resetProgress();
             // No need to close modal here, but might want to update level select if it's open
             console.log("Progress reset.");
             // Optional: Update settings modal display if defaults changed keys/wpm
             settingsModalUI.updateDisplayValues(settingsManager.getSettings());
         }
    }

    /** Called when the settings modal is opened. */
    function handleShowSettings() {
        console.log("Settings modal opened.");
        // Optional: Pause game if running? Depends on desired behaviour.
        // settingsModalUI.updateDisplayValues(settingsManager.getSettings()); // Ensure UI matches state
    }

    /** Called when the settings modal is closed. */
    function handleHideSettings() {
        console.log("Settings modal closed.");
        // Optional: Resume game if paused.
    }

    /** Shows the main menu screen and resets relevant state. */
    function showMainMenuScreen() {
        stopGameUpdateTimer();
        sequencePlayer.stopPlayback(); // Stop any playback
        tonePlayer.stopInputTone(); // Stop any lingering input tone
        tonePlayer.stopFeedbackSounds(); // Stop feedback sounds
        // Reset game state only if not coming directly from results/level select
        if (gameState.status !== GameStatus.SHOWING_RESULTS && gameState.status !== GameStatus.LEVEL_SELECT) {
            gameState.reset(); // Full reset
        }
        gameState.currentMode = AppMode.MENU;
        gameState.status = GameStatus.MENU;
        uiFacade.showMainMenu();
    }


    // --- Instantiate Game Controller ---
    // Now that helper functions are defined, we can pass them directly
    const gameController = new GameController(
        gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade,
         { // Callbacks for GameController
             onGameEndShowMainMenu: showMainMenuScreen,
             onGameEndShowLevelSelect: navigateToLevelSelect,
             onUpdateUIStatsTimer: (start) => { if (start) startGameUpdateTimer(); else stopGameUpdateTimer(); },
             getCurrentKeyMappings: () => settingsManager ? settingsManager.getKeyMappings() : KEYBINDING_DEFAULTS // Needs settingsManager instance
         }
    );

    // --- Load Initial Settings (BEFORE input handler needs them) ---
    const initialSettings = {
         ditKey: localStorage.getItem(STORAGE_KEYS.SETTINGS_DIT_KEY) || KEYBINDING_DEFAULTS.dit,
         dahKey: localStorage.getItem(STORAGE_KEYS.SETTINGS_DAH_KEY) || KEYBINDING_DEFAULTS.dah,
         wpm: parseInt(localStorage.getItem(STORAGE_KEYS.SETTINGS_WPM), 10) || DEFAULT_WPM
     };
     // Basic validation for keys loaded directly
     if(initialSettings.ditKey === initialSettings.dahKey) {
        console.warn("Loaded identical keys for Dit and Dah. Resetting Dah to default.");
        initialSettings.dahKey = KEYBINDING_DEFAULTS.dah;
        // Edge case: If default Dah is ALSO the same as Dit, reset Dit too
        if(initialSettings.ditKey === initialSettings.dahKey) initialSettings.ditKey = KEYBINDING_DEFAULTS.dit;
     }
     if (isNaN(initialSettings.wpm) || initialSettings.wpm <= 0) {
        initialSettings.wpm = DEFAULT_WPM;
     }

    // --- Instantiate Input Modules ---
     const keyingLogicCallbacks = {
         onInputStart: startGameUpdateTimer, // Use actual function
         onCharacterDecode: () => gameController.handleCharacterDecode(), // Call game controller method
         onUpdateUserPattern: (sequence) => uiFacade.getGameScreen()?.updateUserPatternDisplay(sequence),
         onResultsInput: handleResultsInput // Use actual function
     };

    const keyingLogic = new KeyingLogic(gameState, morseDecoder, tonePlayer, keyingLogicCallbacks);
    keyingLogic.updateWpm(initialSettings.wpm); // Set initial WPM

     const inputHandler = new InputHandler(
        { // InputHandler Callbacks -> KeyingLogic
            onDitPress: (method) => keyingLogic.handlePress('dit', method),
            onDahPress: (method) => keyingLogic.handlePress('dah', method),
            onDitRelease: (method) => keyingLogic.handleRelease('dit', method),
            onDahRelease: (method) => keyingLogic.handleRelease('dah', method)
        },
        { dit: initialSettings.ditKey, dah: initialSettings.dahKey } // Provide initial keys
    );


    // --- Instantiate Settings Manager (NOW we have all dependencies) ---
    const settingsManager = new SettingsManager({
        morseDecoder,
        tonePlayer,
        sequencePlayer,
        inputHandler, // Pass the created instance
        uiManagerFacade: uiFacade,
        gameScreen: uiFacade.getGameScreen(), // Pass gameScreen instance
        audioCtxManager,
        settingsModalUI
    });
    // SettingsManager constructor loads from localStorage and applies settings.
    // Now that settingsManager exists, update gameController's callback reference
    gameController.callbacks.getCurrentKeyMappings = () => settingsManager.getKeyMappings();


    // --- Initialize Settings Modal Manager ---
    // Ensure main menu UI elements are accessible before getting button ID
    const settingsModalTriggerButton = uiFacade.mainMenu?.showSettingsButton;
    if (settingsModalTriggerButton) {
         settingsModalManager = new Modal( // Use correct class name 'Modal'
             'settings-modal',
             settingsModalTriggerButton.id,
             'settings-close-button',
             'settings-modal-header',
             handleShowSettings, // Use defined helper
             handleHideSettings  // Use defined helper
         );
         // Also ensure settingsModalUI is initialized if manager is created
         settingsModalUI.updateDisplayValues(settingsManager.getSettings());
    } else {
         console.error("Could not initialize Settings Modal Manager: Trigger button or ID not found.");
    }


    // --- Setup Callbacks Object for UI Facade ---
     const uiCallbacks = {
        onShowMainMenu: showMainMenuScreen,
        onShowLevelSelect: navigateToLevelSelect,
        onShowSandbox: () => {
             stopGameUpdateTimer();
             sequencePlayer.stopPlayback();
             gameState.reset(); // Reset state for sandbox
             gameState.currentMode = AppMode.SANDBOX;
             gameState.status = GameStatus.SANDBOX_INPUT;
             uiFacade.showSandboxScreen();
         },
         onShowPlayback: () => {
             stopGameUpdateTimer();
             sequencePlayer.stopPlayback();
             gameState.reset(); // Reset state for playback
             gameState.currentMode = AppMode.PLAYBACK;
             gameState.status = GameStatus.PLAYBACK_INPUT;
             uiFacade.showPlaybackScreen();
         },
         onLevelSelect: (levelId) => {
             console.log(`Main: Level ${levelId} selected.`);
             settingsManager.applySettings(); // Ensure settings are current
             audioCtxManager.initializeContext(); // Ensure audio ready
             gameController.startGameLevel(levelId, 0); // Start first sentence
         },
         onStartSandbox: () => {
             const sentence = uiFacade.getSandboxScreen()?.getSentence();
             if (sentence) {
                  settingsManager.applySettings();
                  audioCtxManager.initializeContext();
                  gameController.startSandboxPractice(sentence);
             } else {
                 alert("Please enter a sentence to practice.");
             }
         },
         onPlaySentence: playSentenceFromInput,
         onVolumeChange: (vol) => settingsManager.setVolume(vol), // Volume handled directly by SettingsManager
         onHintToggle: (visible) => settingsManager.setHintVisible(visible), // Hint handled by SettingsManager
         onSandboxInputChange: updateSandboxPreview,
         // Settings-related callbacks are handled by settingsModalUI listeners below
    };

    // --- Wire Up Event Listeners ---
    uiFacade.addEventListeners(uiCallbacks);
    settingsModalUI.addEventListeners({
         // Pass callbacks directly to the SettingsManager methods
         onWpmChange: (wpm) => settingsManager.setWpm(wpm),
         onFrequencyChange: (freq) => settingsManager.setFrequency(freq),
         onSoundToggle: (enabled) => settingsManager.setSoundEnabled(enabled),
         onDarkModeToggle: (enabled) => settingsManager.setDarkModeEnabled(enabled),
         onKeyMappingChange: (mappings) => settingsManager.setKeyMappings(mappings),
         onResetProgress: resetProgress, // Use defined helper
     });

    // --- Initial Application State ---
    showMainMenuScreen(); // Show the main menu first
    console.log("Dit-Dah-Dash Refactored Initialized.");

}); // End DOMContentLoaded