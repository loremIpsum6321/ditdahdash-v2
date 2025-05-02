/* Dit-Dah-Dash_Refactored/src/js/game/morseDecoder.js */

import {
    MORSE_MAP,
    DEFAULT_WPM,
    INTER_CHARACTER_GAP_UNITS,
    CHARACTER_INPUT_TIMEOUT_MULTIPLIER
} from '../core/configConstants.js';
// NOTE: GameStatus and AppMode are not directly needed by the decoder logic itself.
// The caller (e.g., keyingLogic or gameController) will handle state checks.

/**
 * js/morseDecoder.js
 * ------------------
 * Handles decoding Morse sequences to characters and encoding sentences
 * into playable Morse sequences with timing markers. Uses mappings and
 * constants from configConstants.js.
 */

export class MorseDecoder {
    constructor() {
        this.morseMap = MORSE_MAP;
        // Create reverse map for encoding
        this.reverseMorseMap = Object.fromEntries(
            Object.entries(this.morseMap).map(([key, value]) => [value, key])
        );
        this.currentWpm = 0; // Initialize differently to ensure first update runs
        this.ditDuration = 0; // ms
        this.interCharGapThreshold = 0; // ms timeout threshold for decoding

        this.decodeTimeoutId = null;

        this.updateWpm(DEFAULT_WPM); // Initial calculation based on default WPM
        console.log("MorseDecoder Initialized");
    }

    /**
     * Updates the WPM and recalculates timing thresholds.
     * @param {number} wpm - The new Words Per Minute setting. Must be > 0.
     */
    updateWpm(wpm) {
        // Add logging to see the received WPM value
        console.log(`[Decoder.updateWpm] Received WPM: ${wpm} (Type: ${typeof wpm})`); // Log received value

        let validWpm = wpm;
        if (typeof wpm !== 'number' || isNaN(wpm) || wpm <= 0) {
            console.warn(`MorseDecoder: Invalid WPM value received: ${wpm}. Falling back to DEFAULT_WPM (${DEFAULT_WPM}).`);
            validWpm = DEFAULT_WPM; // Use default if invalid
        }

        // Avoid recalculation only if the *validated* WPM matches the current one
        if (this.currentWpm === validWpm) {
            // console.log(`[Decoder.updateWpm] WPM unchanged (${validWpm}). Skipping recalculation.`); // Debug
            return;
        }

        this.currentWpm = validWpm;
        // Formula: 1 WPM = 50 dit units per minute (PARIS standard)
        // Time per dit unit (ms) = (60 seconds * 1000 ms/sec) / (WPM * 50 units/min) = 1200 / WPM
        this.ditDuration = 1200 / this.currentWpm; // ms per dit element

        // Calculate the timeout threshold for detecting the end of a character input sequence.
        // This is based on the standard inter-character gap, potentially adjusted by a multiplier.
        const interCharGapDurationMs = this.ditDuration * INTER_CHARACTER_GAP_UNITS;
        this.interCharGapThreshold = interCharGapDurationMs * CHARACTER_INPUT_TIMEOUT_MULTIPLIER;

        // Ensure the threshold is at least a minimal positive value (e.g., 1ms) as a safeguard,
        // although with validWpm > 0, this shouldn't strictly be necessary.
        this.interCharGapThreshold = Math.max(1, this.interCharGapThreshold);

        // Add detailed log of calculated values
        console.log(`[Decoder.updateWpm] Applied WPM=${this.currentWpm}. Calculated: Dit=${this.ditDuration.toFixed(2)}ms, Decode Timeout Threshold=${this.interCharGapThreshold.toFixed(2)}ms`);
    }

    /**
     * Decodes a given Morse code sequence.
     * @param {string} sequence - The sequence of '.' and '-' (e.g., '.-').
     * @returns {string | null} The decoded character (uppercase) or null if invalid.
     */
    decodeSequence(sequence) {
        if (!sequence) return null;
        const decodedChar = this.morseMap[sequence];
        // Return the character if found, otherwise null
        return decodedChar !== undefined ? decodedChar : null;
    }

