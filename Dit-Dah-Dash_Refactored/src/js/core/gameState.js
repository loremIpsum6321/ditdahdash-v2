// Dit-Dah-Dash_Refactored/src/js/core/gameState.js

import { GameStatus, AppMode } from './appStatus.js';

/**
 * js/core/gameState.js
 * ---------------
 * Manages the state of the application, including game progress, playback state,
 * timing, current input, and mode (Game, Sandbox, Playback, Menu, Settings).
 * Imports status and mode enums from appStatus.js.
 */

export class GameState {
    /**
     * Initializes the GameState object.
     */
    constructor() {
        this.reset(); // Initial state setup
    }

    /**
     * Resets the application state, typically called on startup or returning to menu.
     */
     reset() {
        this.status = GameStatus.IDLE; // Start as idle, main.js will set to MENU
        this.currentMode = AppMode.MENU; // Track the mode
        // Game/Sandbox-specific state
        this.currentLevelId = null;     // null in sandbox mode
        this.currentSentenceIndex = 0;  // 0 in sandbox mode
        this.currentSentence = "";
        this.totalCharsInSentence = 0; // Total non-space characters
        this.currentCharIndex = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.elapsedTime = 0;
        this.correctChars = 0;
        this.incorrectAttempts = 0;
        this.totalInputs = 0; // Game/Sandbox inputs

        // Input tracking state
        this.currentInputSequence = ""; // Morse sequence during gameplay (.,-)
        this.inputTimestamps = [];
        this.lastInputTime = 0;
        this.characterTimeoutId = null; // For game decoding timer
        this.isIambicHandling = false;
        this.iambicState = null; // 'dit' or 'dah'

        console.log("Application state reset.");
    }


    /**
     * Sets up the game state for a specific level and sentence (GAME context).
     * Assumes reset() or similar cleanup was called before this.
     * @param {number} levelId - The ID of the level being started.
     * @param {number} sentenceIndex - The index of the sentence within the level.
     * @param {string} sentenceText - The text of the sentence.
     */
    startLevelSentence(levelId, sentenceIndex, sentenceText) {
        // Reset only game-specific counters/tracking
        this.currentMode = AppMode.GAME;
        this.currentLevelId = levelId;
        this.currentSentenceIndex = sentenceIndex;
        this.currentSentence = sentenceText;
        this.totalCharsInSentence = sentenceText.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0;
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;

        this._skipLeadingSpaces();
        this.status = GameStatus.READY; // Set state after setup
        console.log(`Starting Level ${levelId}, Sentence ${sentenceIndex + 1}. Mode: ${this.currentMode}, Status: ${this.status}`);
    }

    /**
     * Sets up the game state for a custom sentence (SANDBOX context).
     * @param {string} sentenceText - The custom sentence text.
     */
    startSandboxSentence(sentenceText) {
        // Reset only game-specific counters/tracking
        this.currentMode = AppMode.SANDBOX;
        this.currentLevelId = null; // No level ID in sandbox
        this.currentSentenceIndex = 0; // Only one sentence
        this.currentSentence = sentenceText;
        this.totalCharsInSentence = sentenceText.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0;
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;

        this._skipLeadingSpaces();
        this.status = GameStatus.READY; // Set state after setup
        console.log(`Starting Sandbox. Mode: ${this.currentMode}, Status: ${this.status}`);
    }

    /** Skips leading spaces in the current sentence. */
    _skipLeadingSpaces() {
        while (this.currentCharIndex < this.currentSentence.length && this.currentSentence[this.currentCharIndex] === ' ') {
            this.currentCharIndex++;
        }
    }

     /** Starts the game/sandbox timer if status is READY. */
     startTimer() {
        if (this.status === GameStatus.READY) {
            this.startTime = performance.now();
            this.status = GameStatus.LISTENING;
            this.lastInputTime = this.startTime;
            console.log("Timer started.");
            return true;
        }
        return false;
     }

    /** Stops the game/sandbox timer and sets status to FINISHED. */
    stopTimer() {
        if (this.startTime > 0 && this.status !== GameStatus.FINISHED && this.status !== GameStatus.SHOWING_RESULTS) {
            this.endTime = performance.now();
            this.elapsedTime = this.endTime - this.startTime;
            this.status = GameStatus.FINISHED;
            console.log(`Timer stopped. Elapsed: ${this.elapsedTime.toFixed(0)}ms`);
            return true;
        }
         // Prevent stopping multiple times or if never started
         if (this.status === GameStatus.FINISHED || this.status === GameStatus.SHOWING_RESULTS) return false;
         if (this.startTime === 0) { this.status = GameStatus.FINISHED; return false; } // Mark finished if stop requested without start
        return false;
    }

