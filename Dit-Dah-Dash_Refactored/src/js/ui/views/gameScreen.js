// Dit-Dah-Dash_Refactored/src/js/ui/views/gameScreen.js
import { showElement, hideElement, setTextContent, setHtmlContent, getElementByIdSafe } from '../domUtils.js'; // <-- Added setHtmlContent here
import { INCORRECT_FLASH_DURATION, HINT_DEFAULT_VISIBLE } from '../../core/configConstants.js';
// GameStatus might be needed if feedback logic depends on it, but ideally handled by caller.

/**
 * js/ui/views/gameScreen.js
 * -------------------------
 * Manages the UI elements and updates for the main game screen (Game and Sandbox modes).
 */

export class GameScreen {
    constructor(morseDecoderInstance) { // Requires decoder to encode target characters
        if (!morseDecoderInstance) {
            throw new Error("GameScreen requires a MorseDecoder instance.");
        }
        this.morseDecoder = morseDecoderInstance;

        // Element References
        this.gameUiWrapper = getElementByIdSafe('game-ui-wrapper');
        this.textDisplayWrapper = getElementByIdSafe('text-display-wrapper');
        this.textDisplay = getElementByIdSafe('text-display');
        this.targetPatternContainer = getElementByIdSafe('target-pattern-container');
        this.targetPatternOuterWrapper = getElementByIdSafe('target-pattern-outer-wrapper');
        this.toggleHintButton = getElementByIdSafe('toggle-hint-button');
        this.userPatternContainer = getElementByIdSafe('user-pattern-container');
        this.statsDisplay = getElementByIdSafe('stats-display'); // Although hidden in game view
        this.timerDisplay = getElementByIdSafe('timer-display');
        this.wpmDisplay = getElementByIdSafe('wpm-display');
        this.accuracyDisplay = getElementByIdSafe('accuracy-display');
        this.grossWpmDisplay = getElementByIdSafe('gross-wpm-display');
        this.volumeControlArea = getElementByIdSafe('volume-control-area');
        this.volumeSlider = getElementByIdSafe('volume-slider');
        this.speakerIcon = getElementByIdSafe('speaker-icon');
        this.speakerWave1 = getElementByIdSafe('speaker-wave-1');
        this.speakerWave2 = getElementByIdSafe('speaker-wave-2');
        this.speakerWave3 = getElementByIdSafe('speaker-wave-3');
        this.menuButton = getElementByIdSafe('game-menu-button');

        // Basic validation
        if (!this.gameUiWrapper || !this.textDisplayWrapper || !this.textDisplay ||
            !this.targetPatternContainer || !this.targetPatternOuterWrapper || !this.toggleHintButton ||
            !this.userPatternContainer || !this.volumeSlider || !this.speakerIcon || !this.menuButton) {
             console.warn("GameScreen: One or more essential game UI elements not found. Check IDs.");
        }

        // Internal State
        this.isHintVisible = HINT_DEFAULT_VISIBLE; // Tracks the desired state
        this._incorrectCharFlashTimeout = null;
        this._incorrectPatternTimeout = null;
        this._correctPatternTimeout = null;
        this._hintPulseTimer = null;

        // Reusable SVG strings (Consider moving to constants if used elsewhere)
        this.ditSvgString = `<svg class="pattern-dit" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="15" /></svg>`;
        this.dahSvgString = `<svg class="pattern-dah" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="10" rx="3"/></svg>`;

        console.log("GameScreen Initialized.");
    }

    /** Shows the main game UI wrapper. */
    show() {
        // console.log("GameScreen: Showing"); // Debug
        if (this.gameUiWrapper) {
            showElement(this.gameUiWrapper);
            this._applyHintVisibility(this.isHintVisible, false); // Apply initial visibility without pulse
        }
    }

    /** Hides the main game UI wrapper. */
    hide() {
        // console.log("GameScreen: Hiding"); // Debug
        if (this.gameUiWrapper) {
            hideElement(this.gameUiWrapper);
            this._stopHintPulse("View Hidden");
        }
    }

