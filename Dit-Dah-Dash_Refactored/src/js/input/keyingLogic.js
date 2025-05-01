// Dit-Dah-Dash_Refactored/src/js/input/keyingLogic.js

import { GameStatus } from '../core/appStatus.js';
import { DEFAULT_WPM, DIT_DURATION_UNITS, DAH_DURATION_UNITS, INTRA_CHARACTER_GAP_UNITS } from '../core/configConstants.js';

/**
 * js/input/keyingLogic.js
 * -----------------------
 * Handles the logic for interpreting raw inputs as Morse code elements.
 * Implements timing, auto-repeat, Iambic B keying, triggers audio tones,
 * manages game state transitions related to input, and schedules decoding.
 * Relies on GameState, MorseDecoder, and TonePlayer.
 */

export class KeyingLogic {
    /**
     * @param {GameState} gameState - The shared game state instance.
     * @param {MorseDecoder} decoder - The Morse decoder instance.
     * @param {TonePlayer} tonePlayer - The audio tone player instance.
     * @param {object} callbacks - Callbacks for external interactions.
     * @param {function} callbacks.onInputStart - Called when the first input starts the timer.
     * @param {function} callbacks.onCharacterDecode - Called to initiate character validation.
     * @param {function} callbacks.onUpdateUserPattern - Called to update the user pattern UI. Passes the current sequence string.
     * @param {function} callbacks.onResultsInput - Callback for dit/dah on results screen.
     */
    constructor(gameState, decoder, tonePlayer, callbacks) {
        if (!gameState || !decoder || !tonePlayer || !callbacks ||
            typeof callbacks.onInputStart !== 'function' ||
            typeof callbacks.onCharacterDecode !== 'function' ||
            typeof callbacks.onUpdateUserPattern !== 'function' ||
            typeof callbacks.onResultsInput !== 'function') {
            throw new Error("KeyingLogic requires gameState, decoder, tonePlayer, and specific callbacks (onInputStart, onCharacterDecode, onUpdateUserPattern, onResultsInput).");
        }
        this.gameState = gameState;
        this.decoder = decoder;
        this.tonePlayer = tonePlayer;
        this.callbacks = callbacks;

        // Input State (mirroring raw state from InputHandler for logic)
        this.ditActive = false;
        this.dahActive = false;

        // Timing (calculated from WPM)
        this.wpm = DEFAULT_WPM;
        this.ditDurationMs = 0;
        this.dahDurationMs = 0;
        this.intraCharGapMs = 0; // Gap needed *after* an element before next can start

        // Internal State for timing and queueing
        this.pressStartTime = { dit: 0, dah: 0 }; // Track initial press time for iambic start logic
        this.lastInputTypeGenerated = null; // 'dit' or 'dah'
        this.lastEmitTime = 0; // performance.now() timestamp of last tone *start*
        this.queuedInput = null; // 'dit' or 'dah' if audio is busy
        this.repeatOrIambicTimerId = null; // Timer for next element generation

        this._calculateTimings(this.wpm); // Initial calculation

        // Set the callback for when the tone player finishes a tone
        this.tonePlayer.setOnToneEndCallback(this._handleToneEnd.bind(this));

        console.log("KeyingLogic Initialized.");
    }

    /** Calculate timing values in milliseconds based on WPM. */
    _calculateTimings(wpm) {
        if (wpm > 0) {
             const ditMs = 1200 / wpm;
             this.ditDurationMs = ditMs;
             this.dahDurationMs = ditMs * DAH_DURATION_UNITS;
             this.intraCharGapMs = ditMs * INTRA_CHARACTER_GAP_UNITS;
             // Also update dependent modules
             this.decoder.updateWpm(wpm);
             this.tonePlayer.updateWpm(wpm);
             this.wpm = wpm;
             // console.log(`KeyingLogic timings (WPM=${wpm}): Dit=${this.ditDurationMs.toFixed(0)}ms, Dah=${this.dahDurationMs.toFixed(0)}ms, IntraGap=${this.intraCharGapMs.toFixed(0)}ms`);
        }
    }

    /** Update WPM and recalculate timings. */
    updateWpm(newWpm) {
        if (this.wpm !== newWpm && newWpm > 0) {
            this._calculateTimings(newWpm);
        }
    }

