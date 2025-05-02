// Dit-Dah-Dash_Refactored/src/js/core/gameState.js

import { GameStatus, AppMode } from './appStatus.js';

/**
 * js/core/gameState.js
 * ---------------
 * Manages the state of the application, including game progress, playback state,
 * timing, current input, and mode (Game, Sandbox, Playback, Menu, Settings, LoremIpsum).
 * Imports status and mode enums from appStatus.js.
 */

export class GameState {
    /**
     * Initializes the GameState object.
     */
    constructor() {
        this.reset(); // Initial state setup
        console.log('[DEBUG gameState constructor] Initial reset complete.'); // Added log
    }

    /**
     * Resets the application state, typically called on startup or returning to menu.
     */
     reset() {
        console.log('[DEBUG gameState reset] Called. Resetting state...'); // Added log
        this.status = GameStatus.IDLE; // Start as idle, main.js will set to MENU
        this.currentMode = AppMode.MENU; // Track the mode

        // --- Game/Sandbox/LoremIpsum-specific state ---
        this.currentLevelId = null;     // null in sandbox/loremipsum mode
        this.currentSentenceIndex = 0;  // 0 in sandbox/loremipsum mode
        this.currentSentence = "";      // The text being typed (can be appended to in LoremIpsum)
        this.totalCharsInSentence = 0;  // Total non-space characters (updated dynamically in LoremIpsum)
        this.currentCharIndex = 0;
        this.startTime = 0; // <<< Reset timer variables
        this.endTime = 0;   // <<< Reset timer variables
        this.elapsedTime = 0; // <<< Reset timer variables
        this.correctChars = 0;          // Correct non-space chars in the current session
        this.incorrectAttempts = 0;
        this.totalInputs = 0;           // All dit/dah inputs in the current session

        // --- Input tracking state ---
        this.currentInputSequence = ""; // Morse sequence during gameplay (.,-)
        this.inputTimestamps = [];
        this.lastInputTime = 0;
        this.characterTimeoutId = null; // For game decoding timer
        this.isIambicHandling = false;
        this.iambicState = null; // 'dit' or 'dah'

        // --- LoremIpsum Mode State ---
        this.wordsCompletedCount = 0;    // Total words completed in LoremIpsum mode
        this.currentWordChunk = [];      // Array of words currently being typed in LoremIpsum
        this.wordsCompletedInChunk = 0;  // Words completed since last word generation

        console.log('[DEBUG gameState reset] State after reset:', JSON.parse(JSON.stringify(this))); // Added log
        console.log("Application state reset."); // Original log
    }


    /**
     * Sets up the game state for a specific level and sentence (GAME context).
     * Assumes reset() or similar cleanup was called before this.
     * @param {number} levelId - The ID of the level being started.
     * @param {number} sentenceIndex - The index of the sentence within the level.
     * @param {string} sentenceText - The text of the sentence.
     */
    startLevelSentence(levelId, sentenceIndex, sentenceText) {
        console.log(`[DEBUG gameState startLevelSentence] Called. Level: ${levelId}, SentenceIndex: ${sentenceIndex}, Text: "${sentenceText}"`); // Added log
        // Reset only game-specific counters/tracking
        this.currentMode = AppMode.GAME;
        this.currentLevelId = levelId;
        this.currentSentenceIndex = sentenceIndex;
        this.currentSentence = sentenceText;
        this.totalCharsInSentence = sentenceText.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0; // <<< Ensure reset here too
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;
        this.wordsCompletedCount = 0; this.currentWordChunk = []; this.wordsCompletedInChunk = 0; // Reset loremipsum state

        this._skipLeadingSpaces();
        console.log('[DEBUG gameState startLevelSentence] State BEFORE setting READY:', JSON.parse(JSON.stringify(this))); // Added log
        this.status = GameStatus.READY; // Set state after setup
        console.log(`Starting Level ${levelId}, Sentence ${sentenceIndex + 1}. Mode: ${this.currentMode}, Status: ${this.status}`); // Original log
    }