    /**
     * Renders the sentence characters into the text display area.
     * @param {string} sentence - The sentence string to render.
     */
    renderSentence(sentence) {
        if (!this.textDisplay || !this.textDisplayWrapper) return;

        // Clear previous content and styles
        this.textDisplay.innerHTML = '';
        this.textDisplay.style.fontSize = ''; // Reset font size for recalculation
        this.textDisplay.style.transform = 'translateX(0px)'; // Reset scroll transform
        this.textDisplayWrapper.scrollLeft = 0; // Reset scroll position

        if (sentence && typeof sentence === 'string') {
            sentence.split('').forEach((char, index) => {
                const span = document.createElement('span');
                setTextContent(span, char); // Use helper for text content
                span.classList.add('char', 'pending');
                span.dataset.index = index.toString(); // Store index as string
                if (char === ' ') {
                    span.classList.add('space');
                }
                this.textDisplay.appendChild(span);
            });
        }

        this.resetCharacterStyles();
        this.updateUserPatternDisplay("");
        this.setPatternDisplayState('default');
        this._adjustTextDisplayFontSize(); // Adjust font size after adding content
        this._stopHintPulse("New Sentence Rendered");
    }

    /** Adjusts the font size of the text display to fit vertically within its wrapper. */
    _adjustTextDisplayFontSize() {
        const element = this.textDisplay;
        const container = this.textDisplayWrapper;
        if (!element || !container || !element.textContent) {
            if(element) element.style.fontSize = ''; // Reset if no content
            return;
        }

        element.style.fontSize = ''; // Reset to CSS default
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const minFontSize = 10; // Minimum acceptable font size
        let iterations = 0;
        const maxIterations = 50; // Prevent infinite loops

        // Reduce font size until content fits vertically or minimum size is reached
        while (element.scrollHeight > container.clientHeight && currentFontSize > minFontSize && iterations < maxIterations) {
            currentFontSize *= 0.95; // Reduce by 5%
            element.style.fontSize = `${currentFontSize}px`;
            iterations++;
        }
        // if (iterations >= maxIterations) console.warn("Max font size adjustment iterations reached.");
    }

    /** Resets all character spans to the 'pending' state. */
    resetCharacterStyles() {
        this.textDisplay?.querySelectorAll('.char').forEach(span => {
            span.className = 'char pending'; // Base classes
            if (span.textContent === ' ') {
                 span.classList.add('space');
            }
        });
    }

    /**
     * Updates the visual state of a specific character span.
     * Handles timed removal of 'incorrect' state.
     * @param {number} charIndex - The index of the character span.
     * @param {'pending' | 'current' | 'completed' | 'incorrect'} state - The new state.
     */
    updateCharacterState(charIndex, state) {
        const charSpan = this.textDisplay?.querySelector(`.char[data-index="${charIndex}"]`);
        if (!charSpan) return;

        // Clear previous state classes first
        charSpan.classList.remove('pending', 'current', 'completed', 'incorrect');
        // Add the new state class
        charSpan.classList.add(state);

        // Special handling for incorrect state (timed flash)
        if (state === 'incorrect') {
            this._stopHintPulse("Character Incorrect");
            // Clear any existing flash timeout for this character
            if (this._incorrectCharFlashTimeout) clearTimeout(this._incorrectCharFlashTimeout);

            this._incorrectCharFlashTimeout = setTimeout(() => {
                // Check if the span *still* has 'incorrect' (it might have been updated again)
                if (charSpan.classList.contains('incorrect')) {
                    charSpan.classList.remove('incorrect');
                    // Determine what state it should revert to (usually 'current' if it's the active char)
                    // This logic might need external game state info, ideally passed in or handled by caller.
                    // For simplicity here, revert to pending if not completed. A 'current' state would be reapplied separately.
                     if (!charSpan.classList.contains('completed')) {
                        charSpan.classList.add('pending'); // Default fallback
                     }
                }
                this._incorrectCharFlashTimeout = null;
            }, INCORRECT_FLASH_DURATION);
        }
         // If setting to something else, clear any pending incorrect flash timeout
         else if (this._incorrectCharFlashTimeout) {
             clearTimeout(this._incorrectCharFlashTimeout);
             this._incorrectCharFlashTimeout = null;
         }

        // Handle scrolling and hint pulse based on state
        if (state === 'current') {
            this._centerCurrentCharacterHorizontally(charSpan);
            // Hint pulse logic is tied to highlighting the character, handled there
        } else if (state === 'completed') {
            this._stopHintPulse("Character Completed");
        }
    }