    /** Handles press events forwarded from InputHandler. */
    handlePress(type, method) { // method ('key', 'mouse', 'touch') currently unused here but passed along
        const now = performance.now();
        let stateChanged = false;

        // Update internal active state
        if (type === 'dit' && !this.ditActive) {
            this.ditActive = true;
            this.pressStartTime.dit = now; // Record start time for iambic logic
            stateChanged = true;
        } else if (type === 'dah' && !this.dahActive) {
            this.dahActive = true;
            this.pressStartTime.dah = now;
            stateChanged = true;
        }

        // Only proceed if state actually changed to pressed
        if (!stateChanged) return;

        // --- Context-specific Actions ---
        const status = this.gameState.status;

        // 1. Results Screen Input
        if (status === GameStatus.SHOWING_RESULTS) {
            // console.log(`KeyingLogic: Results Action Triggered by: ${type}`);
            this.tonePlayer.playInputTone(type); // Play feedback tone
            this.callbacks.onResultsInput(type); // Trigger results action callback
            return; // Stop further processing for results screen
        }

        // 2. Game/Sandbox Input
        const isGameInputContext = (status === GameStatus.READY || status === GameStatus.LISTENING ||
                                    status === GameStatus.TYPING || status === GameStatus.DECODING);

        if (isGameInputContext) {
             // Ensure audio context is ready (might be first interaction)
             this.tonePlayer.audioCtxManager.initializeContext(); // Ensure context is active

            // If decoding was scheduled, cancel it because new input is arriving
            if (status === GameStatus.DECODING || this.decoder.decodeTimeoutId !== null) {
                 // console.log("KeyingLogic: Cancelling scheduled decode due to new press."); // Debug
                 this.decoder.cancelScheduledDecode();
                 this.gameState.status = GameStatus.TYPING; // Revert to typing state
                 if (this.gameState.characterTimeoutId) this.gameState.clearCharacterTimeout(); // Clear state's ref too
             }

             // Process the new input state (handles iambic, auto-repeat, tone queueing)
             this._processInputStateChange();
        }
    }

    /** Handles release events forwarded from InputHandler. */
    handleRelease(type, method) { // method currently unused
        let stateChanged = false;

        // Update internal active state
        if (type === 'dit' && this.ditActive) {
            this.ditActive = false;
            stateChanged = true;
        } else if (type === 'dah' && this.dahActive) {
            this.dahActive = false;
            stateChanged = true;
        }

        // Only proceed if state actually changed to released
        if (!stateChanged) return;

        // --- Context-specific Actions ---
        const status = this.gameState.status;
        const isGameInputContext = (status === GameStatus.READY || status === GameStatus.LISTENING ||
                                    status === GameStatus.TYPING || status === GameStatus.DECODING);

        if (isGameInputContext) {
             // If a tone just finished playing and something was queued, the release might allow processing
             // Check if queue has items and audio is now free
             if (this.queuedInput !== null && this.tonePlayer.inputToneNode === null) {
                 // console.log("KeyingLogic: Release detected queue processing opportunity."); // Debug
                 this._handleToneEnd(); // Try processing queue
             }

            // Re-evaluate the input state (might stop iambic/repeat or schedule decode)
            this._processInputStateChange();
        }
        // No specific action needed on release for results screen
    }

