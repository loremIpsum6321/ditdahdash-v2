// Dit-Dah-Dash_Refactored/src/js/game/gameController.js

import { GameStatus, AppMode } from '../core/appStatus.js';

/**
 * js/game/gameController.js
 * -------------------------
 * Controls the core game flow logic for Game and Sandbox modes.
 * Manages starting levels/sentences, processing decoded input,
 * handling correct/incorrect attempts, finishing sentences, and results navigation.
 */

export class GameController {
    /**
     * @param {GameState} gameState
     * @param {LevelManager} levelManager
     * @param {ScoreCalculator} scoreCalculator
     * @param {MorseDecoder} morseDecoder
     * @param {TonePlayer} tonePlayer - Needed for feedback sounds.
     * @param {UIManagerFacade} uiFacade - For updating the UI.
     * @param {object} callbacks - Callbacks for high-level actions.
     * @param {function} callbacks.onGameEndShowMainMenu - Callback to navigate to main menu.
     * @param {function} callbacks.onGameEndShowLevelSelect - Callback to navigate to level select.
     * @param {function} callbacks.onUpdateUIStatsTimer - Callback to start/stop the UI timer.
     * @param {function} callbacks.getCurrentKeyMappings - Callback to get current key mappings for results hints.
     */
    constructor(gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, callbacks) {
        // Verify dependencies
        if (!gameState || !levelManager || !scoreCalculator || !morseDecoder || !tonePlayer || !uiFacade || !callbacks ||
            typeof callbacks.onGameEndShowMainMenu !== 'function' ||
            typeof callbacks.onGameEndShowLevelSelect !== 'function' ||
            typeof callbacks.onUpdateUIStatsTimer !== 'function' ||
            typeof callbacks.getCurrentKeyMappings !== 'function') {
            throw new Error("GameController requires instances of gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, and specific callbacks.");
        }

        this.gameState = gameState;
        this.levelManager = levelManager;
        this.scoreCalculator = scoreCalculator;
        this.morseDecoder = morseDecoder;
        this.tonePlayer = tonePlayer;
        this.uiFacade = uiFacade;
        this.callbacks = callbacks;

        console.log("GameController Initialized.");
    }

