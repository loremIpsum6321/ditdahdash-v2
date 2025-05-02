// Dit-Dah-Dash_Refactored/src/js/game/gameController.js

import { GameStatus, AppMode } from '../core/appStatus.js';
import { WordGenerator } from './wordGenerator.js'; // Import WordGenerator

/**
 * js/game/gameController.js
 * -------------------------
 * Controls the core game flow logic for Game, Sandbox, and Endless modes.
 * Manages starting levels/sentences/modes, processing decoded input,
 * handling correct/incorrect attempts, finishing sentences, dynamically adding words,
 * and results navigation.
 */

export class GameController {
    /**
     * @param {GameState} gameState
     * @param {LevelManager} levelManager
     * @param {ScoreCalculator} scoreCalculator
     * @param {MorseDecoder} morseDecoder
     * @param {TonePlayer} tonePlayer - Needed for feedback sounds.
     * @param {UIManagerFacade} uiFacade - For updating the UI.
     * @param {WordGenerator} wordGenerator - For Endless mode.
     * @param {object} callbacks - Callbacks for high-level actions.
     * @param {function} callbacks.onGameEndShowMainMenu - Callback to navigate to main menu.
     * @param {function} callbacks.onGameEndShowLevelSelect - Callback to navigate to level select.
     * @param {function} callbacks.onUpdateUIStatsTimer - Callback to start/stop the UI timer.
     * @param {function} callbacks.getCurrentKeyMappings - Callback to get current key mappings for results hints.
     */
    constructor(gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, wordGenerator, callbacks) {
        // Verify dependencies
        if (!gameState || !levelManager || !scoreCalculator || !morseDecoder || !tonePlayer || !uiFacade || !wordGenerator || !callbacks ||
            typeof callbacks.onGameEndShowMainMenu !== 'function' ||
            typeof callbacks.onGameEndShowLevelSelect !== 'function' ||
            typeof callbacks.onUpdateUIStatsTimer !== 'function' ||
            typeof callbacks.getCurrentKeyMappings !== 'function') {
            throw new Error("GameController requires instances of gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, wordGenerator, and specific callbacks.");
        }

        this.gameState = gameState;
        this.levelManager = levelManager;
        this.scoreCalculator = scoreCalculator;
        this.morseDecoder = morseDecoder;
        this.tonePlayer = tonePlayer;
        this.uiFacade = uiFacade;
        this.wordGenerator = wordGenerator; // Store word generator instance
        this.callbacks = callbacks;

        // Endless mode config
        this.endlessInitialWordCount = 20;
        this.endlessWordsPerChunk = 20;
        this.endlessChunkTriggerCount = 10; // Add new chunk after completing this many words

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
        this._commonStartGameUI(sentenceText); // Use common UI setup
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
        this._commonStartGameUI(sentenceText); // Use common UI setup
    }

    /** Starts the Endless mode. */
    startEndlessMode() {
        console.log(`GameController: Attempting to start Endless Mode`);
        const initialWords = this.wordGenerator.generateWords(this.endlessInitialWordCount);
        if (!initialWords || initialWords.length === 0) {
            console.error("GameController: Failed to generate initial words for Endless Mode.");
            alert("Error starting Endless Mode. Could not generate words.");
            this.callbacks.onGameEndShowMainMenu();
            return;
        }

        // Prepare game state
        this.gameState.startEndlessMode(initialWords);
        this._commonStartGameUI(this.gameState.currentSentence); // Use common UI setup with initial sentence
    }

