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

    // --- History Tracking ---
    // Simple stack to manage back navigation via ESC key
    let navigationHistory = ['menu']; // Start at main menu

    // --- Global State for Hint Peek ---
    let hintStateBeforeCtrl = null; // Tracks original hint state before Ctrl press

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

    /** Pushes a new state onto the navigation history if it's different from the last. */
    function pushHistory(state) {
        if (navigationHistory.at(-1) !== state) {
            navigationHistory.push(state);
            // console.log("History Push:", navigationHistory); // Debug
        }
    }

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
        pushHistory('levelSelect'); // Update history
    }

    /** Navigates to the Sandbox setup screen. */
    function navigateToSandboxSetup() {
        stopGameUpdateTimer();
        sequencePlayer.stopPlayback();
        gameState.reset(); // Reset state for sandbox
        gameState.currentMode = AppMode.SANDBOX;
        gameState.status = GameStatus.SANDBOX_INPUT;
        uiFacade.showSandboxScreen();
        pushHistory('sandbox'); // Update history
    }

     /** Navigates to the Playback setup screen. */
    function navigateToPlaybackSetup() {
        stopGameUpdateTimer();
        sequencePlayer.stopPlayback();
        gameState.reset(); // Reset state for playback
        gameState.currentMode = AppMode.PLAYBACK;
        gameState.status = GameStatus.PLAYBACK_INPUT;
        uiFacade.showPlaybackScreen();
        pushHistory('playback'); // Update history
    }

     /** Navigates to the Game/Sandbox screen (called after level/sentence is chosen). */
     function navigateToGameScreen() {
         // Called by gameController.startGameLevel or gameController.startSandboxPractice
         uiFacade.showGameScreen();
         // History is pushed based on whether we came from level select ('game') or sandbox setup ('sandboxPractice')
         if (gameState.currentMode === AppMode.GAME) {
             pushHistory('game');
         } else if (gameState.currentMode === AppMode.SANDBOX) {
             pushHistory('sandboxPractice');
         }
     }

     /** Shows the main menu screen and resets relevant state/history. */
     function showMainMenuScreen() {
         stopGameUpdateTimer();
         sequencePlayer.stopPlayback(); // Stop any playback
         tonePlayer.stopInputTone(); // Stop any lingering input tone
         tonePlayer.stopFeedbackSounds(); // Stop feedback sounds
         gameState.reset(); // Full reset for main menu
         gameState.currentMode = AppMode.MENU;
         gameState.status = GameStatus.MENU;
         uiFacade.showMainMenu();
         // Reset history to only contain 'menu'
         navigationHistory = ['menu'];
         // console.log("History Reset:", navigationHistory); // Debug
     }

    /** Handles Dit/Dah input on the results screen. */
    function handleResultsInput(type) { // type is 'dit' or 'dah'
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        if (type === 'dit') { // Retry
            console.log("Main: Results Retry selected.");
            gameController.retryCurrent(); // This will call navigateToGameScreen internally
        } else if (type === 'dah') { // Next
            // Check if 'Next' is actually enabled (handled by GameController)
            console.log("Main: Results Next selected.");
            gameController.proceedToNext(); // This might call navigateToLevelSelect or navigateToGameScreen
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
        gameState.status = GameStatus.SETTINGS; // Update status
        // Optional: Pause game if running? Depends on desired behaviour.
        settingsModalUI.updateDisplayValues(settingsManager.getSettings()); // Ensure UI matches state
    }

    /** Called when the settings modal is closed. */
    function handleHideSettings() {
        console.log("Settings modal closed.");
        // Revert status based on what was open before settings
        const previousState = navigationHistory.at(-1); // Check last screen in history
        switch(previousState) {
            case 'game':
            case 'sandboxPractice':
                 // If game was paused, resume it here. For now, just set status back.
                 // We need to know the exact status *before* settings opened.
                 // This simple history doesn't store that fine-grained state.
                 // A simple approach: If game was active, revert to LISTENING.
                 if (gameState.isPlaying() || gameState.status === GameStatus.READY) {
                      gameState.status = GameStatus.LISTENING;
                 } else if (gameState.status === GameStatus.FINISHED || gameState.status === GameStatus.SHOWING_RESULTS) {
                     // Keep results status if settings opened from results
                     gameState.status = GameStatus.SHOWING_RESULTS;
                 } else {
                      // Fallback if unsure
                       gameState.status = GameStatus.LISTENING;
                 }
                 break;
            case 'levelSelect': gameState.status = GameStatus.LEVEL_SELECT; break;
            case 'sandbox': gameState.status = GameStatus.SANDBOX_INPUT; break;
            case 'playback': gameState.status = GameStatus.PLAYBACK_INPUT; break;
            case 'menu':
            default: gameState.status = GameStatus.MENU; break;
        }
    }

     /** Handles Control key press/release for hint peeking/hiding. */
     function handleCtrlToggle(isPressed) {
        console.log(`[main.handleCtrlToggle] Called with isPressed = ${isPressed}`); // DEBUG
        // Only handle if game is active
        if (!gameState.isPlaying()) {
            console.log("[main.handleCtrlToggle] Skipping: gameState not playing."); // DEBUG
            return;
        }

        if (isPressed) {
            // Store current state and show hint if it was hidden
            hintStateBeforeCtrl = settingsManager.getSettings().hintVisible;
            console.log(`[main.handleCtrlToggle] Current hint state: ${hintStateBeforeCtrl}`); // DEBUG
            if (!hintStateBeforeCtrl) {
                console.log("[main.handleCtrlToggle] Hint was hidden, calling setHintVisible(true)..."); // DEBUG
                settingsManager.setHintVisible(true);
            } else {
                 console.log("[main.handleCtrlToggle] Hint already visible, doing nothing on press."); // DEBUG
            }
        } else {
            // On release, always hide the hint (peek or shortcut hide)
            console.log("[main.handleCtrlToggle] Control released, calling setHintVisible(false)..."); // DEBUG
            settingsManager.setHintVisible(false);
            hintStateBeforeCtrl = null; // Reset stored state
        }
    }

    /** Navigates back one step in the application based on history. */
    function navigateBack() {
        console.log("Navigate Back triggered."); // Debug

        // 1. Close settings modal if open
        if (settingsModalManager && settingsModalManager.isOpen()) {
            settingsModalManager.close();
            return;
        }

        // 2. Check history stack
        if (navigationHistory.length <= 1) {
            console.log("Navigate Back: Already at main menu.");
            return; // Can't go back further than menu
        }

        // 3. Pop current state and get previous state
        navigationHistory.pop();
        const previousState = navigationHistory.at(-1);
        // console.log("Navigate Back: Target State =", previousState, "History:", navigationHistory); // Debug

        // 4. Navigate to the previous state
        switch (previousState) {
            case 'levelSelect':
                navigateToLevelSelect(); // This function handles its own history push, but it won't push if already last item
                break;
            case 'sandbox':
                navigateToSandboxSetup();
                break;
            case 'playback':
                navigateToPlaybackSetup();
                break;
            case 'menu':
            default:
                showMainMenuScreen(); // This resets history to ['menu']
                break;
            // Note: 'game' or 'sandboxPractice' are not typically navigated *back* to via ESC,
            // usually you go back *from* them to levelSelect/sandbox/menu.
            // If settings were open during game, handleHideSettings manages status recovery.
        }
    }


    // --- Instantiate Game Controller ---
    const gameController = new GameController(
        gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade,
         { // Callbacks for GameController
             onGameEndShowMainMenu: showMainMenuScreen,
             onGameEndShowLevelSelect: navigateToLevelSelect, // Use updated nav function
             onUpdateUIStatsTimer: (start) => { if (start) startGameUpdateTimer(); else stopGameUpdateTimer(); },
             getCurrentKeyMappings: () => settingsManager ? settingsManager.getKeyMappings() : KEYBINDING_DEFAULTS
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
        if(initialSettings.ditKey === initialSettings.dahKey) initialSettings.ditKey = KEYBINDING_DEFAULTS.dit;
     }
     if (isNaN(initialSettings.wpm) || initialSettings.wpm <= 0) {
        initialSettings.wpm = DEFAULT_WPM;
     }

    // --- Instantiate Input Modules ---
     const keyingLogicCallbacks = {
         onInputStart: startGameUpdateTimer,
         onCharacterDecode: () => gameController.handleCharacterDecode(),
         onUpdateUserPattern: (sequence) => uiFacade.getGameScreen()?.updateUserPatternDisplay(sequence),
         onResultsInput: handleResultsInput
     };

    const keyingLogic = new KeyingLogic(gameState, morseDecoder, tonePlayer, keyingLogicCallbacks);
    keyingLogic.updateWpm(initialSettings.wpm); // Set initial WPM

     const inputHandler = new InputHandler(
        { // InputHandler Callbacks -> KeyingLogic + Ctrl Toggle
            onDitPress: (method) => keyingLogic.handlePress('dit', method),
            onDahPress: (method) => keyingLogic.handlePress('dah', method),
            onDitRelease: (method) => keyingLogic.handleRelease('dit', method),
            onDahRelease: (method) => keyingLogic.handleRelease('dah', method),
            onCtrlToggle: handleCtrlToggle // Pass the new handler
        },
        { dit: initialSettings.ditKey, dah: initialSettings.dahKey } // Provide initial keys
    );


    // --- Instantiate Settings Manager ---
    const settingsManager = new SettingsManager({
        morseDecoder,
        tonePlayer,
        sequencePlayer,
        inputHandler,
        uiManagerFacade: uiFacade,
        gameScreen: uiFacade.getGameScreen(),
        audioCtxManager,
        settingsModalUI
    });
    gameController.callbacks.getCurrentKeyMappings = () => settingsManager.getKeyMappings();


    // --- Initialize Settings Modal Manager ---
    const settingsModalTriggerButton = uiFacade.mainMenu?.showSettingsButton;
    if (settingsModalTriggerButton) {
         settingsModalManager = new Modal( // Use correct class name 'Modal'
             'settings-modal',
             settingsModalTriggerButton.id,
             'settings-close-button',
             'settings-modal-header',
             handleShowSettings,
             handleHideSettings
         );
         settingsModalUI.updateDisplayValues(settingsManager.getSettings());
    } else {
         console.error("Could not initialize Settings Modal Manager: Trigger button or ID not found.");
    }


    // --- Setup Callbacks Object for UI Facade ---
     const uiCallbacks = {
        onShowMainMenu: showMainMenuScreen,
        onShowLevelSelect: navigateToLevelSelect,
        onShowSandbox: navigateToSandboxSetup, // Use updated nav function
        onShowPlayback: navigateToPlaybackSetup, // Use updated nav function
        onLevelSelect: (levelId) => {
             console.log(`Main: Level ${levelId} selected.`);
             settingsManager.applySettings();
             audioCtxManager.initializeContext();
             gameController.startGameLevel(levelId, 0); // This internally calls navigateToGameScreen
         },
         onStartSandbox: () => {
             const sentence = uiFacade.getSandboxScreen()?.getSentence();
             if (sentence && sentence.trim()) {
                  settingsManager.applySettings();
                  audioCtxManager.initializeContext();
                  gameController.startSandboxPractice(sentence); // This internally calls navigateToGameScreen
             } else {
                 alert("Please enter a sentence to practice.");
             }
         },
         onPlaySentence: playSentenceFromInput,
         onVolumeChange: (vol) => settingsManager.setVolume(vol),
         onHintToggle: (visible) => settingsManager.setHintVisible(visible),
         onSandboxInputChange: updateSandboxPreview,
    };

    // --- Wire Up Event Listeners ---
    uiFacade.addEventListeners(uiCallbacks);
    settingsModalUI.addEventListeners({
         onWpmChange: (wpm) => settingsManager.setWpm(wpm),
         onFrequencyChange: (freq) => settingsManager.setFrequency(freq),
         onSoundToggle: (enabled) => settingsManager.setSoundEnabled(enabled),
         onDarkModeToggle: (enabled) => settingsManager.setDarkModeEnabled(enabled),
         onKeyMappingChange: (mappings) => settingsManager.setKeyMappings(mappings),
         onResetProgress: resetProgress,
         onResetProgress: resetProgress,
         onResetSettings: handleResetSettings
     });

    // Add global ESC key listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            navigateBack();
        }
    });

    // --- Initial Application State ---
    showMainMenuScreen(); // Show the main menu first
    console.log("Dit-Dah-Dash Refactored Initialized.");
    
    /** Resets configurable settings to defaults. */
    function handleResetSettings() {
        if (confirm("Reset all appearance and input settings (WPM, keys, volume, theme, paddle textures, etc.) to their defaults? Game progress will not be affected.")) {
            console.log("Resetting settings to defaults...");
            settingsManager.resetToDefaults(); // Resets core settings & applies them
            uiFacade.getPaddleControls()?.resetPaddleTextures(); // Reset paddle textures

            // Crucially, update the modal UI itself to show the new defaults
            settingsModalUI.updateDisplayValues(settingsManager.getSettings());
            console.log("Settings reset complete.");
        }
    }
}); // End DOMContentLoaded