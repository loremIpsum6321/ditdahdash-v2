// Dit-Dah-Dash_Refactored/src/js/ui/views/resultsScreen.js

import { showElement, hideElement, setTextContent, getElementByIdSafe } from '../domUtils.js';
import { getKeyDisplay } from '../../core/configConstants.js'; // For key hints
import { AppMode } from '../../core/appStatus.js'; // For mode-specific display logic

/**
 * js/ui/views/resultsScreen.js
 * ----------------------------
 * Manages the display and interaction logic for the Results Screen overlay.
 */

export class ResultsScreen {
    constructor() {
        this.resultsScreen = getElementByIdSafe('results-screen');
        this.resultsRatingContainer = getElementByIdSafe('results-rating');
        this.resultsStatsContainer = getElementByIdSafe('results-stats');
        this.resultsTime = getElementByIdSafe('results-time');
        this.resultsNetWpm = getElementByIdSafe('results-net-wpm');
        this.resultsGrossWpm = getElementByIdSafe('results-gross-wpm');
        this.resultsAccuracy = getElementByIdSafe('results-accuracy');
        this.levelUnlockMessage = getElementByIdSafe('level-unlock-message');
        this.resultsInstructions = this.resultsScreen?.querySelector('.results-instructions');
        this.menuButton = getElementByIdSafe('results-menu-button');

        // Verify essential elements
        if (!this.resultsScreen || !this.resultsRatingContainer || !this.resultsStatsContainer || !this.resultsTime ||
            !this.resultsNetWpm || !this.resultsGrossWpm || !this.resultsAccuracy || !this.levelUnlockMessage ||
            !this.resultsInstructions || !this.menuButton) {
            console.error("ResultsScreen: Could not find all required results screen elements. Check IDs.");
        }
         console.log("[DEBUG ResultsScreen] Constructor finished."); // Added log
    }

    /**
     * Shows the results screen and populates it with score data.
     * @param {object} scores - The calculated scores object { netWpm, grossWpm, accuracy, elapsedTimeSeconds, incorrectAttempts, totalChars }.
     * @param {number | null} unlockedLevelId - The ID of the next level if unlocked, otherwise null.
     * @param {boolean} hasNextLevelOption - Whether a 'Next' option should be visually available (level exists and is unlocked).
     * @param {AppMode} mode - The mode the user just finished (AppMode.GAME or AppMode.SANDBOX).
     * @param {object} keyMappings - Current key mappings { dit: 'key', dah: 'key' } for hint display.
     */
    show(scores, unlockedLevelId, hasNextLevelOption, mode, keyMappings) {
        console.log("[DEBUG ResultsScreen show] Called."); // Added log
        console.log("[DEBUG ResultsScreen show] Received Scores:", JSON.parse(JSON.stringify(scores))); // Added log
        console.log(`[DEBUG ResultsScreen show] unlockedLevelId: ${unlockedLevelId}, hasNextLevelOption: ${hasNextLevelOption}, mode: ${mode}`); // Added log

        if (!this.resultsScreen || !scores) {
            console.error("[DEBUG ResultsScreen show] Cannot show - screen element or scores missing.");
            return;
        }

        // Populate score details
        console.log("[DEBUG ResultsScreen show] Populating score details..."); // Added log
        setTextContent(this.resultsTime, `Time: ${scores.elapsedTimeSeconds?.toFixed(1) ?? 'N/A'}s`);
        setTextContent(this.resultsNetWpm, `Net WPM: ${scores.netWpm?.toFixed(1) ?? 'N/A'}`);
        setTextContent(this.resultsGrossWpm, `Gross WPM: ${scores.grossWpm?.toFixed(1) ?? 'N/A'}`);
        setTextContent(this.resultsAccuracy, `Accuracy: ${scores.accuracy?.toFixed(1) ?? 'N/A'}%`);

        // Update star rating based on accuracy
        this.updateStarRating(scores.accuracy ?? 0);

        // Display unlock message if applicable (only in Game mode)
        if (mode === AppMode.GAME && unlockedLevelId) {
            const unlockMsg = `Congratulations! Level ${unlockedLevelId} unlocked!`;
            console.log(`[DEBUG ResultsScreen show] Setting unlock message: "${unlockMsg}"`); // Added log
            setTextContent(this.levelUnlockMessage, unlockMsg);
            showElement(this.levelUnlockMessage);
        } else {
             console.log("[DEBUG ResultsScreen show] Clearing unlock message."); // Added log
             // Clear message and ensure it takes up no space if hidden
             setTextContent(this.levelUnlockMessage, '');
             // Use style.display none might be better if CSS uses margins/padding
             hideElement(this.levelUnlockMessage); // Assuming .hidden sets display: none
             // Alternatively: if (this.levelUnlockMessage) this.levelUnlockMessage.style.display = 'none';
        }

        // Update key hints in instructions
        if (this.resultsInstructions && keyMappings?.dit && keyMappings?.dah) {
            const keyDisplayDit = getKeyDisplay(keyMappings.dit);
            const keyDisplayDah = getKeyDisplay(keyMappings.dah);
            const instructionsHTML = `Press <span class="key-hint">${keyDisplayDit}</span> (Retry) or <span class="key-hint">${keyDisplayDah}</span> (Next)`;
            console.log(`[DEBUG ResultsScreen show] Setting instructions HTML: ${instructionsHTML}`); // Added log
            // Use innerHTML carefully here as we are adding spans
            this.resultsInstructions.innerHTML = instructionsHTML;
        } else if (this.resultsInstructions) {
             const fallbackText = "Press Dit (Retry) or Dah (Next)";
            console.warn("[DEBUG ResultsScreen show] Key mappings missing, using fallback instructions."); // Added log
            // Fallback text if key mappings are missing
            setTextContent(this.resultsInstructions, fallbackText);
        }

        // Show the screen itself
        showElement(this.resultsScreen);
        console.log("[DEBUG ResultsScreen show] Screen element shown."); // Added log

        // Note: Updating paddle labels/state is handled by PaddleControls module
    }