    /**
     * Sets up the game state for a custom sentence (SANDBOX context).
     * @param {string} sentenceText - The custom sentence text.
     */
    startSandboxSentence(sentenceText) {
        console.log(`[DEBUG gameState startSandboxSentence] Called. Text: "${sentenceText}"`); // Added log
        // Reset only game-specific counters/tracking
        this.currentMode = AppMode.SANDBOX;
        this.currentLevelId = null; // No level ID in sandbox
        this.currentSentenceIndex = 0; // Only one sentence
        this.currentSentence = sentenceText;
        this.totalCharsInSentence = sentenceText.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0; // <<< Ensure reset here too
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;
        this.wordsCompletedCount = 0; this.currentWordChunk = []; this.wordsCompletedInChunk = 0; // Reset loremipsum state

        this._skipLeadingSpaces();
        console.log('[DEBUG gameState startSandboxSentence] State BEFORE setting READY:', JSON.parse(JSON.stringify(this))); // Added log
        this.status = GameStatus.READY; // Set state after setup
        console.log(`Starting Sandbox. Mode: ${this.currentMode}, Status: ${this.status}`); // Original log
    }

    /**
     * Sets up the game state for LOREM_IPSUM mode.
     * @param {Array<string>} initialWords - The first batch of words.
     */
    startLoremIpsumMode(initialWords) {
        console.log(`[DEBUG gameState startLoremIpsumMode] Called. Initial words count: ${initialWords.length}`); // Added log
        this.currentMode = AppMode.LOREM_IPSUM;
        this.currentLevelId = null;
        this.currentSentenceIndex = 0;
        this.currentSentence = initialWords.join(' '); // Start with initial words
        this.totalCharsInSentence = this.currentSentence.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0; // <<< Ensure reset here too
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;

        // LoremIpsum specific state
        this.wordsCompletedCount = 0;
        this.currentWordChunk = [...initialWords]; // Store the current words
        this.wordsCompletedInChunk = 0;

        this._skipLeadingSpaces();
        console.log('[DEBUG gameState startLoremIpsumMode] State BEFORE setting READY:', JSON.parse(JSON.stringify(this))); // Added log
        this.status = GameStatus.READY;
        console.log(`Starting LoremIpsum Mode. Mode: ${this.currentMode}, Status: ${this.status}`); // Original log
    }

    /** Skips leading spaces in the current sentence. */
    _skipLeadingSpaces() {
        while (this.currentCharIndex < this.currentSentence.length && this.currentSentence[this.currentCharIndex] === ' ') {
            this.currentCharIndex++;
        }
    }

     /** Starts the game/sandbox/loremipsum timer if status is READY or LISTENING and timer hasn't started. */
     startTimer() {
        console.log(`[DEBUG gameState startTimer] Called. Current status: ${this.status}`); // Added log
        // --- *** FIX START *** ---
        // Allow starting if READY or LISTENING, but only if timer hasn't actually started (startTime is 0)
        if ((this.status === GameStatus.READY || this.status === GameStatus.LISTENING) && this.startTime === 0) {
        // --- *** FIX END *** ---
            this.startTime = performance.now();
            console.log(`[DEBUG gameState startTimer] Timer started. startTime: ${this.startTime}, New status: ${GameStatus.LISTENING}`); // Log remains the same, status always becomes LISTENING
            this.status = GameStatus.LISTENING; // Always transition to LISTENING once timer starts
            this.lastInputTime = this.startTime;
            // console.log("Timer started."); // Original log removed by debug instructions
            return true;
        }
        console.warn(`[DEBUG gameState startTimer] Timer start skipped. Status: ${this.status}, StartTime: ${this.startTime}`); // Modified log
        return false;
     }