    /** Starts a specific level and sentence index. */
    startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`GameController: Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        const sentenceText = this.levelManager.getSpecificSentence(levelId, sentenceIndex);

        if (sentenceText === null) {
            console.error(`GameController: Cannot start level - Invalid levelId ${levelId} or sentenceIndex ${sentenceIndex}.`);
            this.callbacks.onGameEndShowMainMenu(); // Navigate away safely
            return;
        }

        // Prepare game state
        this.gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);

        // Setup UI
        this.uiFacade.showGameScreen();
        const gameScreen = this.uiFacade.getGameScreen();
        if (gameScreen) {
            gameScreen.renderSentence(sentenceText);
            gameScreen.resetStatsAndPatterns(); // Reset timer display, patterns etc.

            const firstCharIndex = this.gameState.currentCharIndex;
            const firstChar = this.gameState.getTargetCharacterRaw();

            if (firstChar !== null) {
                 // Highlight first char, update target pattern, potentially start hint pulse
                 gameScreen.highlightCharacter(firstCharIndex, firstChar);
            } else if (sentenceText.trim().length === 0){
                console.warn("GameController: Starting level with empty or whitespace-only sentence.");
                // Immediately finish if sentence is effectively empty
                this.gameState.status = GameStatus.FINISHED; // Mark as finished without timer
                this._handleSentenceFinished();
                return;
            } else {
                 console.error("GameController: Could not get first character even though sentence is not empty.");
                 gameScreen.updateTargetPatternDisplay(""); // Clear target pattern
            }
        } else {
             console.error("GameController: Could not get GameScreen instance from UI Facade.");
        }

        this.callbacks.onUpdateUIStatsTimer(false); // Stop any previous timer
        console.log("GameController: Level ready.");
    }

    /** Starts the sandbox mode with a given sentence. */
    startSandboxPractice(sentenceText) {
        if (!sentenceText || !sentenceText.trim()) {
            alert("Please enter a sentence for Sandbox mode.");
            return; // Or navigate back?
        }
        console.log(`GameController: Attempting to start Sandbox with: "${sentenceText}"`);

        // Prepare game state
        this.gameState.startSandboxSentence(sentenceText);

        // Setup UI
        this.uiFacade.showGameScreen();
        const gameScreen = this.uiFacade.getGameScreen();
         if (gameScreen) {
            gameScreen.renderSentence(sentenceText);
            gameScreen.resetStatsAndPatterns();

            const firstCharIndex = this.gameState.currentCharIndex;
            const firstChar = this.gameState.getTargetCharacterRaw();

            if (firstChar !== null) {
                gameScreen.highlightCharacter(firstCharIndex, firstChar);
            } else {
                 // Should have been caught by trim() check above, but handle anyway
                 console.warn("GameController: Starting sandbox with whitespace-only sentence.");
                 this.gameState.status = GameStatus.FINISHED;
                 this._handleSentenceFinished();
                 return;
            }
        } else {
             console.error("GameController: Could not get GameScreen instance from UI Facade.");
        }
        this.callbacks.onUpdateUIStatsTimer(false); // Stop any previous timer
        console.log("GameController: Sandbox ready.");
    }

     /**
     * Processes the completed Morse sequence entered by the user.
     * Called by KeyingLogic after decode timeout.
     */
     handleCharacterDecode() {
        // Ensure we are in a state where decoding makes sense
         if (this.gameState.status !== GameStatus.DECODING || !(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) {
            console.warn("GameController: handleCharacterDecode called in unexpected state/mode:", this.gameState.status, this.gameState.currentMode);
            // Attempt recovery: If decoding, revert to listening, otherwise do nothing.
            if (this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
            return;
         }

         const sequence = this.gameState.currentInputSequence;
         const targetChar = this.gameState.getTargetCharacter(); // Uppercase target

         // Clear the input sequence in game state (UI update handled separately)
         this.gameState.clearCurrentInput(); // This also sets state to LISTENING if playing
         const gameScreen = this.uiFacade.getGameScreen();
         if(gameScreen) {
            gameScreen.updateUserPatternDisplay(""); // Clear UI pattern
         }

         // Handle empty input (timeout without typing anything)
         if (!sequence) {
             // State should already be LISTENING from clearCurrentInput
             if (targetChar !== null && gameScreen) {
                 const targetMorse = this.morseDecoder.encodeCharacter(targetChar);
                 gameScreen.updateTargetPatternDisplay(targetMorse ?? ""); // Restore hint
             }
              if(gameScreen) gameScreen.setPatternDisplayState('default'); // Ensure no lingering feedback
             return;
         }

        // Decode the sequence
        const decodedChar = this.morseDecoder.decodeSequence(sequence);

        // --- Compare Decoded Character with Target ---
        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- CORRECT ---
            console.log(`GameController: Correct! Decoded: ${decodedChar}, Target: ${targetChar}`);
            if(gameScreen) {
                gameScreen.updateCharacterState(this.gameState.currentCharIndex, 'completed');
                gameScreen.setPatternDisplayState('correct'); // Green flash pattern
            }

            const moreChars = this.gameState.moveToNextCharacter(); // Advances index, sets state

            if (moreChars) {
                // Highlight the new character
                 if(gameScreen) {
                     const nextCharIndex = this.gameState.currentCharIndex;
                     const nextCharRaw = this.gameState.getTargetCharacterRaw(); // Get raw char for hint encoding
                     gameScreen.highlightCharacter(nextCharIndex, nextCharRaw);
                 }
            } else {
                // --- SENTENCE FINISHED ---
                this._handleSentenceFinished();
            }
        } else {
            // --- INCORRECT ---
            console.log(`GameController: Incorrect. Decoded: ${decodedChar ?? 'null'}, Target: ${targetChar}`);
            this.gameState.registerIncorrectAttempt();
            this.tonePlayer.playIncorrectSound(); // Play incorrect beep

            if(gameScreen) {
                gameScreen.updateCharacterState(this.gameState.currentCharIndex, 'incorrect'); // Red flash char
                gameScreen.setPatternDisplayState('incorrect'); // Red flash pattern

                // Restore hint for the current character
                if (targetChar !== null) {
                    const targetMorse = this.morseDecoder.encodeCharacter(targetChar);
                    gameScreen.updateTargetPatternDisplay(targetMorse ?? "");
                } else {
                    gameScreen.updateTargetPatternDisplay(""); // Should not happen if targetChar exists
                }
            }
            // Game state should be LISTENING after incorrect attempt (set by clearCurrentInput)
            this.gameState.status = GameStatus.LISTENING;
        }
    }

    /** Handles logic when a sentence is successfully completed. */
    _handleSentenceFinished() {
        // Prevent multiple finishes
        if (this.gameState.status === GameStatus.SHOWING_RESULTS || this.gameState.status === GameStatus.MENU) return;

        console.log("GameController: Sentence finished.");
        this.callbacks.onUpdateUIStatsTimer(false); // Stop UI timer

        // Ensure timer is stopped and state is FINISHED before calculating scores
        if (this.gameState.status !== GameStatus.FINISHED) {
            this.gameState.stopTimer(); // Sets status to FINISHED if not already
        }

        // Calculate scores
        const scores = this.scoreCalculator.calculateScores(this.gameState);

        let unlockedNextLevelId = null;
        let hasNextLevelOption = false; // Renamed from hasNextLevel for clarity

        // Record score and check unlocks only in Game mode
        if (this.gameState.currentMode === AppMode.GAME && this.gameState.currentLevelId !== null) {
            const unlockResult = this.levelManager.recordScoreAndCheckUnlocks(this.gameState.currentLevelId, scores);
            unlockedNextLevelId = unlockResult.unlockedNextLevelId;

            // Check if there's a next sentence/level available AND unlocked
            const nextSentenceDetails = this.levelManager.getNextSentence(this.gameState);
            hasNextLevelOption = nextSentenceDetails !== null && this.levelManager.isLevelUnlocked(nextSentenceDetails.levelId);
        } else {
            // Sandbox mode has no next level option
            hasNextLevelOption = false;
        }

        // Get current key mappings for results screen hints
        const currentKeys = this.callbacks.getCurrentKeyMappings();

        // Show results screen via UI Facade
        this.uiFacade.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, this.gameState.currentMode, currentKeys);
        this.gameState.status = GameStatus.SHOWING_RESULTS; // Update state *after* showing screen
    }

    /** Restarts the current level or sandbox sentence. */
    retryCurrent() {
        if (this.gameState.currentMode === AppMode.GAME && this.gameState.currentLevelId !== null && this.gameState.currentSentenceIndex !== null) {
            console.log(`GameController: Retrying Level ${this.gameState.currentLevelId}, Sentence ${this.gameState.currentSentenceIndex + 1}`);
            // Restart the same sentence
            this.startGameLevel(this.gameState.currentLevelId, this.gameState.currentSentenceIndex);
        } else if (this.gameState.currentMode === AppMode.SANDBOX && this.gameState.currentSentence) {
            console.log("GameController: Retrying Sandbox sentence.");
            // Restart sandbox with the same sentence stored in gameState
            this.startSandboxPractice(this.gameState.currentSentence);
        } else {
            console.warn("GameController: Retry called in invalid state, returning to main menu.");
            this.callbacks.onGameEndShowMainMenu();
        }
    }

    /** Proceeds to the next sentence or level, or goes to level select if finished. */
    proceedToNext() {
         // Handle proceeding from Sandbox mode -> Main Menu
         if (this.gameState.currentMode === AppMode.SANDBOX) {
              console.log("GameController: Proceeding from Sandbox to Main Menu.");
              this.callbacks.onGameEndShowMainMenu();
              return;
         }

         // Handle proceeding from Game mode
         if (this.gameState.currentMode === AppMode.GAME && this.gameState.currentLevelId !== null) {
            const next = this.levelManager.getNextSentence(this.gameState);

            if (next && this.levelManager.isLevelUnlocked(next.levelId)) {
                console.log(`GameController: Moving to next: Level ${next.levelId}, Sentence ${next.sentenceIndex + 1}`);
                this.startGameLevel(next.levelId, next.sentenceIndex);
            } else {
                console.log("GameController: No next level/sentence available or unlocked, returning to level select.");
                this.callbacks.onGameEndShowLevelSelect();
            }
        } else {
            console.warn("GameController: ProceedToNext called in invalid state, returning to main menu.");
            this.callbacks.onGameEndShowMainMenu();
        }
    }

}

// Example Usage (in main.js):
// import { GameController } from './game/gameController.js';
// // Assuming gameState, levelManager, etc. instances exist
// const gameController = new GameController(
//     gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade,
//     {
//          onGameEndShowMainMenu: () => { /* show main menu */ },
//          onGameEndShowLevelSelect: () => { /* show level select */ },
//          onUpdateUIStatsTimer: (start) => { /* start/stop interval */ },
//          getCurrentKeyMappings: () => settingsManager.getKeyMappings() // Assuming settingsManager exists
//     }
// );
// // When level selected: gameController.startGameLevel(levelId, 0);
// // When decode ready: gameController.handleCharacterDecode();
// // When retry requested: gameController.retryCurrent();
// // When next requested: gameController.proceedToNext();