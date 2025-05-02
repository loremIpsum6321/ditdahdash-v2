// Dit-Dah-Dash_Refactored/src/js/game/gameController.js

import { GameStatus, AppMode } from '../core/appStatus.js';
import { LoremIpsumGenerator } from './loremIpsumGenerator.js'; // Import renamed generator

/**
 * js/game/gameController.js
 * -------------------------
 * Controls the core game flow logic for Game, Sandbox, and LoremIpsum modes.
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
     * @param {LoremIpsumGenerator} loremIpsumGenerator - For LoremIpsum mode. (Changed type)
     * @param {object} callbacks - Callbacks for high-level actions.
     * @param {function} callbacks.onGameEndShowMainMenu - Callback to navigate to main menu.
     * @param {function} callbacks.onGameEndShowLevelSelect - Callback to navigate to level select.
     * @param {function} callbacks.onUpdateUIStatsTimer - Callback to start/stop the UI timer.
     * @param {function} callbacks.getCurrentKeyMappings - Callback to get current key mappings for results hints.
     */
    constructor(gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, loremIpsumGenerator, callbacks) {
        // Verify dependencies
        if (!gameState || !levelManager || !scoreCalculator || !morseDecoder || !tonePlayer || !uiFacade || !loremIpsumGenerator || !callbacks || // Changed generator name
            typeof callbacks.onGameEndShowMainMenu !== 'function' ||
            typeof callbacks.onGameEndShowLevelSelect !== 'function' ||
            typeof callbacks.onUpdateUIStatsTimer !== 'function' ||
            typeof callbacks.getCurrentKeyMappings !== 'function') {
            throw new Error("GameController requires instances of gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, loremIpsumGenerator, and specific callbacks.");
        }

        this.gameState = gameState;
        this.levelManager = levelManager;
        this.scoreCalculator = scoreCalculator;
        this.morseDecoder = morseDecoder;
        this.tonePlayer = tonePlayer;
        this.uiFacade = uiFacade;
        this.loremIpsumGenerator = loremIpsumGenerator; // Store generator instance
        this.callbacks = callbacks;

        // LoremIpsum mode config
        this.loremIpsumInitialWordCount = 20;
        this.loremIpsumWordsPerChunk = 20;
        this.loremIpsumChunkTriggerCount = 10; // Add new chunk after completing this many words

        console.log("GameController Initialized.");
    }

    /** Starts a specific level and sentence index. */
    startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`[DEBUG GameController startGameLevel] Called. Level: ${levelId}, SentenceIndex: ${sentenceIndex + 1}`); // Added log
        const sentenceText = this.levelManager.getSpecificSentence(levelId, sentenceIndex);

        if (sentenceText === null) {
            console.error(`GameController: Cannot start level - Invalid levelId ${levelId} or sentenceIndex ${sentenceIndex}.`);
            this.callbacks.onGameEndShowMainMenu(); // Navigate away safely
            return;
        }

        // Prepare game state
        this.gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);
        console.log(`[DEBUG GameController startGameLevel] gameState after startLevelSentence:`, JSON.parse(JSON.stringify(this.gameState))); // Added log
        this._commonStartGameUI(sentenceText); // Use common UI setup
    }

    /** Starts the sandbox mode with a given sentence. */
    startSandboxPractice(sentenceText) {
        console.log(`[DEBUG GameController startSandboxPractice] Called. Text: "${sentenceText}"`); // Added log
        if (!sentenceText || !sentenceText.trim()) {
            alert("Please enter a sentence for Sandbox mode.");
            return; // Or navigate back?
        }

        // Prepare game state
        this.gameState.startSandboxSentence(sentenceText);
        console.log(`[DEBUG GameController startSandboxPractice] gameState after startSandboxSentence:`, JSON.parse(JSON.stringify(this.gameState))); // Added log
        this._commonStartGameUI(sentenceText); // Use common UI setup
    }

    /** Starts the LoremIpsum mode. (Renamed from startEndlessMode) */
    startLoremIpsumMode() {
        console.log(`[DEBUG GameController startLoremIpsumMode] Called.`); // Added log
        this.loremIpsumGenerator.reset(); // Ensure generator starts from beginning
        const initialWords = this.loremIpsumGenerator.generateWords(this.loremIpsumInitialWordCount);
        if (!initialWords || initialWords.length === 0) {
            console.error("GameController: Failed to generate initial words for LoremIpsum Mode.");
            alert("Error starting LoremIpsum Mode. Could not generate words.");
            this.callbacks.onGameEndShowMainMenu();
            return;
        }

        // Prepare game state
        this.gameState.startLoremIpsumMode(initialWords); // Renamed method in GameState
        console.log(`[DEBUG GameController startLoremIpsumMode] gameState after startLoremIpsumMode:`, JSON.parse(JSON.stringify(this.gameState))); // Added log
        this._commonStartGameUI(this.gameState.currentSentence); // Use common UI setup with initial sentence
    }

    /**
     * Common UI setup logic used by startGameLevel, startSandboxPractice, and startLoremIpsumMode.
     * @param {string} sentenceText - The text to display initially.
     * @private
     */
    _commonStartGameUI(sentenceText) {
        console.log(`[DEBUG GameController _commonStartGameUI] Called. Sentence: "${sentenceText}"`); // Added log
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
                if (this.gameState.currentMode !== AppMode.LOREM_IPSUM) {
                    this.gameState.status = GameStatus.FINISHED; // Mark as finished without timer
                    this._handleSentenceFinished();
                    return;
                } else {
                    // Handle empty start in LoremIpsum? Should not happen with generator.
                    console.error("LoremIpsum mode started with no initial words somehow.");
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

        console.log(`[DEBUG GameController _commonStartGameUI] Resetting stats/patterns and stopping UI timer.`); // Added log
        this.callbacks.onUpdateUIStatsTimer(false); // Stop any previous timer
        console.log(`GameController: ${this.gameState.currentMode} ready.`);
    }


     /**
     * Processes the completed Morse sequence entered by the user.
     * Called by KeyingLogic after decode timeout.
     */
     handleCharacterDecode() {
        const sequence = this.gameState.currentInputSequence; // Get sequence *before* clearing
        console.log(`[DEBUG GameController handleCharacterDecode] Called. Status: ${this.gameState.status}, Sequence: '${sequence}'`); // Added log

         // Ensure we are in a state where decoding makes sense
         if (this.gameState.status !== GameStatus.DECODING || !(this.gameState.isPlaying())) { // isPlaying covers GAME/SANDBOX/LOREM_IPSUM
            console.warn("GameController: handleCharacterDecode called in unexpected state/mode:", this.gameState.status, this.gameState.currentMode);
            if (this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
            return;
         }

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
            console.log(`[DEBUG GameController handleCharacterDecode] CORRECT. Decoded: ${decodedChar}, Target: ${targetChar}`); // Added log
            if(gameScreen) {
                gameScreen.updateCharacterState(currentIndex, 'completed');
                gameScreen.setPatternDisplayState('correct'); // Green flash pattern
            }

            const moreChars = this.gameState.moveToNextCharacter(); // Advances index, sets state, checks word completion

            if (moreChars) {
                 // Check if we need more words in LoremIpsum mode
                 if (this.gameState.currentMode === AppMode.LOREM_IPSUM) {
                     this._checkAndAppendLoremIpsumWords(); // Renamed check function
                 }

                // Highlight the new character (or first char of new words)
                 if(gameScreen) {
                     const nextCharIndex = this.gameState.currentCharIndex;
                     const nextCharRaw = this.gameState.getTargetCharacterRaw(); // Get raw char for hint encoding
                     if (nextCharRaw !== null) { // Ensure there is a next char before highlighting
                         gameScreen.highlightCharacter(nextCharIndex, nextCharRaw);
                     } else {
                         // This might happen temporarily in LoremIpsum if words run out before appending
                         console.warn("GameController: No next character raw found after moveToNextCharacter.");
                         // Game state should be LISTENING if we're waiting for words
                     }
                 }
            } else {
                // --- SENTENCE FINISHED (Game/Sandbox Only) ---
                if (this.gameState.currentMode !== AppMode.LOREM_IPSUM) {
                    this._handleSentenceFinished();
                }
                 // Note: moveToNextCharacter handles the end-of-sentence logic differently for loremipsum mode
            }
        } else {
            // --- INCORRECT ---
            console.log(`[DEBUG GameController handleCharacterDecode] INCORRECT. Decoded: ${decodedChar ?? 'null'}, Target: ${targetChar}`); // Added log
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
     * Checks if new words need to be generated and appended in LoremIpsum Mode.
     * @private
     */
    _checkAndAppendLoremIpsumWords() { // Renamed function
        console.log(`[DEBUG GameController _checkAndAppendLoremIpsumWords] Called. Mode: ${this.gameState.currentMode}, WordsCompletedInChunk: ${this.gameState.wordsCompletedInChunk}, TriggerCount: ${this.loremIpsumChunkTriggerCount}`); // Added log
        if (this.gameState.currentMode !== AppMode.LOREM_IPSUM) return;

        if (this.gameState.wordsCompletedInChunk >= this.loremIpsumChunkTriggerCount) {
            console.log(`[DEBUG GameController _checkAndAppendLoremIpsumWords] Trigger count met. Generating ${this.loremIpsumWordsPerChunk} new words.`); // Added log
            const newWords = this.loremIpsumGenerator.generateWords(this.loremIpsumWordsPerChunk);
            if (newWords && newWords.length > 0) {
                const success = this.gameState.appendLoremIpsumWords(newWords); // Renamed GameState method
                if (success) {
                    this.gameState.wordsCompletedInChunk = 0; // Reset chunk counter
                    console.log(`[DEBUG GameController _checkAndAppendLoremIpsumWords] Successfully appended words. Reset chunk count to 0.`); // Added log
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
                             console.error("LoremIpsum: Current character index out of bounds after appending words.");
                         }
                    }
                } else {
                    console.error("LoremIpsum: Failed to append new words to game state.");
                }
            } else {
                console.error("LoremIpsum: Generator failed to return new words.");
            }
        }
    }


    /** Handles logic when a sentence is successfully completed (Game/Sandbox Only). */
    _handleSentenceFinished() {
        console.log(`[DEBUG GameController _handleSentenceFinished] Called. Mode: ${this.gameState.currentMode}, Status: ${this.gameState.status}`); // Added log
        // Only applicable for Game and Sandbox modes
        if (this.gameState.currentMode === AppMode.LOREM_IPSUM) {
            console.warn("_handleSentenceFinished called in LoremIpsum Mode. Ignoring.");
            return;
        }
        // Prevent multiple finishes
        if (this.gameState.status === GameStatus.SHOWING_RESULTS || this.gameState.status === GameStatus.MENU) return;

        console.log("GameController: Sentence finished.");
        console.log(`[DEBUG GameController _handleSentenceFinished] Stopping UI timer.`); // Added log
        this.callbacks.onUpdateUIStatsTimer(false); // Stop UI timer

        // Ensure timer is stopped and state is FINISHED before calculating scores
        if (this.gameState.status !== GameStatus.FINISHED) {
            this.gameState.stopTimer(); // Sets status to FINISHED if not already
        }

        // Calculate scores
        console.log(`[DEBUG GameController _handleSentenceFinished] gameState BEFORE calculating scores:`, JSON.parse(JSON.stringify(this.gameState))); // Added log
        const scores = this.scoreCalculator.calculateScores(this.gameState);
        console.log(`[DEBUG GameController _handleSentenceFinished] Scores received from calculator:`, JSON.parse(JSON.stringify(scores))); // Added log

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
        // Pass AppMode.LOREM_IPSUM here, but facade should handle skipping results for it
        console.log(`[DEBUG GameController _handleSentenceFinished] Calling uiFacade.showResultsScreen with: scores, unlockedId=${unlockedNextLevelId}, hasNext=${hasNextLevelOption}, mode=${this.gameState.currentMode}, keys=${JSON.stringify(currentKeys)}`); // Added log
        this.uiFacade.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, this.gameState.currentMode, currentKeys);
        this.gameState.status = GameStatus.SHOWING_RESULTS; // Update state *after* showing screen
    }

    /** Restarts the current level or sandbox sentence. LoremIpsum mode does not retry. */
    retryCurrent() {
        console.log(`[DEBUG GameController retryCurrent] Called. Mode: ${this.gameState.currentMode}`); // Added log
        if (this.gameState.currentMode === AppMode.LOREM_IPSUM) {
             console.log("GameController: Retry requested in LoremIpsum mode. Returning to menu.");
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

    /** Proceeds to the next sentence or level (Game), or goes to menu (Sandbox/LoremIpsum). */
    proceedToNext() {
         console.log(`[DEBUG GameController proceedToNext] Called. Mode: ${this.gameState.currentMode}`); // Added log
         // Handle proceeding from Sandbox or LoremIpsum mode -> Main Menu
         if (this.gameState.currentMode === AppMode.SANDBOX || this.gameState.currentMode === AppMode.LOREM_IPSUM) {
              console.log(`GameController: Proceeding from ${this.gameState.currentMode} to Main Menu.`);
              this.callbacks.onGameEndShowMainMenu();
              return;
         }

         // Handle proceeding from Game mode
         if (this.gameState.currentMode === AppMode.GAME && this.gameState.currentLevelId !== null) {
            const next = this.levelManager.getNextSentence(this.gameState);

            if (next && this.levelManager.isLevelUnlocked(next.levelId)) {
                console.log(`[DEBUG GameController proceedToNext] Proceeding to Level: ${next.levelId}, Sentence: ${next.sentenceIndex + 1}`); // Added log
                this.startGameLevel(next.levelId, next.sentenceIndex);
            } else {
                console.log("[DEBUG GameController proceedToNext] No valid/unlocked next level found. Calling onGameEndShowLevelSelect."); // Added log
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
//     gameState, levelManager, scoreCalculator, morseDecoder, tonePlayer, uiFacade, loremIpsumGenerator, // Added loremIpsumGenerator
//     {
//          onGameEndShowMainMenu: () => { /* show main menu */ },
//          onGameEndShowLevelSelect: () => { /* show level select */ },
//          onUpdateUIStatsTimer: (start) => { /* start/stop interval */ },
//          getCurrentKeyMappings: () => settingsManager.getKeyMappings() // Assuming settingsManager exists
//     }
// );
// // When level selected: gameController.startGameLevel(levelId, 0);
// // When LoremIpsum selected: gameController.startLoremIpsumMode(); // Renamed call
// // When decode ready: gameController.handleCharacterDecode();
// // When retry requested: gameController.retryCurrent();
// // When next requested: gameController.proceedToNext();