    /** Stops the game/sandbox/loremipsum timer and sets status to FINISHED. */
    stopTimer() {
        console.log(`[DEBUG gameState stopTimer] Called. Current status: ${this.status}, Mode: ${this.currentMode}`); // Added log
        // In LoremIpsum mode, the timer doesn't stop normally, only on exit.
        if (this.currentMode === AppMode.LOREM_IPSUM) {
            console.log("[DEBUG gameState stopTimer] Timer stop requested in LoremIpsum Mode - typically only happens on exit."); // Modified log
            this.status = GameStatus.FINISHED; // Or maybe MENU if exiting?
            this.endTime = performance.now();
            this.elapsedTime = this.endTime - this.startTime;
            console.log(`[DEBUG gameState stopTimer] Timer stopped (LoremIpsum Exit). endTime: ${this.endTime}, Calculated elapsedTime: ${this.elapsedTime}, New status: ${this.status}`); // Added log
            return true;
        }

        if (this.startTime > 0 && this.status !== GameStatus.FINISHED && this.status !== GameStatus.SHOWING_RESULTS) {
            this.endTime = performance.now();
            this.elapsedTime = this.endTime - this.startTime;
            this.status = GameStatus.FINISHED;
            console.log(`[DEBUG gameState stopTimer] Timer stopped. endTime: ${this.endTime}, Calculated elapsedTime: ${this.elapsedTime}, New status: ${GameStatus.FINISHED}`); // Added log
            return true;
        }
         // Prevent stopping multiple times or if never started
         if (this.status === GameStatus.FINISHED || this.status === GameStatus.SHOWING_RESULTS) {
              console.warn("[DEBUG gameState stopTimer] Timer stop skipped, already finished/showing results."); // Added log
              return false;
         }
         if (this.startTime === 0) {
             console.warn("[DEBUG gameState stopTimer] Timer stop skipped, startTime was 0. Marking FINISHED."); // Added log
             this.status = GameStatus.FINISHED; // Mark finished if stop requested without start
             this.elapsedTime = 0; // Ensure elapsed time is 0 if timer never started
             return false;
        }
        console.warn("[DEBUG gameState stopTimer] Timer stop skipped, default case."); // Added log
        return false;
    }

    /** Updates the game/sandbox/loremipsum input sequence. */
    addInput(input) {
        const now = performance.now();
        console.log(`[DEBUG gameState addInput] Input: '${input}', Current sequence: '${this.currentInputSequence}', Status: ${this.status}`); // Added log
        // Only count inputs if actually in a playing state
        if (this.isPlaying() || this.status === GameStatus.READY) { // Adjusted check for READY
            this.totalInputs++; // Track game/sandbox/loremipsum inputs
        }
        this.inputTimestamps.push({ input, time: now });
        this.lastInputTime = now;

        if (this.status === GameStatus.READY) {
            // this.startTimer(); // startTimer is now called by KeyingLogic _processInputStateChange
            this.status = GameStatus.TYPING; // Immediately switch to TYPING on first input
            this.currentInputSequence += input;
            this.clearCharacterTimeout(); // Clear any nascent timeout
            console.log(`[DEBUG gameState addInput] Status set to TYPING.`); // Log
        } else if (this.status === GameStatus.LISTENING || this.status === GameStatus.TYPING || this.status === GameStatus.DECODING) {
            if (this.status === GameStatus.LISTENING || this.status === GameStatus.DECODING) {
                this.status = GameStatus.TYPING; // Ensure TYPING state
                console.log(`[DEBUG gameState addInput] Status changed to TYPING.`); // Log
            }
            this.currentInputSequence += input;
            this.clearCharacterTimeout(); // Reset timeout on each input while typing
            // console.log(`GameState: Added input '${input}'. Sequence: '${this.currentInputSequence}'. Status: ${this.status}`); // Original log (less detailed)
        }
        // Note: Logic for results screen input removed as per refactor goals.
    }

    /** Clears the current game/sandbox/loremipsum input sequence. */
    clearCurrentInput() {
        console.log(`[DEBUG gameState clearCurrentInput] Clearing sequence: '${this.currentInputSequence}'. Current status: ${this.status}, isPlaying: ${this.isPlaying()}`); // Added log
        this.currentInputSequence = "";
        this.inputTimestamps = [];
        this.clearCharacterTimeout();

        // Reset to listening state only if actively playing
        if (this.isPlaying()) {
            // Avoid setting to LISTENING if finished or showing results
            if (this.status !== GameStatus.FINISHED && this.status !== GameStatus.SHOWING_RESULTS) {
                console.log(`[DEBUG gameState clearCurrentInput] Setting status to LISTENING.`); // Added log
                this.status = GameStatus.LISTENING;
            } else {
                 console.log(`[DEBUG gameState clearCurrentInput] Status is ${this.status}, not changing to LISTENING.`); // Added log
            }
        }
    }

