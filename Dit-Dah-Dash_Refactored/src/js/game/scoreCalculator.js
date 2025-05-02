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
        console.log('[DEBUG ScoreCalculator calculateScores] Called. gameState status:', gameState.status); // Added log

        if (gameState.status !== GameStatus.FINISHED) {
            console.warn("Attempted to calculate scores before game finished.");
            console.warn('[DEBUG ScoreCalculator calculateScores] Attempted calculation when status is not FINISHED. Returning zeros.'); // Added log
            return { netWpm: 0, grossWpm: 0, accuracy: 0, elapsedTimeSeconds: 0, totalChars: 0, incorrectAttempts: 0 };
        }

        const elapsedTimeSeconds = gameState.elapsedTime / 1000;
        // Use the pre-calculated count of non-space characters from gameState
        const totalNonSpaceChars = gameState.totalCharsInSentence;

        console.log(`[DEBUG ScoreCalculator calculateScores] Inputs: elapsedTime=${gameState.elapsedTime}ms -> ${elapsedTimeSeconds.toFixed(3)}s, totalNonSpaceChars=${totalNonSpaceChars}, incorrectAttempts=${gameState.incorrectAttempts}`); // Added log

        if (elapsedTimeSeconds <= 0 || totalNonSpaceChars === 0) {
            console.warn('[DEBUG ScoreCalculator calculateScores] Zero time or zero characters. Returning default scores (100% accuracy).'); // Added log
            return { netWpm: 0, grossWpm: 0, accuracy: 100, elapsedTimeSeconds: 0, totalChars: totalNonSpaceChars, incorrectAttempts: gameState.incorrectAttempts };
        }

        // --- Gross WPM ---
        // (Number of characters / Standard word length) / (Time in minutes)
        const grossWpm = (totalNonSpaceChars / this.parisWordLength) / (elapsedTimeSeconds / 60);
        console.log(`[DEBUG ScoreCalculator calculateScores] Calculated grossWpm: ${grossWpm}`); // Added log

        // --- Accuracy ---
        // (Correct Characters / (Correct Characters + Incorrect Attempts * Penalty)) * 100
        // Correct Characters is assumed to be totalNonSpaceChars if the sentence was finished.
        // A higher penalty makes each error count more towards reducing accuracy.
        const effectiveAttempts = totalNonSpaceChars + (gameState.incorrectAttempts * this.penalty);
        console.log(`[DEBUG ScoreCalculator calculateScores] Calculated effectiveAttempts: ${effectiveAttempts}`); // Added log
        let accuracy = 100; // Default to 100 if no incorrect attempts

        // Avoid division by zero and handle cases where penalty might make denominator zero or negative
        if (effectiveAttempts > 0 && totalNonSpaceChars > 0) {
             // Calculate accuracy, ensuring it stays within 0-100 range
             accuracy = Math.max(0, Math.min(100, (totalNonSpaceChars / effectiveAttempts) * 100));
             console.log(`[DEBUG ScoreCalculator calculateScores] Calculated initial accuracy: ${accuracy}`); // Added log
        } else if (totalNonSpaceChars === 0 && gameState.incorrectAttempts > 0) {
            accuracy = 0; // If no characters were correct but there were errors, accuracy is 0
        }
        // If effectiveAttempts is 0 (no chars, no incorrect attempts), accuracy remains 100.


        // --- Net WPM ---
        // Gross WPM adjusted by accuracy
        const netWpm = grossWpm * (accuracy / 100);
        console.log(`[DEBUG ScoreCalculator calculateScores] Calculated netWpm: ${netWpm}`); // Added log

        // console.log(`Score Calculation: Time=${elapsedTimeSeconds.toFixed(2)}s, Chars=${totalNonSpaceChars}, Incorrect=${gameState.incorrectAttempts}`);
        // console.log(`Scores: Gross WPM=${grossWpm.toFixed(1)}, Accuracy=${accuracy.toFixed(1)}%, Net WPM=${netWpm.toFixed(1)}`);

        const finalScores = { // Added log variable
            netWpm: Math.max(0, parseFloat(netWpm.toFixed(1))), // Ensure non-negative and format
            grossWpm: Math.max(0, parseFloat(grossWpm.toFixed(1))),
            accuracy: parseFloat(accuracy.toFixed(1)),
            elapsedTimeSeconds: parseFloat(elapsedTimeSeconds.toFixed(1)),
            totalChars: totalNonSpaceChars,
            incorrectAttempts: gameState.incorrectAttempts
        };
        console.log('[DEBUG ScoreCalculator calculateScores] Returning final scores:', JSON.parse(JSON.stringify(finalScores))); // Added log
        return finalScores; // Modified return
    }
}

// Example Usage (in another module):
// import { ScoreCalculator } from './scoreCalculator.js';
// const calculator = new ScoreCalculator();
// const scores = calculator.calculateScores(myGameStateInstance);