    /**
     * Schedules a callback function to be executed after the inter-character gap timeout.
     * This function is intended to trigger the final decode attempt for the current sequence.
     * The responsibility of managing the GameState (e.g., setting DECODING status) lies with the caller.
     * @param {function} decodeCallback - The function to call when the timer expires.
     * @returns {number | null} The timeout ID, or null if scheduling failed.
     */
    scheduleDecode(decodeCallback) {
        this.cancelScheduledDecode(); // Clear any existing timer first
        if (typeof decodeCallback !== 'function') {
            console.error("MorseDecoder: scheduleDecode requires a valid callback function.");
            return null;
        }
        // --- Re-check threshold right before scheduling ---
        if (this.interCharGapThreshold <= 0) {
             console.error(`MorseDecoder: Cannot schedule decode, invalid interCharGapThreshold at schedule time: ${this.interCharGapThreshold}. WPM: ${this.currentWpm}`);
             // --- Force recalculation based on current WPM as a recovery attempt ---
             console.warn("MorseDecoder: Forcing recalculation of threshold...");
             this.updateWpm(this.currentWpm); // This will re-validate and recalculate
             if (this.interCharGapThreshold <= 0) {
                 console.error("MorseDecoder: Recalculation failed to produce valid threshold. Aborting schedule.");
                 return null; // Still invalid after recalculation
             }
             console.warn(`MorseDecoder: Threshold recalculated to ${this.interCharGapThreshold.toFixed(2)}ms. Proceeding with schedule.`);
        }


        // console.log(`Scheduling decode callback in ${this.interCharGapThreshold.toFixed(0)}ms`); // Debug
        this.decodeTimeoutId = setTimeout(() => {
            // console.log("Decode timer expired. Executing callback."); // Debug
            this.decodeTimeoutId = null; // Clear the ID before calling back
            decodeCallback(); // Execute the provided callback
        }, this.interCharGapThreshold);

        return this.decodeTimeoutId;
    }

    /** Cancels any pending scheduled decode timer. */
    cancelScheduledDecode() {
        if (this.decodeTimeoutId !== null) {
            // console.log("Cancelling scheduled decode timer:", this.decodeTimeoutId); // Debug
            clearTimeout(this.decodeTimeoutId);
            this.decodeTimeoutId = null;
        }
    }

    /**
     * Gets the Morse code sequence for a single character.
     * Returns null for unmappable characters, "" for space (handled by encodeSentence).
     * @param {string} character - The character to encode (case-insensitive).
     * @returns {string | null} The Morse sequence (e.g., ".-") or null if not found.
     */
     encodeCharacter(character) {
        if (character === ' ') return ""; // Space is treated as a gap marker in encodeSentence

        const upperChar = character.toUpperCase();
        const sequence = this.reverseMorseMap[upperChar];

        // Return the sequence if found, otherwise null for unknown characters
        return sequence !== undefined ? sequence : null;
    }

    /**
     * Encodes a full sentence into a Morse sequence string with timing markers.
     * '.'/' ' = Dit/Dah elements
     * ' ' = Gap between elements (intra-character) - 1 unit
     * '/' = Gap between characters (inter-character) - 3 units total (added implicitly after intra)
     * '|' = Gap between words (word gap) - 7 units total (added implicitly after intra)
     * Unknown characters are skipped.
     * @param {string} sentence - The sentence to encode.
     * @returns {string} The encoded Morse string with timing markers, or empty string if input is empty/invalid.
     */
    encodeSentence(sentence) {
        if (!sentence || typeof sentence !== 'string') return "";

        let morseString = "";
        const words = sentence.trim().toUpperCase().split(/\s+/); // Split into words by whitespace

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            for (let j = 0; j < word.length; j++) {
                const char = word[j];
                const sequence = this.encodeCharacter(char); // Gets sequence like ".-." or null

                if (sequence !== null) { // Only process known characters
                     // Add Morse elements with intra-character spaces
                     morseString += sequence.split('').join(' ');

                     // Add inter-character gap marker if not the last character of the word
                     if (j < word.length - 1) {
                         morseString += " / "; // Represents the 3-unit gap
                     }
                } else {
                     console.warn(`Skipping unknown character during encoding: ${char}`);
                 }
            }
            // Add word gap marker if not the last word of the sentence
            if (i < words.length - 1) {
                morseString += " | "; // Represents the 7-unit gap
            }
        }
        // Trim any trailing separators that might occur due to final gaps
        morseString = morseString.replace(/(\s*[\/\|]\s*)+$/, '').trim();

        // console.log(`Encoded "${sentence}" to: "${morseString}"`); // Debug
        return morseString;
    }

}