    /** Scrolls the text display wrapper horizontally to center the current character element. */
    _centerCurrentCharacterHorizontally(element) {
        const container = this.textDisplayWrapper;
        const textDisplay = this.textDisplay;
        if (!container || !element || !textDisplay) return;

        // Use requestAnimationFrame to ensure layout is calculated
        requestAnimationFrame(() => {
            // Re-query element inside RAF to be safe
            const currentElement = textDisplay.querySelector(`.char[data-index="${element.dataset.index}"]`);
            if (!currentElement) return;

            const containerRect = container.getBoundingClientRect();
            const elementRect = currentElement.getBoundingClientRect();

            // Calculate center positions relative to viewport
            const containerCenter = containerRect.left + containerRect.width / 2;
            const elementCenter = elementRect.left + elementRect.width / 2;

            // Calculate how much to scroll to bring element center to container center
            const scrollAdjustment = elementCenter - containerCenter;

            // Calculate the target scroll position
            let targetScrollLeft = container.scrollLeft + scrollAdjustment;

            // Clamp scroll position within bounds (0 to max scroll)
            const maxScrollLeft = container.scrollWidth - containerRect.width;
            targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

            // Apply smooth scroll if adjustment is significant
            if (Math.abs(container.scrollLeft - targetScrollLeft) > 1) {
                container.scrollTo({
                    left: targetScrollLeft,
                    behavior: 'smooth'
                });
            }
        });
    }

    /** Helper to create SVG element string */
    _createPatternSvg(type) {
        return type === '.' ? this.ditSvgString : this.dahSvgString;
    }

    /** Updates the target (hint) pattern display. */
    updateTargetPatternDisplay(morseSequence) {
        if (!this.targetPatternContainer) return;
        this._stopHintPulse("Target Pattern Update");
        // Use setHtmlContent carefully, ensure SVG strings are safe
        setHtmlContent(this.targetPatternContainer, ''); // Clear first
        if (morseSequence) {
             let html = '';
             morseSequence.split('').forEach(el => {
                 if (el === '.' || el === '-') html += this._createPatternSvg(el);
             });
             setHtmlContent(this.targetPatternContainer, html);
        }
        // Apply visibility state (might hide the newly added elements)
        this._applyHintVisibility(this.isHintVisible); // Pass current state
    }

    /** Updates the user input pattern display. */
    updateUserPatternDisplay(morseSequence) {
        if (!this.userPatternContainer) return;
        if (morseSequence) {
            this._stopHintPulse("User Input Started"); // Stop hint pulse when user types
        }
        setHtmlContent(this.userPatternContainer, ''); // Clear first
        if (morseSequence) {
            let html = '';
             morseSequence.split('').forEach(el => {
                 if (el === '.' || el === '-') html += this._createPatternSvg(el);
             });
             setHtmlContent(this.userPatternContainer, html);
        }
    }