    /**
     * Hides the results screen.
     */
    hide() {
        console.log("[DEBUG ResultsScreen hide] Called."); // Added log
        if (this.resultsScreen) {
            hideElement(this.resultsScreen);
        }
    }

    /**
     * Updates the star rating display based on accuracy percentage.
     * @param {number} accuracy - The accuracy score (0-100).
     */
    updateStarRating(accuracy) {
        if (!this.resultsRatingContainer) return;
        const stars = this.resultsRatingContainer.querySelectorAll('.star');
        let filledStars = 0;
        // Define thresholds for stars
        if (accuracy >= 98) filledStars = 3;
        else if (accuracy >= 90) filledStars = 2;
        else if (accuracy >= 75) filledStars = 1;

        // console.log(`[DEBUG ResultsScreen updateStarRating] Accuracy: ${accuracy}, Filled Stars: ${filledStars}`); // Added log - potentially noisy

        stars.forEach((star, index) => {
            if (star instanceof HTMLElement) {
                const isFilled = index < filledStars;
                star.classList.toggle('filled', isFilled);
                star.textContent = isFilled ? '★' : '☆'; // Unicode stars
            }
        });
    }

    /**
     * Adds event listeners for the results screen (e.g., menu button).
     * Note: Dit/Dah input listeners for Retry/Next are handled globally by InputHandler/KeyingLogic.
     * @param {object} callbacks - An object containing callback functions.
     * @param {function} callbacks.onShowMainMenu - Called when the menu button is clicked.
     */
    addEventListeners(callbacks) {
        if (!callbacks) {
            console.error("ResultsScreen: Missing callbacks object for addEventListeners.");
            return;
        }

        if (this.menuButton && typeof callbacks.onShowMainMenu === 'function') {
            this.menuButton.addEventListener('click', () => {
                 console.log("[DEBUG ResultsScreen menuButton Click] Calling onShowMainMenu callback."); // Added log
                 callbacks.onShowMainMenu();
            });
        }

        console.log("ResultsScreen: Event listeners added.");
    }
}

// Example Usage (in main.js or uiManagerFacade.js):
// import { ResultsScreen } from './views/resultsScreen.js';
// const resultsScreen = new ResultsScreen();
// resultsScreen.addEventListeners({
//     onShowMainMenu: () => { /* navigate to main menu */ }
// });
// // Later, when game finishes:
// const currentKeys = { dit: '.', dah: '-' }; // Get current mappings
// resultsScreen.show(calculatedScores, unlockedId, canGoNext, currentMode, currentKeys);