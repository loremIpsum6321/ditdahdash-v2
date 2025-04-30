// Dit-Dah-Dash_Refactored/src/js/game/levelManager.js

import { STORAGE_KEYS } from '../core/configConstants.js';
import { LEVELS_DATA } from '../data/levelsData.js';
// Note: GameState class is not directly imported, but methods interact
// with gameState objects passed as arguments, expecting their structure.

/**
 * js/levelManager.js
 * ------------------
 * Manages game levels, sentences, high scores, and unlocking progression.
 * Uses localStorage for persistence. Imports level data and storage keys.
 */

export class LevelManager {
    constructor() {
        this.levels = LEVELS_DATA; // Use imported level data
        this.highScores = this._loadHighScores();      // { levelId: { score, accuracy, time }, ... }
        this.unlockedLevels = this._loadUnlockedLevels(); // Set of unlocked level IDs

        // Ensure level 1 is always unlocked
        if (this.levels.length > 0 && this.levels[0].id !== undefined) {
            this.unlockedLevels.add(this.levels[0].id);
            this._saveUnlockedLevels(); // Save immediately if it wasn't present or was cleared
        } else {
            console.error("LevelManager: LEVELS_DATA is empty or first level has no ID.");
        }
        console.log("LevelManager Initialized.");
    }

    /**
     * Loads high scores from localStorage.
     * @returns {object} The high scores object.
     * @private
     */
    _loadHighScores() {
        try {
            const storedScores = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
            return storedScores ? JSON.parse(storedScores) : {};
        } catch (e) {
            console.error("Error loading high scores from localStorage:", e);
            // Return empty object on error to prevent downstream issues
            localStorage.removeItem(STORAGE_KEYS.HIGH_SCORES); // Clear potentially corrupted data
            return {};
        }
    }