     /**
     * Sets the visual feedback state (default, correct, incorrect) for the pattern containers.
     * @param {'default' | 'correct' | 'incorrect'} state - The feedback state.
     */
     setPatternDisplayState(state) {
        const userContainer = this.userPatternContainer;
        const targetContainer = this.targetPatternContainer; // Hint container

        if (!userContainer) return;

        // Clear conflicting timeouts
        if (state !== 'correct' && this._correctPatternTimeout) {
            clearTimeout(this._correctPatternTimeout); this._correctPatternTimeout = null;
        }
        if (state !== 'incorrect' && this._incorrectPatternTimeout) {
            clearTimeout(this._incorrectPatternTimeout); this._incorrectPatternTimeout = null;
        }

        // Define class names based on state
        const correctClass = 'correct-pattern'; // Changed from correct-flash to match CSS
        const incorrectClass = 'incorrect-pattern';

        // Remove existing feedback classes
        userContainer.classList.remove(correctClass, incorrectClass);
        targetContainer?.classList.remove(correctClass, incorrectClass); // Only if target exists

        // Stop Hint Pulse if feedback occurs
        if (state === 'correct' || state === 'incorrect') {
            this._stopHintPulse(`Feedback: ${state}`);
        }

        // Apply new state and set removal timer
        if (state === 'correct') {
            // console.log("[Feedback DBG] Applying correct pattern class."); // Debug
            userContainer.classList.add(correctClass);
            targetContainer?.classList.add(correctClass);

            const correctFlashDuration = INCORRECT_FLASH_DURATION * 0.8; // Slightly shorter?
            this._correctPatternTimeout = setTimeout(() => {
                userContainer.classList.remove(correctClass);
                targetContainer?.classList.remove(correctClass);
                this._correctPatternTimeout = null;
            }, correctFlashDuration);

        } else if (state === 'incorrect') {
            // console.log("[Feedback DBG] Applying incorrect pattern class."); // Debug
            userContainer.classList.add(incorrectClass);
            targetContainer?.classList.add(incorrectClass);

            this._incorrectPatternTimeout = setTimeout(() => {
                userContainer.classList.remove(incorrectClass);
                targetContainer?.classList.remove(incorrectClass);
                this._incorrectPatternTimeout = null;
            }, INCORRECT_FLASH_DURATION);
        }
        // No timer needed for 'default' state
    }


    /**
     * Highlights the character at the current index, updates the target pattern,
     * and manages hint visibility/pulse.
     * @param {number} currentIdx - The index of the character to highlight.
     * @param {string | null} targetChar - The raw character to display hint for (or null if none).
     */
    highlightCharacter(currentIdx, targetChar) {
         // Clear previous 'current' state, preserving 'completed' or 'incorrect'
         this.textDisplay?.querySelectorAll('.char.current').forEach(span => {
             if (span.dataset.index !== String(currentIdx)) {
                 span.classList.remove('current');
                 // Revert to pending only if not completed/incorrect
                  if (!span.classList.contains('completed') && !span.classList.contains('incorrect')) {
                      span.classList.add('pending');
                  }
             }
         });

        // Set the new character state to 'current'
        this.updateCharacterState(currentIdx, 'current');

        // Update the target pattern display using the decoder
        let morseSequence = null;
        if (targetChar !== null && targetChar !== ' ') {
             morseSequence = this.morseDecoder.encodeCharacter(targetChar);
        }
        this.updateTargetPatternDisplay(morseSequence ?? ""); // Use empty string if null/space

        // Reset user input display and pattern feedback
        this.updateUserPatternDisplay("");
        this.setPatternDisplayState('default');

        // Start hint pulse timer only if hint is visible and there's a sequence to show
        if (this.isHintVisible && morseSequence) {
            this._startHintPulseTimer();
        } else {
            this._stopHintPulse("Highlight Character (no pulse condition)");
        }
    }


