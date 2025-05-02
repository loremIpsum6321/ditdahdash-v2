// Dit-Dah-Dash_Refactored/src/js/game/wordGenerator.js

import { MORSE_MAP } from '../core/configConstants.js';

/**
 * js/game/wordGenerator.js
 * -----------------------
 * Utility class for generating random "lorem ipsum"-like words suitable
 * for Morse code practice (only using characters present in MORSE_MAP).
 */

export class WordGenerator {
    constructor() {
        // Define character sets based on Morse map keys (implicitly filtering out prosigns etc.)
        const reverseMorseMap = Object.fromEntries(
            Object.entries(MORSE_MAP).map(([key, value]) => [value, key])
        );
        const allMorseChars = Object.keys(reverseMorseMap).filter(char => /^[A-Z0-9]+$/.test(char)); // Filter for letters/numbers only

        // Separate vowels and consonants (adjust based on desired output)
        // This is a simplified English-centric view
        const vowels = "AEIOU".split('');
        const consonants = "BCDFGHJKLMNPQRSTVWXYZ".split('');
        // Include numbers if desired
        const numbers = "0123456789".split('');

        // Filter based on characters available in MORSE_MAP
        this.availableVowels = vowels.filter(char => allMorseChars.includes(char));
        this.availableConsonants = consonants.filter(char => allMorseChars.includes(char));
        this.availableNumbers = numbers.filter(char => allMorseChars.includes(char));

        // Combine consonants and numbers for simplicity if needed, or keep separate
        this.availableNonVowels = [...this.availableConsonants, ...this.availableNumbers];

        if (this.availableVowels.length === 0 || this.availableNonVowels.length === 0) {
            console.error("WordGenerator: Not enough vowels or non-vowels available in MORSE_MAP to generate words.");
            // Fallback: Use all available chars for random generation
            this.availableVowels = allMorseChars;
            this.availableNonVowels = allMorseChars;
        }

        console.log("WordGenerator Initialized.");
        // console.log("Available Vowels:", this.availableVowels); // Debug
        // console.log("Available Non-Vowels:", this.availableNonVowels); // Debug
    }

    /**
     * Selects a random element from an array.
     * @param {Array<T>} arr - The array to choose from.
     * @returns {T | undefined} A random element or undefined if the array is empty.
     * @private
     */
    _getRandomElement(arr) {
        if (!arr || arr.length === 0) return undefined;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Generates a single random word-like string.
     * @param {number} [minLength=3] - Minimum word length.
     * @param {number} [maxLength=8] - Maximum word length.
     * @returns {string} A randomly generated word string in uppercase.
     */
    generateWord(minLength = 3, maxLength = 8) {
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        let word = "";
        // Basic structure: alternate consonant/vowel
        let nextIsVowel = Math.random() < 0.5; // Start randomly with vowel or consonant

        for (let i = 0; i < length; i++) {
            let char;
            if (nextIsVowel) {
                char = this._getRandomElement(this.availableVowels);
            } else {
                char = this._getRandomElement(this.availableNonVowels);
            }

            // Handle cases where one set might be empty or a character isn't found
            if (!char) {
                // Fallback: pick from the other set or default to 'E'/'T'
                char = nextIsVowel
                    ? this._getRandomElement(this.availableNonVowels) || 'T'
                    : this._getRandomElement(this.availableVowels) || 'E';
            }

            word += char;
            nextIsVowel = !nextIsVowel; // Alternate for the next character
        }

        return word; // Already uppercase as source arrays are uppercase
    }

    /**
     * Generates a specified number of random words.
     * @param {number} count - The number of words to generate.
     * @param {number} [minLength=3] - Minimum word length.
     * @param {number} [maxLength=8] - Maximum word length.
     * @returns {Array<string>} An array of generated word strings.
     */
    generateWords(count, minLength = 3, maxLength = 8) {
        const words = [];
        for (let i = 0; i < count; i++) {
            words.push(this.generateWord(minLength, maxLength));
        }
        return words;
    }
}

// // Example Usage:
// const generator = new WordGenerator();
// const tenWords = generator.generateWords(10);
// console.log(tenWords.join(' '));
// const singleWord = generator.generateWord(5, 5);
// console.log(singleWord);