    /**
     * Saves high scores to localStorage.
     * @private
     */
    _saveHighScores() {
        try {
            localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(this.highScores));
        } catch (e) {
            console.error("Error saving high scores to localStorage:", e);
        }
    }

    /**
     * Loads the set of unlocked level IDs from localStorage.
     * @returns {Set<number>} A Set containing the IDs of unlocked levels.
     * @private
     */
    _loadUnlockedLevels() {
        try {
            const storedLevels = localStorage.getItem(STORAGE_KEYS.UNLOCKED_LEVELS);
            if (storedLevels) {
                // Ensure parsing result is an array before creating a Set
                const parsed = JSON.parse(storedLevels);
                return Array.isArray(parsed) ? new Set(parsed) : this._getDefaultUnlockedSet();
            } else {
                return this._getDefaultUnlockedSet();
            }
        } catch (e) {
            console.error("Error loading unlocked levels from localStorage:", e);
            localStorage.removeItem(STORAGE_KEYS.UNLOCKED_LEVELS); // Clear potentially corrupted data
            return this._getDefaultUnlockedSet();
        }
    }

    /**
     * Helper to get the default unlocked set (Level 1).
     * @returns {Set<number>}
     * @private
     */
    _getDefaultUnlockedSet() {
        if (this.levels.length > 0 && this.levels[0].id !== undefined) {
            return new Set([this.levels[0].id]);
        }
        return new Set(); // Return empty set if levels are invalid
    }


    /**
     * Saves the set of unlocked level IDs to localStorage.
     * @private
     */
    _saveUnlockedLevels() {
        try {
            localStorage.setItem(STORAGE_KEYS.UNLOCKED_LEVELS, JSON.stringify([...this.unlockedLevels]));
        } catch (e) {
            console.error("Error saving unlocked levels to localStorage:", e);
        }
    }

    /**
     * Gets the data for a specific level.
     * @param {number} levelId - The ID of the level.
     * @returns {object | undefined} The level data object or undefined if not found.
     */
    getLevelData(levelId) {
        // Ensure levelId is treated as a number if necessary
        const idToFind = typeof levelId === 'string' ? parseInt(levelId, 10) : levelId;
        return this.levels.find(level => level.id === idToFind);
    }

    /**
     * Gets the next sentence details (level ID, sentence index, text) based on the current game state.
     * Considers sentences within the current level first, then moves to the next unlocked level.
     * @param {GameState} gameState - The current game state instance.
     * @returns {{levelId: number, sentenceIndex: number, sentenceText: string} | null} Info for the next sentence or null if no more levels/sentences or next level is locked.
     */
    getNextSentence(gameState) {
        const currentLevelData = this.getLevelData(gameState.currentLevelId);
        if (!currentLevelData) {
            console.warn(`getNextSentence: Could not find data for current level ID: ${gameState.currentLevelId}`);
            return null;
        }

        const nextSentenceIndex = gameState.currentSentenceIndex + 1;

        // Check if there are more sentences in the current level
        if (nextSentenceIndex < currentLevelData.sentences.length) {
            return {
                levelId: gameState.currentLevelId,
                sentenceIndex: nextSentenceIndex,
                sentenceText: currentLevelData.sentences[nextSentenceIndex]
            };
        } else {
            // End of current level's sentences, try to find the next level
            const nextLevel = this.findNextLevel(gameState.currentLevelId);
            // Check if the next level exists AND is unlocked
            if (nextLevel && this.isLevelUnlocked(nextLevel.id) && nextLevel.sentences.length > 0) {
                 return {
                    levelId: nextLevel.id,
                    sentenceIndex: 0, // Start from the first sentence of the next level
                    sentenceText: nextLevel.sentences[0]
                };
            } else {
                 // No next level, or it's locked, or it has no sentences
                 return null;
            }
        }
    }

     /**
     * Finds the level data for the level immediately following the given ID in the LEVELS_DATA array.
     * @param {number} currentLevelId - The ID of the current level.
     * @returns {object | undefined} The data object for the next level, or undefined if it's the last level.
     */
    findNextLevel(currentLevelId) {
        const idToFind = typeof currentLevelId === 'string' ? parseInt(currentLevelId, 10) : currentLevelId;
        const currentIndex = this.levels.findIndex(level => level.id === idToFind);
        if (currentIndex !== -1 && currentIndex < this.levels.length - 1) {
            // Return the next level in the array
            return this.levels[currentIndex + 1];
        }
        return undefined; // No next level found
    }


    /**
     * Gets the sentence text for a specific level and sentence index.
     * @param {number} levelId - The ID of the level.
     * @param {number} sentenceIndex - The 0-based index of the sentence within the level's sentences array.
     * @returns {string | null} The sentence text or null if invalid indices or level not found.
     */
    getSpecificSentence(levelId, sentenceIndex) {
        const levelData = this.getLevelData(levelId);
        if (levelData && Array.isArray(levelData.sentences) && sentenceIndex >= 0 && sentenceIndex < levelData.sentences.length) {
            return levelData.sentences[sentenceIndex];
        }
        console.warn(`getSpecificSentence: Could not find sentence for level ${levelId}, index ${sentenceIndex}`);
        return null;
    }

    /**
     * Records the score for a completed level/sentence if it's a high score.
     * Also checks if the performance meets the criteria to unlock the next level.
     * @param {number} levelId - The ID of the completed level.
     * @param {object} scores - The calculated scores object { netWpm, accuracy, elapsedTimeSeconds }.
     * @returns {{isNewHighScore: boolean, unlockedNextLevelId: number | null}} Info about the result.
     */
    recordScoreAndCheckUnlocks(levelId, scores) {
        let isNewHighScore = false;
        let unlockedNextLevelId = null;
        const idToCheck = typeof levelId === 'string' ? parseInt(levelId, 10) : levelId;

        const currentHighScore = this.highScores[idToCheck];

        // Basic validation of scores object
        if (typeof scores?.netWpm !== 'number' || typeof scores?.accuracy !== 'number' || typeof scores?.elapsedTimeSeconds !== 'number') {
            console.error("recordScoreAndCheckUnlocks: Invalid scores object received.", scores);
            return { isNewHighScore, unlockedNextLevelId };
        }

        // Check for new high score (prioritize higher Net WPM, then better accuracy, then faster time)
        if (!currentHighScore ||
            scores.netWpm > currentHighScore.score ||
            (scores.netWpm === currentHighScore.score && scores.accuracy > currentHighScore.accuracy) ||
            (scores.netWpm === currentHighScore.score && scores.accuracy === currentHighScore.accuracy && scores.elapsedTimeSeconds < currentHighScore.time))
        {
            this.highScores[idToCheck] = {
                score: scores.netWpm,
                accuracy: scores.accuracy,
                time: scores.elapsedTimeSeconds
            };
            this._saveHighScores();
            isNewHighScore = true;
            console.log(`New high score recorded for Level ${idToCheck}: WPM=${scores.netWpm}, Acc=${scores.accuracy}%`);
        }

        // Check if the performance meets the criteria to unlock the next level
        const nextLevel = this.findNextLevel(idToCheck);
        if (nextLevel && !this.isLevelUnlocked(nextLevel.id)) {
            const criteria = nextLevel.unlock_criteria;
            // Check if criteria exist and are met
            if (criteria && typeof criteria.min_wpm === 'number' && typeof criteria.min_accuracy === 'number' &&
                scores.netWpm >= criteria.min_wpm && scores.accuracy >= criteria.min_accuracy)
            {
                this.unlockedLevels.add(nextLevel.id);
                this._saveUnlockedLevels();
                unlockedNextLevelId = nextLevel.id;
                console.log(`Level ${nextLevel.id} unlocked!`);
            }
        }

        return { isNewHighScore, unlockedNextLevelId };
    }

    /**
     * Checks if a specific level is unlocked.
     * @param {number} levelId - The ID of the level to check.
     * @returns {boolean} True if the level is unlocked, false otherwise.
     */
    isLevelUnlocked(levelId) {
        const idToCheck = typeof levelId === 'string' ? parseInt(levelId, 10) : levelId;
        return this.unlockedLevels.has(idToCheck);
    }

    /**
     * Gets the high score for a specific level.
     * @param {number} levelId - The ID of the level.
     * @returns {object | null} The high score object { score, accuracy, time } or null if none exists.
     */
    getHighScore(levelId) {
        const idToCheck = typeof levelId === 'string' ? parseInt(levelId, 10) : levelId;
        return this.highScores[idToCheck] || null;
    }

    /**
     * Gets all levels data along with their unlock status and high scores.
     * Useful for building the level selection screen.
     * @returns {Array<object>} Array of level objects with added status info.
     */
    getAllLevelsWithStatus() {
        return this.levels.map(level => ({
            ...level,
            isUnlocked: this.isLevelUnlocked(level.id),
            highScore: this.getHighScore(level.id)
            // unlock_criteria is already part of level data from LEVELS_DATA
        }));
    }

    /**
     * Resets all high scores and unlocked levels (keeps level 1 unlocked).
     */
    resetProgress() {
        this.highScores = {};
        this.unlockedLevels = this._getDefaultUnlockedSet(); // Reset to only level 1 unlocked
        this._saveHighScores();
        this._saveUnlockedLevels();
        console.log("Game progress reset.");
    }
}

// Example Usage (in another module):
// import { LevelManager } from './levelManager.js';
// const levelManager = new LevelManager();
// const levelStatus = levelManager.getAllLevelsWithStatus();