    /** Central logic to determine input mode (gameplay/sandbox only) and manage timers/state. */
    _processInputStateChange() {
        const status = this.gameState.status;
        const isGameInputContext = (status === GameStatus.READY || status === GameStatus.LISTENING ||
                                    status === GameStatus.TYPING || status === GameStatus.DECODING);

        // If not in a state where keying matters, clear timers and state
        if (!isGameInputContext) {
           this._clearRepeatOrIambicTimer();
           this.lastEmitTime = 0;
           this.queuedInput = null;
           this.gameState.isIambicHandling = false;
           this.gameState.iambicState = null;
           return;
        }

        const isDitActive = this.ditActive;
        const isDahActive = this.dahActive;

        this._clearRepeatOrIambicTimer(); // Always clear timer before evaluating state

        // If starting first input during READY state
        if (status === GameStatus.READY && (isDitActive || isDahActive)) {
             if (this.gameState.startTimer()) { // Sets status to LISTENING
                this.callbacks.onInputStart(); // Notify main logic to start UI timer etc.
             }
             // Immediately transition to typing on first press
             this.gameState.status = GameStatus.TYPING;
        }

        // Determine Iambic state or single key press
        if (isDitActive && isDahActive) {
            // --- Iambic Mode ---
            this.gameState.isIambicHandling = true;
            // Set initial iambic element based on which key was pressed first *if* state is new
            if (this.gameState.iambicState === null) {
                 this.gameState.iambicState = (this.pressStartTime.dah > this.pressStartTime.dit) ? 'dah' : 'dit';
                 // console.log(`KeyingLogic: Starting Iambic B, initial element: ${this.gameState.iambicState}`); // Debug
            }
            this._triggerRepeatOrIambicOutput(); // Start/continue iambic output

        } else if (isDitActive) {
            // --- Dit Only Mode ---
            if (this.gameState.isIambicHandling) { // If switching from iambic
                this.gameState.iambicState = 'dit'; // Set next element to dit
                 // console.log(`KeyingLogic: Switching from Iambic to Dit only.`); // Debug
            } else if (this.gameState.iambicState === null) { // If first press or after pause
                this.gameState.iambicState = 'dit';
            }
            this.gameState.isIambicHandling = false;
            this._triggerRepeatOrIambicOutput(); // Start/continue dit output

        } else if (isDahActive) {
             // --- Dah Only Mode ---
             if (this.gameState.isIambicHandling) { // If switching from iambic
                 this.gameState.iambicState = 'dah';
                 // console.log(`KeyingLogic: Switching from Iambic to Dah only.`); // Debug
             } else if (this.gameState.iambicState === null) { // If first press or after pause
                 this.gameState.iambicState = 'dah';
             }
             this.gameState.isIambicHandling = false;
            this._triggerRepeatOrIambicOutput(); // Start/continue dah output

        } else {
             // --- No Keys Active ---
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null; // Clear iambic state
             // If user just finished typing a sequence and audio is free, schedule decode
             if (this.gameState.currentInputSequence &&
                 (status === GameStatus.TYPING || status === GameStatus.LISTENING) && // Allow scheduling from LISTENING if sequence exists somehow
                 this.queuedInput === null && this.tonePlayer.inputToneNode === null)
             {
                 // console.log("KeyingLogic: No keys active, scheduling decode."); // Debug
                 this._scheduleDecodeAfterDelay();
             }
             // If state was TYPING but sequence is now empty (cleared by decode/moveNext), revert to LISTENING
             else if (status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
        }
    }

    /** Adds the Morse element to the game state sequence and triggers UI update. */
    _emitInputToSequence(type) {
        const morseChar = (type === 'dit') ? '.' : '-';
        this.gameState.addInput(morseChar); // Update game state
        this.callbacks.onUpdateUserPattern(this.gameState.currentInputSequence); // Update UI
        return morseChar;
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence if conditions met. */
    _triggerRepeatOrIambicOutput() {
        this._clearRepeatOrIambicTimer(); // Clear previous timer

        const elementToSend = this.gameState.iambicState; // 'dit' or 'dah' to send *now*

        // Exit if not in a valid game state or no element determined yet
        if (!this.gameState.isPlaying() || !elementToSend) {
            this.lastEmitTime = 0; // Reset timing if state invalid
            this.gameState.iambicState = null; // Clear state if invalid
            return;
        }

        // Double-check if the required key(s) are still active for the current mode
        const isDitActive = this.ditActive;
        const isDahActive = this.dahActive;
        const shouldContinueCurrentMode =
            (this.gameState.isIambicHandling && isDitActive && isDahActive) || // Both needed for iambic
            (!this.gameState.isIambicHandling && elementToSend === 'dit' && isDitActive) || // Dit needed for dit-only
            (!this.gameState.isIambicHandling && elementToSend === 'dah' && isDahActive); // Dah needed for dah-only

        if (!shouldContinueCurrentMode) {
            // If keys released don't match mode, re-evaluate state immediately
            // console.log(`KeyingLogic: Key release detected, mode ${this.gameState.isIambicHandling ? 'Iambic' : 'Single'} no longer valid. Re-evaluating.`); // Debug
            this._processInputStateChange();
            return;
        }


        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        // Duration of the *previous* element + the gap needed *after* it
        const lastElementDurationMs = (this.lastInputTypeGenerated === 'dit' ? this.ditDurationMs : (this.lastInputTypeGenerated === 'dah' ? this.dahDurationMs : 0));
        const requiredTimeMs = lastElementDurationMs + this.intraCharGapMs;

        // Check timing: Has enough time passed since the *start* of the last element + intra-element gap?
        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            // Not enough time passed, schedule check slightly later
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            // console.log(`KeyingLogic: Waiting ${remainingTimeMs.toFixed(0)}ms for intra-char gap.`); // Debug
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        // Check audio queue: Is the tone player busy?
        if (this.tonePlayer.inputToneNode !== null) {
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend; // Queue the element
                 // console.log(`KeyingLogic: Audio busy, queued: ${elementToSend}`); // Debug
             } // else: Queue is full, drop the input for now (or maybe overwrite?) Current logic: drop.
               // else { console.log(`KeyingLogic: Audio busy, queue full. Dropped: ${elementToSend}`); } // Debug
             return; // Don't proceed if audio busy
         }

        // --- Conditions met: Emit the element ---
        this._emitInputToSequence(elementToSend);
        this.tonePlayer.playInputTone(elementToSend); // Play the sound
        this.lastInputTypeGenerated = elementToSend; // Remember what was just sent
        this.lastEmitTime = performance.now(); // Record time tone *started*

        // Determine the next element for Iambic mode
        if (this.gameState.isIambicHandling) {
            this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit'; // Alternate
            // console.log(`KeyingLogic: Iambic B - Next element will be ${this.gameState.iambicState}`); // Debug
        }
        // In single key mode, iambicState remains the same (e.g., 'dit' or 'dah')

        // Schedule the next potential output after this element's duration + gap
        const currentElementDurationMs = (elementToSend === 'dit' ? this.ditDurationMs : this.dahDurationMs);
        const delayForNextMs = currentElementDurationMs + this.intraCharGapMs;

        // Check *again* if keys are *still* held to decide if we schedule the next cycle
        const checkDitActive = this.ditActive;
        const checkDahActive = this.dahActive;
         const shouldScheduleNext =
               (this.gameState.isIambicHandling && checkDitActive && checkDahActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dit' && checkDitActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dah' && checkDahActive);

        if (shouldScheduleNext) {
            // console.log(`KeyingLogic: Scheduling next output check in ${delayForNextMs.toFixed(0)}ms`); // Debug
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
        } else {
             // If keys were released during this function's execution, re-evaluate state
             // console.log("KeyingLogic: Keys released during processing, re-evaluating state after emit."); // Debug
             this._processInputStateChange();
        }
    }

    /** Callback function triggered by TonePlayer when an input tone finishes playing naturally. */
    _handleToneEnd() {
         // console.log("KeyingLogic: Tone end callback received."); // Debug
         let processedQueueItem = false;

         // If an item was queued because audio was busy, process it now
         if (this.queuedInput !== null) {
             const typeToProcess = this.queuedInput;
             this.queuedInput = null; // Clear queue *before* processing
             // console.log(`KeyingLogic: Processing queued input: ${typeToProcess}`); // Debug

             // Check if the key for the queued item is still pressed
             const isDitStillActive = this.ditActive;
             const isDahStillActive = this.dahActive;
             const shouldPlayQueued = (typeToProcess === 'dit' && isDitStillActive) ||
                                      (typeToProcess === 'dah' && isDahStillActive);

             if (shouldPlayQueued) {
                this._emitInputToSequence(typeToProcess);
                this.tonePlayer.playInputTone(typeToProcess); // Play the queued tone
                processedQueueItem = true;
                this.lastInputTypeGenerated = typeToProcess;
                this.lastEmitTime = performance.now();

                // Ensure game state is typing if we just played something
                 if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                     this.gameState.status = GameStatus.TYPING;
                 }

             } else {
                 // console.log(`KeyingLogic: Key for queued input '${typeToProcess}' released before playing. Discarding.`); // Debug
             }
         }

         // ---- MODIFICATION START ----
         // Execute the state check logic immediately instead of using setTimeout
         const checkStateAfterToneEnd = () => {
             const isDitActive = this.ditActive;
             const isDahActive = this.dahActive;

             // If keys are still active, continue the repeat/iambic cycle
             if (isDitActive || isDahActive) {
                  // console.log("KeyingLogic: Tone ended, keys still active. Triggering state check."); // Debug
                  this._processInputStateChange(); // This will schedule the next element if needed
             }
             // If no keys active AND nothing was just played from queue, and sequence exists, schedule decode
             else if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                  // console.log("KeyingLogic: Tone ended, no keys active, no queue processed. Scheduling decode."); // Debug
                  this._scheduleDecodeAfterDelay();
             }
             // If no keys active and sequence is empty, revert to listening
             else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             // If something *was* played from queue, even if keys are now released, schedule decode
             else if (processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                 // console.log("KeyingLogic: Tone ended, queue processed. Scheduling decode."); // Debug
                 this._scheduleDecodeAfterDelay();
             }
         };