    // --- Stat Updates (Keep refs, update text if needed, but element is hidden) ---
    updateTimer(elapsedTimeMs) { const totalSeconds = Math.floor(elapsedTimeMs / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const milliseconds = Math.floor((elapsedTimeMs % 1000) / 100); const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds)}`; setTextContent(this.timerDisplay, `Time: ${formattedTime}`); }
    updateWpmDisplay(netWpm) { setTextContent(this.wpmDisplay, `Net WPM: ${netWpm.toFixed(0)}`); }
    updateAccuracyDisplay(accuracy) { setTextContent(this.accuracyDisplay, `Accuracy: ${accuracy.toFixed(1)}%`); }
    updateGrossWpmDisplay(grossWpm) { setTextContent(this.grossWpmDisplay, `Gross WPM: ${grossWpm.toFixed(0)}`); }
    /**
 * Updates both the volume slider position and the speaker icon display.
 * @param {number} volume - The volume level (0.0 to 1.0).
 */
    updateVolumeUI(volume) {
    this.setVolumeSliderValue(volume);
    this.updateSpeakerIcon(volume);
}
    /** Resets stats display text and pattern displays. */
    resetStatsAndPatterns() { this.updateTimer(0); this.updateWpmDisplay(0); this.updateAccuracyDisplay(100); this.updateGrossWpmDisplay(0); this.updateTargetPatternDisplay(""); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._applyHintVisibility(this.isHintVisible, false); }


    // --- Volume UI ---
    /** Sets the initial value of the volume slider. */
    setVolumeSliderValue(volume) { if (this.volumeSlider) this.volumeSlider.value = volume; }
    /** Updates the speaker icon based on volume level. */
    updateSpeakerIcon(volume) {
        const waves = [this.speakerWave1, this.speakerWave2, this.speakerWave3];
        const showWave1 = volume > 0;
        const showWave2 = volume > 0.3;
        const showWave3 = volume > 0.7;
        waves[0]?.style.setProperty('display', showWave1 ? 'inline' : 'none');
        waves[1]?.style.setProperty('display', showWave2 ? 'inline' : 'none');
        waves[2]?.style.setProperty('display', showWave3 ? 'inline' : 'none');
    }

    // --- Hint Visibility & Pulse ---
    /** Sets the desired hint visibility state (internal tracking). */
    setHintVisibility(visible) {
         if (typeof visible === 'boolean' && this.isHintVisible !== visible) {
            this.isHintVisible = visible;
            this._applyHintVisibility(this.isHintVisible); // Apply the change visually
             // Return the new state so caller (SettingsManager) can save it
             return this.isHintVisible;
         }
         return this.isHintVisible; // Return current state if no change
    }

    /** Applies the visual hint visibility state based on internal state. */
    _applyHintVisibility(visible, startPulseIfVisible = true) {
        // console.log(`_applyHintVisibility called: visible=${visible}, startPulse=${startPulseIfVisible}`); // Debug
        if (this.targetPatternOuterWrapper && this.toggleHintButton) {
            this.targetPatternOuterWrapper.classList.toggle('hint-hidden', !visible);
            this.toggleHintButton.setAttribute('aria-pressed', String(visible));

            // Manage hint pulse based on visibility
            if (visible && startPulseIfVisible) {
                 // Check if target pattern has content before starting pulse
                 const hasContent = this.targetPatternContainer?.hasChildNodes();
                 if (hasContent) {
                    this._startHintPulseTimer();
                 } else {
                     this._stopHintPulse("Apply Hint Visibility (Visible, but no content)");
                 }
            } else {
                this._stopHintPulse(`Apply Hint Visibility (Hidden or No Pulse Start)`);
            }
        }
    }

    /** Starts the timer to add the pulsing animation class to hint SVGs. */
    _startHintPulseTimer() {
        this._stopHintPulse("Starting New Pulse Timer"); // Clear existing timer/class
        const svgs = this.targetPatternContainer?.querySelectorAll('svg');
        // Check if hint should be visible and if there are actually SVGs to pulse
        if (!this.isHintVisible || !svgs || svgs.length === 0) {
            // console.log("[Hint Pulse DBG] Condition not met for pulse start."); // Debug
            return;
        }

        const pulseDelayMs = 2000; // Delay before pulsing starts
        // console.log(`[Hint Pulse DBG] Scheduling pulse in ${pulseDelayMs}ms`); // Debug
        this._hintPulseTimer = setTimeout(() => {
            const currentSvgs = this.targetPatternContainer?.querySelectorAll('svg');
            // Check conditions *again* when timer fires (state might have changed)
            if (this.isHintVisible && currentSvgs && currentSvgs.length > 0) {
                // console.log("[Hint Pulse DBG] Timeout fired: Adding .hint-svg-pulse class."); // Debug
                currentSvgs.forEach(svg => svg.classList.add('hint-svg-pulse'));
            } else {
                 // console.log("[Hint Pulse DBG] Timeout fired, but pulse conditions no longer met."); // Debug
            }
            this._hintPulseTimer = null; // Timer has fired
        }, pulseDelayMs);
    }

    /** Clears the hint pulse timer and removes the pulsing animation class from SVGs. */
    _stopHintPulse(reason = "Unknown") {
        let stoppedTimer = false;
        if (this._hintPulseTimer) {
            clearTimeout(this._hintPulseTimer);
            this._hintPulseTimer = null;
            stoppedTimer = true;
        }
        const pulsingSvgs = this.targetPatternContainer?.querySelectorAll('svg.hint-svg-pulse');
        let removedClassCount = 0;
        if (pulsingSvgs && pulsingSvgs.length > 0) {
            pulsingSvgs.forEach(svg => svg.classList.remove('hint-svg-pulse'));
            removedClassCount = pulsingSvgs.length;
        }
        // Optional: Log if something actually happened
        // if (stoppedTimer || removedClassCount > 0) {
        //     console.log(`[Hint Pulse DBG] Stop Pulse. Reason: ${reason}. Timer cleared: ${stoppedTimer}. Classes removed: ${removedClassCount}.`);
        // }
    }
     // --- End Hint Visibility & Pulse ---


    /**
     * Adds event listeners for controls within the game screen.
     * @param {object} callbacks - Callbacks for user interactions.
     * @param {function} callbacks.onVolumeChange - Called when volume slider value changes (on input and change).
     * @param {function} callbacks.onHintToggle - Called when the hint toggle button is clicked.
     * @param {function} callbacks.onShowMainMenu - Called when the menu button is clicked.
     */
    addEventListeners(callbacks) {
         if (!callbacks) {
            console.error("GameScreen: Missing callbacks object for addEventListeners.");
            return;
        }

        // Volume Slider
        if (this.volumeSlider && typeof callbacks.onVolumeChange === 'function') {
             // Update icon and trigger callback on 'input' (while dragging)
             this.volumeSlider.addEventListener('input', (e) => {
                 const newVolume = parseFloat(e.target.value);
                 this.updateSpeakerIcon(newVolume);
                 callbacks.onVolumeChange(newVolume); // Pass value to main controller/settings
             });
             // Optionally trigger callback on 'change' as well (when drag finishes)
             // this.volumeSlider.addEventListener('change', (e) => {
             //     callbacks.onVolumeChange(parseFloat(e.target.value));
             // });
             // Blur on release to prevent keyboard interaction stealing focus
             this.volumeSlider.addEventListener('mouseup', () => this.volumeSlider.blur());
             this.volumeSlider.addEventListener('touchend', () => this.volumeSlider.blur());
         }

         // Hint Toggle Button
         if (this.toggleHintButton && typeof callbacks.onHintToggle === 'function') {
             this.toggleHintButton.addEventListener('click', () => {
                 // Toggle internal state and apply visually
                 const newState = this.setHintVisibility(!this.isHintVisible);
                 callbacks.onHintToggle(newState); // Notify main controller/settings
             });
         }

         // Menu Button
        if (this.menuButton && typeof callbacks.onShowMainMenu === 'function') {
            this.menuButton.addEventListener('click', callbacks.onShowMainMenu);
        }

         // Resize listener for adjusting font size
         let resizeTimeout;
         window.addEventListener('resize', () => {
             clearTimeout(resizeTimeout);
             resizeTimeout = setTimeout(() => {
                 const currentSpan = this.textDisplay?.querySelector('.char.current');
                 this._adjustTextDisplayFontSize();
                 if (currentSpan) {
                     // Recenter after potential font size change
                     this._centerCurrentCharacterHorizontally(currentSpan);
                 }
             }, 150); // Debounce resize handler
         });

        console.log("GameScreen: Event listeners added.");
    }

}

// Example Usage (in main.js or uiManagerFacade.js):
// import { GameScreen } from './views/gameScreen.js';
// import { MorseDecoder } from '../game/morseDecoder.js'; // Need instance
//
// const morseDecoder = new MorseDecoder();
// const gameScreen = new GameScreen(morseDecoder);
// gameScreen.addEventListeners({
//     onVolumeChange: (volume) => { /* update audio player, save setting */ },
//     onHintToggle: (isVisible) => { /* save setting */ },
//     onShowMainMenu: () => { /* navigate to main menu */ }
// });
// gameScreen.renderSentence("HELLO");
// gameScreen.highlightCharacter(0, 'H');
// gameScreen.show();