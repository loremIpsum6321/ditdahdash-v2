// Dit-Dah-Dash_Refactored/src/js/ui/views/levelSelect.js

import { showElement, hideElement, getElementByIdSafe, setTextContent, setHtmlContent } from '../domUtils.js';
// No direct dependency on configConstants here, but LevelManager which provides data uses them.

/**
 * js/ui/views/levelSelect.js
 * --------------------------
 * Manages the display and interaction logic for the Level Selection screen.
 */

export class LevelSelectScreen {
    constructor() {
        this.levelSelectionScreen = getElementByIdSafe('level-selection-screen');
        this.levelListContainer = getElementByIdSafe('level-list');
        this.menuButton = getElementByIdSafe('level-select-menu-button');

        if (!this.levelSelectionScreen || !this.levelListContainer || !this.menuButton) {
            console.error("LevelSelectScreen: Could not find all required level selection elements. Check IDs.");
        }
    }

    /**
     * Shows the level selection screen.
     * Important: Call populateLevelList separately with data before/after showing.
     */
    show() {
        // console.log("LevelSelectScreen: Showing"); // Debug
        if (this.levelSelectionScreen) {
            showElement(this.levelSelectionScreen);
        }
    }

    /**
     * Hides the level selection screen.
     */
    hide() {
         // console.log("LevelSelectScreen: Hiding"); // Debug
        if (this.levelSelectionScreen) {
            hideElement(this.levelSelectionScreen);
        }
    }

    /**
     * Clears and populates the list of level buttons based on provided data.
     * @param {Array<object>} levelsWithStatus - Array of level objects, each containing id, name, isUnlocked, highScore, unlock_criteria.
     */
    populateLevelList(levelsWithStatus) {
        if (!this.levelListContainer) return;

        // console.log("LevelSelectScreen: Populating list..."); // Debug
        this.levelListContainer.innerHTML = ''; // Clear previous list

        if (!Array.isArray(levelsWithStatus)) {
            console.error("LevelSelectScreen: Invalid data provided to populateLevelList.");
            return;
        }

        levelsWithStatus.forEach(level => {
             const button = document.createElement('button');
             // Set base text content
             setTextContent(button, `Level ${level.id}: ${level.name}`);
             button.dataset.levelId = level.id;
             button.classList.add('level-button');

             let titleText = ''; // Build hover title text

             if (level.isUnlocked) {
                 button.disabled = false;
                 if (level.highScore) {
                     button.classList.add('completed');
                     titleText = `Status: Completed\nHigh Score: ${level.highScore.score?.toFixed(1) ?? 'N/A'} WPM, ${level.highScore.accuracy?.toFixed(1) ?? 'N/A'}%`;
                 } else {
                     button.classList.add('unlocked');
                      titleText = `Status: Unlocked\nNo score yet`;
                 }
             } else {
                 button.disabled = true;
                 button.classList.add('locked');
                 // Provide unlock criteria in title if available
                 if (level.unlock_criteria && typeof level.unlock_criteria.min_wpm === 'number' && typeof level.unlock_criteria.min_accuracy === 'number') {
                      // Assuming unlock criteria depend on the previous level (id - 1)
                      const prevLevelId = level.id > 1 ? level.id - 1 : 'previous';
                      titleText = `Locked\nRequires ${level.unlock_criteria.min_wpm} WPM & ${level.unlock_criteria.min_accuracy}% Accuracy on Level ${prevLevelId}`;
                 } else {
                     titleText = 'Locked';
                 }
             }
             button.title = titleText; // Set the tooltip
             this.levelListContainer.appendChild(button);
        });
    }

    /**
     * Adds event listeners for the level selection screen.
     * Uses event delegation for level buttons.
     * @param {object} callbacks - An object containing callback functions.
     * @param {function} callbacks.onLevelSelect - Called when an unlocked level button is clicked. Passes the level ID.
     * @param {function} callbacks.onShowMainMenu - Called when the menu button is clicked.
     */
    addEventListeners(callbacks) {
        if (!callbacks) {
            console.error("LevelSelectScreen: Missing callbacks object for addEventListeners.");
            return;
        }

        // Event delegation for level buttons
        if (this.levelListContainer && typeof callbacks.onLevelSelect === 'function') {
            this.levelListContainer.addEventListener('click', (e) => {
                // Check if the clicked element is a non-disabled button within the container
                if (e.target instanceof HTMLButtonElement &&
                    e.target.classList.contains('level-button') &&
                    !e.target.disabled &&
                    e.target.dataset.levelId)
                {
                    const levelId = parseInt(e.target.dataset.levelId, 10);
                    if (!isNaN(levelId)) {
                        // console.log(`Level selected: ${levelId}`); // Debug
                        callbacks.onLevelSelect(levelId);
                    }
                }
            });
        }

        // Menu button listener
        if (this.menuButton && typeof callbacks.onShowMainMenu === 'function') {
            this.menuButton.addEventListener('click', callbacks.onShowMainMenu);
        }

        console.log("LevelSelectScreen: Event listeners added.");
    }
}

// Example Usage (in main.js or uiManagerFacade.js):
// import { LevelSelectScreen } from './views/levelSelect.js';
// import { LevelManager } from '../game/levelManager.js'; // Assuming levelManager instance exists
//
// const levelSelectScreen = new LevelSelectScreen();
// const levelManager = new LevelManager(); // Instantiate LevelManager
//
// levelSelectScreen.addEventListeners({
//     onLevelSelect: (levelId) => { /* start selected level */ },
//     onShowMainMenu: () => { /* navigate to main menu */ }
// });
//
// // When showing the screen:
// const levels = levelManager.getAllLevelsWithStatus();
// levelSelectScreen.populateLevelList(levels);
// levelSelectScreen.show();