    /** Stores the ID for the character decode timeout. */
    setCharacterTimeout(timeoutId) {
        this.clearCharacterTimeout();
        this.characterTimeoutId = timeoutId;
    }

    /** Clears the pending character decode timeout. */
    clearCharacterTimeout() {
        if (this.characterTimeoutId) {
            clearTimeout(this.characterTimeoutId);
            this.characterTimeoutId = null;
        }
    }

    /**
     * Advances to the next game/sandbox/loremipsum character.
     * Handles word completion checks for LoremIpsum mode.
     * Returns true if more chars exist, false if sentence complete (Game/Sandbox only).
     */
    moveToNextCharacter() {
        console.log(`[DEBUG gameState moveToNextCharacter] Called. Current index: ${this.currentCharIndex}, Current sentence length: ${this.currentSentence.length}`); // Added log
        const previousCharIndex = this.currentCharIndex;
        const previousChar = this.currentSentence[previousCharIndex];

        this.correctChars++;
        this.currentCharIndex++;
        console.log(`[DEBUG gameState moveToNextCharacter] Incrementing correctChars. New index: ${this.currentCharIndex}. Previous char was: '${previousChar}'`); // Added log

        // --- Word Completion Check (LoremIpsum Mode) ---
        // Check if the completed character was a space
        if (this.currentMode === AppMode.LOREM_IPSUM && previousChar === ' ') {
            this.wordsCompletedInChunk++;
            this.wordsCompletedCount++;
            console.log(`[DEBUG gameState moveToNextCharacter] LoremIpsum: Word completed. Chunk: ${this.wordsCompletedInChunk}, Total: ${this.wordsCompletedCount}`); // Added log
            // Trigger word generation check (logic handled in GameController)
            // This function only tracks completion.
        }

        // Skip any subsequent spaces
        while (this.currentCharIndex < this.currentSentence.length && this.currentSentence[this.currentCharIndex] === ' ') {
            this.currentCharIndex++;
        }

        this.clearCurrentInput(); // Clears sequence, potentially sets state to LISTENING

        // Check if end of sentence reached
        if (this.currentCharIndex >= this.currentSentence.length) {
             console.log(`[DEBUG gameState moveToNextCharacter] End of sentence reached. Mode: ${this.currentMode}`); // Added log
            // In LoremIpsum mode, this means we need more words (handled by GameController)
            // In Game/Sandbox, this signals the end.
            if (this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) {
                this.stopTimer(); // Sets status to FINISHED
                console.log("Sentence finished!"); // Original log
                return false; // No more characters (for Game/Sandbox)
            } else {
                 // In LoremIpsum mode, reaching the end doesn't stop the timer or mark as finished.
                 // The GameController will handle adding more words.
                 // We still return true because the *mode* continues.
                 console.log("[DEBUG gameState moveToNextCharacter] LoremIpsum: Reached end of current sentence chunk. Returning true (expecting more words)."); // Added log
                 return true; // More characters expected (will be added)
            }
        } else {
            // More characters remain in the current sentence
            console.log(`[DEBUG gameState moveToNextCharacter] More characters remain. New index: ${this.currentCharIndex}`); // Added log
            return true; // More characters remain
        }
    }

    /** Appends new words to the sentence in LoremIpsum Mode. */
    appendLoremIpsumWords(newWords) {
        console.log(`[DEBUG gameState appendLoremIpsumWords] Called. Current sentence length: ${this.currentSentence.length}, New words count: ${newWords?.length}`); // Added log
        if (this.currentMode !== AppMode.LOREM_IPSUM || !newWords || newWords.length === 0) {
            return false;
        }
        const newSentencePart = " " + newWords.join(' '); // Add space separator
        this.currentSentence += newSentencePart;
        this.totalCharsInSentence += newSentencePart.split('').filter(char => char !== ' ').length; // Update total chars
        this.currentWordChunk.push(...newWords); // Add to the internal chunk list (optional)
        console.log(`[DEBUG gameState appendLoremIpsumWords] Sentence updated. New totalChars: ${this.totalCharsInSentence}`); // Added log
        console.log(`LoremIpsum: Appended ${newWords.length} words.`); // Original log
        return true;
    }