    /** Updates the game/sandbox input sequence. */
    addInput(input) {
        const now = performance.now();
        // Only count inputs if actually in a playing state
        if (this.isPlaying() || this.status === GameStatus.READY) { // Adjusted check for READY
            this.totalInputs++; // Track game/sandbox inputs
        }
        this.inputTimestamps.push({ input, time: now });
        this.lastInputTime = now;

        if (this.status === GameStatus.READY) {
            this.startTimer(); // Starts timer and sets status to LISTENING
            this.status = GameStatus.TYPING; // Immediately switch to TYPING on first input
            this.currentInputSequence += input;
            this.clearCharacterTimeout(); // Clear any nascent timeout
            console.log(`GameState: Added input '${input}'. Sequence: '${this.currentInputSequence}'. Status: ${this.status}`); // Log
        } else if (this.status === GameStatus.LISTENING || this.status === GameStatus.TYPING || this.status === GameStatus.DECODING) {
            if (this.status === GameStatus.LISTENING || this.status === GameStatus.DECODING) this.status = GameStatus.TYPING; // Ensure TYPING state
            this.currentInputSequence += input;
            this.clearCharacterTimeout(); // Reset timeout on each input while typing
            console.log(`GameState: Added input '${input}'. Sequence: '${this.currentInputSequence}'. Status: ${this.status}`); // Log
        }
        // Note: Logic for results screen input removed as per refactor goals.
    }

    /** Clears the current game/sandbox input sequence. */
    clearCurrentInput() {
        // console.log(`Clearing input sequence. Was: '${this.currentInputSequence}'`); // Debug
        this.currentInputSequence = "";
        this.inputTimestamps = [];
        this.clearCharacterTimeout();

        // UI update is responsibility of UI modules calling this, not gameState itself
        // e.g., window.morseUIManager.updateUserPatternDisplay("");
        // e.g., window.morseUIManager.setPatternDisplayState('default');

        // Reset to listening state only if actively playing game/sandbox characters
        if (this.isPlaying()) {
            // console.log("Setting status to LISTENING after clearing input."); // Debug
            this.status = GameStatus.LISTENING;
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

    /** Advances to the next game/sandbox character. Returns true if more chars exist, false if sentence complete. */
    moveToNextCharacter() {
        this.correctChars++;
        this.currentCharIndex++;
        while (this.currentCharIndex < this.currentSentence.length && this.currentSentence[this.currentCharIndex] === ' ') {
            this.currentCharIndex++;
        }
        this.clearCurrentInput(); // Clears sequence, potentially sets state to LISTENING

        if (this.currentCharIndex >= this.currentSentence.length) {
            this.stopTimer(); // Sets status to FINISHED
            console.log("Sentence finished!");
            return false; // No more characters
        } else {
            // console.log(`Moved to character index: ${this.currentCharIndex} ('${this.getTargetCharacter()}')`); // Debug
            // clearCurrentInput should have set state to LISTENING if appropriate
            return true; // More characters remain
        }
    }


    /** Records an incorrect game/sandbox attempt. */
    registerIncorrectAttempt() {
        this.incorrectAttempts++;
        console.log("Incorrect attempt registered. Total:", this.incorrectAttempts);
    }

    /** Checks if the game is in an active playing state (input matters for game/sandbox). */
    isPlaying() {
        // *** MODIFIED: Added GameStatus.READY to the check ***
        return (this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) &&
               (this.status === GameStatus.READY || // Allow interaction when level is ready
                this.status === GameStatus.LISTENING ||
                this.status === GameStatus.TYPING ||
                this.status === GameStatus.DECODING);
    }

     /** Checks if audio playback is active. */
     isAudioPlayingBack() {
         return this.currentMode === AppMode.PLAYBACK && this.status === GameStatus.PLAYING_BACK;
     }

    /** Gets the target game/sandbox character (uppercase or space). */
    getTargetCharacter() {
        const targetStates = [GameStatus.READY, GameStatus.LISTENING, GameStatus.TYPING, GameStatus.DECODING];
        if ((this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) &&
            targetStates.includes(this.status) && this.currentCharIndex < this.currentSentence.length) {
             const char = this.currentSentence[this.currentCharIndex];
             return char === ' ' ? ' ' : char.toUpperCase();
        } return null;
    }

     /** Gets the target game/sandbox character (raw case). */
     getTargetCharacterRaw() {
         const targetStates = [GameStatus.READY, GameStatus.LISTENING, GameStatus.TYPING, GameStatus.DECODING];
          if ((this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) &&
              targetStates.includes(this.status) && this.currentCharIndex < this.currentSentence.length) {
             return this.currentSentence[this.currentCharIndex];
         } return null;
     }

    /** Gets the current calculated elapsed game/sandbox time. */
    getCurrentElapsedTime() {
        if (this.startTime === 0) return 0;
        if (this.status === GameStatus.FINISHED || this.status === GameStatus.SHOWING_RESULTS) {
            // Ensure endTime is set if finished
             if (this.endTime === 0 && this.status === GameStatus.FINISHED) {
                  this.endTime = performance.now();
                  this.elapsedTime = this.endTime - this.startTime;
             }
            return this.elapsedTime;
        }
        // Also include READY state for time calculation if needed, although timer starts on first input
        if (this.isPlaying()) { // isPlaying now includes READY
            // If READY but timer not started, return 0. Otherwise, return time since start.
            return this.startTime > 0 ? (performance.now() - this.startTime) : 0;
        }

        return 0; // Return 0 if not actively timing
    }
}