         checkStateAfterToneEnd();
         // ---- MODIFICATION END ----

         /* ---- OLD CODE using setTimeout ----
         // Use setTimeout to defer state check slightly, allowing release events to potentially register first
         setTimeout(() => {
             const isDitActive = this.ditActive;
             const isDahActive = this.dahActive;

             // If keys are still active, continue the repeat/iambic cycle
             if (isDitActive || isDahActive) {
                  // console.log("KeyingLogic: Tone ended, keys still active. Triggering state check."); // Debug
                  this._processInputStateChange(); // This will schedule the next element if needed
             }
             // If no keys active AND nothing was just played from queue, and sequence exists, schedule decode
             else if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                  // console.log("KeyingLogic: Tone ended, no keys active, no queue processed. Scheduling decode."); // Debug
                  this._scheduleDecodeAfterDelay();
             }
             // If no keys active and sequence is empty, revert to listening
             else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             // If something *was* played from queue, even if keys are now released, schedule decode
             else if (processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                 // console.log("KeyingLogic: Tone ended, queue processed. Scheduling decode."); // Debug
                 this._scheduleDecodeAfterDelay();
             }
         }, 1); // Minimal delay (Matches old code)
         */
     }


    /** Schedules the character decode function after the inter-character gap timeout. */
     _scheduleDecodeAfterDelay() {
        this.decoder.cancelScheduledDecode(); // Clear any previous decode timer

         // Check if we are in a state where decoding makes sense
         const canSchedule = (
             this.gameState.currentInputSequence && // Must have a sequence to decode
             (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.LISTENING) &&
             !this.ditActive && !this.dahActive && // No keys currently pressed
             this.tonePlayer.inputToneNode === null // Audio player is free
         );

         if (!canSchedule) {
              // console.log(`KeyingLogic: Decode scheduling skipped. Status: ${this.gameState.status}, Sequence: '${this.gameState.currentInputSequence}', Keys Active: ${this.ditActive || this.dahActive}, Audio Busy: ${!!this.tonePlayer.inputToneNode}`); // Debug
             // If we were typing but sequence is now empty, go back to listening
             if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             return;
         }

         // console.log(`KeyingLogic: Scheduling decode for sequence: '${this.gameState.currentInputSequence}'`); // Debug
         this.gameState.status = GameStatus.DECODING; // Set state

         // Ask the decoder to schedule the callback
         const timeoutId = this.decoder.scheduleDecode(() => {
             // This callback executes after the timeout defined in MorseDecoder
             // Check game state *again* when callback fires, as it might have changed
             if (this.gameState.status === GameStatus.DECODING) {
                 this.callbacks.onCharacterDecode(); // Trigger character validation in main logic
             } else {
                  // console.log(`KeyingLogic: Decode callback executed, but status is now ${this.gameState.status}. Ignoring decode attempt.`); // Debug
                 // If status changed away from DECODING, ensure state is reasonable (e.g., LISTENING)
                 if(this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                      // Revert to listening if not finished/showing results
                       this.gameState.status = GameStatus.LISTENING;
                 }
             }
             // Reset iambic state after decode attempt regardless of outcome
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
         });

         // Store the timeout ID in gameState for potential cancellation by other parts? (Optional)
         // Currently decoder handles cancellation internally.
         if (timeoutId) {
             this.gameState.setCharacterTimeout(timeoutId); // Keep gameState aware of the timer
         }
     }

    /** Clears the single iambic/repeat generation timer. */
    _clearRepeatOrIambicTimer() {
        if (this.repeatOrIambicTimerId) {
            clearTimeout(this.repeatOrIambicTimerId);
            this.repeatOrIambicTimerId = null;
            // console.log("KeyingLogic: Cleared repeat/iambic timer."); // Debug
        }
    }
}