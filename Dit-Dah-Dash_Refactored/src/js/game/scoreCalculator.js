// Dit-Dah-Dash_Refactored/src/js/game/scoreCalculator.js

import { GameStatus } from '../core/appStatus.js';
import { PARIS_STANDARD_WORD_LENGTH, INCORRECT_ATTEMPT_PENALTY } from '../core/configConstants.js';

/**
 * js/game/scoreCalculator.js
 * ---------------------
 * Calculates scoring metrics like WPM and Accuracy based on game state data.
 * Imports configuration constants and game status definitions.
 */

export class ScoreCalculator {
    constructor() {
        // Constants are now imported
        this.parisWordLength = PARIS_STANDARD_WORD_LENGTH;
        this.penalty = INCORRECT_ATTEMPT_PENALTY;
    }

    /**
     * Calculates all relevant scores based on the finished game state.
     * @param {GameState} gameState - The completed game state object (instance of GameState class).
     * @returns {object} An object containing calculated scores:
     * { netWpm, grossWpm, accuracy, elapsedTimeSeconds, totalChars, incorrectAttempts }
     */
    calculateScores(gameState) {
        if (gameState.status !== GameStatus.FINISHED) {
            console.warn("Attempted to calculate scores before game finished.");
            return { netWpm: 0, grossWpm: 0, accuracy: 0, elapsedTimeSeconds: 0, totalChars: 0, incorrectAttempts: 0 };
        }

        const elapsedTimeSeconds = gameState.elapsedTime / 1000;
        // Use the pre-calculated count of non-space characters from gameState
        const totalNonSpaceChars = gameState.totalCharsInSentence;

        if (elapsedTimeSeconds <= 0 || totalNonSpaceChars === 0) {
            return { netWpm: 0, grossWpm: 0, accuracy: 100, elapsedTimeSeconds: 0, totalChars: totalNonSpaceChars, incorrectAttempts: gameState.incorrectAttempts };
        }

        // --- Gross WPM ---
        // (Number of characters / Standard word length) / (Time in minutes)
        const grossWpm = (totalNonSpaceChars / this.parisWordLength) / (elapsedTimeSeconds / 60);

        // --- Accuracy ---
        // (Correct Characters / (Correct Characters + Incorrect Attempts * Penalty)) * 100
        // Correct Characters is assumed to be totalNonSpaceChars if the sentence was finished.
        // A higher penalty makes each error count more towards reducing accuracy.
        const effectiveAttempts = totalNonSpaceChars + (gameState.incorrectAttempts * this.penalty);
        let accuracy = 100; // Default to 100 if no incorrect attempts

        // Avoid division by zero and handle cases where penalty might make denominator zero or negative
        if (effectiveAttempts > 0 && totalNonSpaceChars > 0) {
             // Calculate accuracy, ensuring it stays within 0-100 range
             accuracy = Math.max(0, Math.min(100, (totalNonSpaceChars / effectiveAttempts) * 100));
        } else if (totalNonSpaceChars === 0 && gameState.incorrectAttempts > 0) {
            accuracy = 0; // If no characters were correct but there were errors, accuracy is 0
        }
        // If effectiveAttempts is 0 (no chars, no incorrect attempts), accuracy remains 100.


        // --- Net WPM ---
        // Gross WPM adjusted by accuracy
        const netWpm = grossWpm * (accuracy / 100);

        // console.log(`Score Calculation: Time=${elapsedTimeSeconds.toFixed(2)}s, Chars=${totalNonSpaceChars}, Incorrect=${gameState.incorrectAttempts}`);
        // console.log(`Scores: Gross WPM=${grossWpm.toFixed(1)}, Accuracy=${accuracy.toFixed(1)}%, Net WPM=${netWpm.toFixed(1)}`);

        return {
            netWpm: Math.max(0, parseFloat(netWpm.toFixed(1))), // Ensure non-negative and format
            grossWpm: Math.max(0, parseFloat(grossWpm.toFixed(1))),
            accuracy: parseFloat(accuracy.toFixed(1)),
            elapsedTimeSeconds: parseFloat(elapsedTimeSeconds.toFixed(1)),
            totalChars: totalNonSpaceChars,
            incorrectAttempts: gameState.incorrectAttempts
        };
    }
}

// Example Usage (in another module):
// import { ScoreCalculator } from './scoreCalculator.js';
// const calculator = new ScoreCalculator();
// const scores = calculator.calculateScores(myGameStateInstance);