    /**
     * Common UI setup logic used by startGameLevel, startSandboxPractice, and startEndlessMode.
     * @param {string} sentenceText - The text to display initially.
     * @private
     */
    _commonStartGameUI(sentenceText) {
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
                console.warn("GameController: Starting level/mode with empty or whitespace-only sentence.");
                // Immediately finish if sentence is effectively empty (for Game/Sandbox)
                if (this.gameState.currentMode !== AppMode.ENDLESS) {
                    this.gameState.status = GameStatus.FINISHED; // Mark as finished without timer
                    this._handleSentenceFinished();
                    return;
                } else {
                    // Handle empty start in Endless? Should not happen with word generator.
                    console.error("Endless mode started with no initial words somehow.");
                    this.callbacks.onGameEndShowMainMenu();
                    return;
                }
            } else {
                 console.error("GameController: Could not get first character even though sentence is not empty.");
                 gameScreen.updateTargetPatternDisplay(""); // Clear target pattern
            }
        } else {
             console.error("GameController: Could not get GameScreen instance from UI Facade.");
        }

        this.callbacks.onUpdateUIStatsTimer(false); // Stop any previous timer
        console.log(`GameController: ${this.gameState.currentMode} ready.`);
    }


     /**
     * Processes the completed Morse sequence entered by the user.
     * Called by KeyingLogic after decode timeout.
     */
     handleCharacterDecode() {
         // Ensure we are in a state where decoding makes sense
         if (this.gameState.status !== GameStatus.DECODING || !(this.gameState.isPlaying())) { // isPlaying covers GAME/SANDBOX/ENDLESS
            console.warn("GameController: handleCharacterDecode called in unexpected state/mode:", this.gameState.status, this.gameState.currentMode);
            if (this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
            return;
         }

         const sequence = this.gameState.currentInputSequence;
         const targetChar = this.gameState.getTargetCharacter(); // Uppercase target

         // Clear the input sequence in game state (UI update handled separately)
         const currentIndex = this.gameState.currentCharIndex; // Store index before clearing input
         this.gameState.clearCurrentInput(); // This also sets state to LISTENING if playing
         const gameScreen = this.uiFacade.getGameScreen();
         if(gameScreen) {
            gameScreen.updateUserPatternDisplay(""); // Clear UI pattern
         }

         // Handle empty input (timeout without typing anything)
         if (!sequence) {
             if (targetChar !== null && gameScreen) {
                 const targetMorse = this.morseDecoder.encodeCharacter(targetChar);
                 gameScreen.updateTargetPatternDisplay(targetMorse ?? ""); // Restore hint
             }
              if(gameScreen) gameScreen.setPatternDisplayState('default'); // Ensure no lingering feedback
             this.gameState.status = GameStatus.LISTENING; // Ensure listening state
             return;
         }

        // Decode the sequence
        const decodedChar = this.morseDecoder.decodeSequence(sequence);

        // --- Compare Decoded Character with Target ---
        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- CORRECT ---
            // console.log(`GameController: Correct! Decoded: ${decodedChar}, Target: ${targetChar}`); // Less verbose log
            if(gameScreen) {
                gameScreen.updateCharacterState(currentIndex, 'completed');
                gameScreen.setPatternDisplayState('correct'); // Green flash pattern
            }

            const moreChars = this.gameState.moveToNextCharacter(); // Advances index, sets state, checks word completion

            if (moreChars) {
                 // Check if we need more words in Endless mode
                 if (this.gameState.currentMode === AppMode.ENDLESS) {
                     this._checkAndAppendEndlessWords();
                 }

                // Highlight the new character (or first char of new words)
                 if(gameScreen) {
                     const nextCharIndex = this.gameState.currentCharIndex;
                     const nextCharRaw = this.gameState.getTargetCharacterRaw(); // Get raw char for hint encoding
                     if (nextCharRaw !== null) { // Ensure there is a next char before highlighting
                         gameScreen.highlightCharacter(nextCharIndex, nextCharRaw);
                     } else {
                         // This might happen temporarily in Endless if words run out before appending
                         console.warn("GameController: No next character raw found after moveToNextCharacter.");
                         // Game state should be LISTENING if we're waiting for words
                     }
                 }
            } else {
                // --- SENTENCE FINISHED (Game/Sandbox Only) ---
                if (this.gameState.currentMode !== AppMode.ENDLESS) {
                    this._handleSentenceFinished();
                }
                 // Note: moveToNextCharacter handles the end-of-sentence logic differently for endless mode
            }
        } else {
            // --- INCORRECT ---
            console.log(`GameController: Incorrect. Decoded: ${decodedChar ?? 'null'}, Target: ${targetChar}`);
            this.gameState.registerIncorrectAttempt();
            this.tonePlayer.playIncorrectSound(); // Play incorrect beep

            if(gameScreen) {
                gameScreen.updateCharacterState(currentIndex, 'incorrect'); // Red flash char
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

    /**
     * Checks if new words need to be generated and appended in Endless Mode.
     * @private
     */
    _checkAndAppendEndlessWords() {
        if (this.gameState.currentMode !== AppMode.ENDLESS) return;

        if (this.gameState.wordsCompletedInChunk >= this.endlessChunkTriggerCount) {
            console.log(`Endless: Completed ${this.gameState.wordsCompletedInChunk} words, generating ${this.endlessWordsPerChunk} more.`);
            const newWords = this.wordGenerator.generateWords(this.endlessWordsPerChunk);
            if (newWords && newWords.length > 0) {
                const success = this.gameState.appendEndlessWords(newWords);
                if (success) {
                    this.gameState.wordsCompletedInChunk = 0; // Reset chunk counter
                    // Update the UI to show the appended sentence
                    const gameScreen = this.uiFacade.getGameScreen();
                    if (gameScreen) {
                         // Rerender the full sentence (simplest approach)
                         // This might cause a flicker or reset scroll, could be optimized later
                         gameScreen.renderSentence(this.gameState.currentSentence);
                         // Re-highlight the current character after rerender
                         const currentCharIndex = this.gameState.currentCharIndex;
                         const currentCharRaw = this.gameState.getTargetCharacterRaw();
                         if (currentCharRaw !== null) {
                             gameScreen.highlightCharacter(currentCharIndex, currentCharRaw);
                         } else {
                             // If somehow index is out of bounds after append, log error
                             console.error("Endless: Current character index out of bounds after appending words.");
                         }
                    }
                } else {
                    console.error("Endless: Failed to append new words to game state.");
                }
            } else {
                console.error("Endless: Word generator failed to return new words.");
            }
        }
    }


    /** Handles logic when a sentence is successfully completed (Game/Sandbox Only). */
    _handleSentenceFinished() {
        // Only applicable for Game and Sandbox modes
        if (this.gameState.currentMode === AppMode.ENDLESS) {
            console.warn("_handleSentenceFinished called in Endless Mode. Ignoring.");
            return;
        }
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

    /** Restarts the current level or sandbox sentence. Endless mode does not retry. */
    retryCurrent() {
        if (this.gameState.currentMode === AppMode.ENDLESS) {
             console.log("GameController: Retry requested in Endless mode. Returning to menu.");
             this.callbacks.onGameEndShowMainMenu();
             return;
        }

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

    /** Proceeds to the next sentence or level (Game), or goes to menu (Sandbox/Endless). */
    proceedToNext() {
         // Handle proceeding from Sandbox or Endless mode -> Main Menu
         if (this.gameState.currentMode === AppMode.SANDBOX || this.gameState.currentMode === AppMode.ENDLESS) {
              console.log(`GameController: Proceeding from ${this.gameState.currentMode} to Main Menu.`);
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
//     gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, wordGenerator, // Added wordGenerator
//     {
//          onGameEndShowMainMenu: () => { /* show main menu */ },
//          onGameEndShowLevelSelect: () => { /* show level select */ },
//          onUpdateUIStatsTimer: (start) => { /* start/stop interval */ },
//          getCurrentKeyMappings: () => settingsManager.getKeyMappings() // Assuming settingsManager exists
//     }
// );
// // When level selected: gameController.startGameLevel(levelId, 0);
// // When Endless selected: gameController.startEndlessMode();
// // When decode ready: gameController.handleCharacterDecode();
// // When retry requested: gameController.retryCurrent();
// // When next requested: gameController.proceedToNext();