    /** Records an incorrect game/sandbox/loremipsum attempt. */
    registerIncorrectAttempt() {
        console.log(`[DEBUG gameState registerIncorrectAttempt] Incrementing incorrectAttempts. Before: ${this.incorrectAttempts}`); // Added log
        this.incorrectAttempts++;
        console.log(`[DEBUG gameState registerIncorrectAttempt] Incorrect attempt registered. Total now: ${this.incorrectAttempts}`); // Added log
    }

    /** Checks if the game is in an active playing state (input matters for game/sandbox/loremipsum). */
    isPlaying() {
        return (this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX || this.currentMode === AppMode.LOREM_IPSUM) &&
               (this.status === GameStatus.READY ||
                this.status === GameStatus.LISTENING ||
                this.status === GameStatus.TYPING ||
                this.status === GameStatus.DECODING);
    }

     /** Checks if audio playback is active. */
     isAudioPlayingBack() {
         return this.currentMode === AppMode.PLAYBACK && this.status === GameStatus.PLAYING_BACK;
     }

    /** Gets the target game/sandbox/loremipsum character (uppercase or space). */
    getTargetCharacter() {
        if (this.isPlaying() && this.currentCharIndex < this.currentSentence.length) {
             const char = this.currentSentence[this.currentCharIndex];
             return char === ' ' ? ' ' : char.toUpperCase();
        }
        return null;
    }

     /** Gets the target game/sandbox/loremipsum character (raw case). */
     getTargetCharacterRaw() {
          if (this.isPlaying() && this.currentCharIndex < this.currentSentence.length) {
             return this.currentSentence[this.currentCharIndex];
         }
         return null;
     }

    /** Gets the current calculated elapsed game/sandbox/loremipsum time. */
    getCurrentElapsedTime() {
        console.log(`[DEBUG gameState getCurrentElapsedTime] Called. startTime: ${this.startTime}, endTime: ${this.endTime}, Status: ${this.status}, Mode: ${this.currentMode}`); // Added log

        if (this.startTime === 0) {
             console.log(`[DEBUG gameState getCurrentElapsedTime] Returning: 0 (startTime is 0)`); // Added log
             return 0;
        }
        // In LoremIpsum mode, only stopTimer called on exit, so always calculate current time
        if (this.currentMode === AppMode.LOREM_IPSUM) {
            const calculatedTime = performance.now() - this.startTime;
            console.log(`[DEBUG gameState getCurrentElapsedTime] Returning: ${calculatedTime} (LoremIpsum mode - current time)`); // Added log
             return calculatedTime;
        }
        // Handle Game/Sandbox finish states
        if (this.status === GameStatus.FINISHED || this.status === GameStatus.SHOWING_RESULTS) {
            if (this.endTime === 0 && this.status === GameStatus.FINISHED) {
                 this.endTime = performance.now();
                 this.elapsedTime = this.endTime - this.startTime;
                 console.log(`[DEBUG gameState getCurrentElapsedTime] Calculated final elapsedTime: ${this.elapsedTime}`); // Added log
            }
            console.log(`[DEBUG gameState getCurrentElapsedTime] Returning: ${this.elapsedTime} (Finished/Showing Results)`); // Added log
            return this.elapsedTime;
        }
        // Calculate current time if playing
        if (this.isPlaying()) {
            const calculatedTime = this.startTime > 0 ? (performance.now() - this.startTime) : 0;
             console.log(`[DEBUG gameState getCurrentElapsedTime] Returning: ${calculatedTime} (isPlaying - current time)`); // Added log
            return calculatedTime;
        }

        console.log(`[DEBUG gameState getCurrentElapsedTime] Returning: 0 (default case - not actively timing)`); // Added log
        return 0; // Return 0 if not actively timing
    }
}