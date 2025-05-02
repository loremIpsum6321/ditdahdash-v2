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
 *
 * Refactored queue/toneEnd logic (vMay1-Fix):
 * - Single-slot queue (`queuedInput`), no overwrite.
 * - Unconditional processing of queued item on tone end.
 * - Tone end now consistently triggers _processInputStateChange to decide the next action,
 * centralizing state evaluation after audio events.
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
        this.lastInputTypeGenerated = null; // 'dit' or 'dah' of the last *emitted* sound
        this.lastEmitTime = 0; // performance.now() timestamp of last tone *start*
        // --- Use a single variable for the queue (no overwrite) ---
        this.queuedInput = null;
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

        // 2. Game/Sandbox/Endless Input
        const isGameInputContext = (status === GameStatus.READY || status === GameStatus.LISTENING ||
                                     status === GameStatus.TYPING || status === GameStatus.DECODING);

        if (isGameInputContext) {
             // Ensure audio context is ready (might be first interaction)
             this.tonePlayer.audioCtxManager.initializeContext(); // Ensure context is active

             // If decoding was scheduled, cancel it because new input is arriving
             if (status === GameStatus.DECODING || this.decoder.decodeTimeoutId !== null) {
                  // console.log("[DBG] KeyingLogic: Cancelling scheduled decode due to new press.");
                  this.decoder.cancelScheduledDecode();
                  // Only revert to TYPING if there's still a sequence, otherwise LISTENING might be more appropriate
                  this.gameState.status = this.gameState.currentInputSequence ? GameStatus.TYPING : GameStatus.LISTENING;
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
             // Re-evaluate the input state (might stop iambic/repeat or schedule decode)
             // No need for the extra queue check here; _handleToneEnd followed by _processInputStateChange will handle it.
             this._processInputStateChange();
        }
        // No specific action needed on release for results screen
    }

    /** Central logic to determine input mode (gameplay only) and manage timers/state. Called on press/release and after tone end. */
    _processInputStateChange() {
        const status = this.gameState.status;
        // Check if playing game/sandbox/endless
        const isGameInputContext = this.gameState.isPlaying(); // Checks READY, LISTENING, TYPING, DECODING

        // If not in a state where keying matters, clear timers and state
        if (!isGameInputContext && status !== GameStatus.READY) { // Allow processing if starting from READY
           this._clearRepeatOrIambicTimer();
           this.lastEmitTime = 0;
           this.queuedInput = null; // Clear queue
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
                 // console.log(`[DBG] KeyingLogic: Starting Iambic B, initial element: ${this.gameState.iambicState}`);
            }
            this._triggerRepeatOrIambicOutput(); // Start/continue iambic output

        } else if (isDitActive) {
            // --- Dit Only Mode ---
            if (this.gameState.isIambicHandling) { // If switching from iambic
                 this.gameState.iambicState = 'dit'; // Set next element to dit
                 // console.log(`[DBG] KeyingLogic: Switching from Iambic to Dit only.`);
            } else if (this.gameState.iambicState === null) { // If first press or after pause
                 this.gameState.iambicState = 'dit';
            }
            this.gameState.isIambicHandling = false;
            this._triggerRepeatOrIambicOutput(); // Start/continue dit output

        } else if (isDahActive) {
             // --- Dah Only Mode ---
             if (this.gameState.isIambicHandling) { // If switching from iambic
                 this.gameState.iambicState = 'dah';
                 // console.log(`[DBG] KeyingLogic: Switching from Iambic to Dah only.`);
             } else if (this.gameState.iambicState === null) { // If first press or after pause
                 this.gameState.iambicState = 'dah';
             }
             this.gameState.isIambicHandling = false;
             this._triggerRepeatOrIambicOutput(); // Start/continue dah output

        } else {
             // --- No Keys Active ---
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null; // Clear iambic state

             // Conditions to check if decoding should be scheduled:
             // 1. Must have an input sequence.
             // 2. Must be in a state where input was expected (LISTENING or TYPING). DECODING is handled separately.
             // 3. Audio player must be free.
             // 4. Input queue must be empty.
             // 5. No active decode timer already running.
             const canScheduleDecode = this.gameState.currentInputSequence &&
                                     (status === GameStatus.TYPING || status === GameStatus.LISTENING) &&
                                     this.tonePlayer.inputToneNode === null &&
                                     this.queuedInput === null &&
                                     this.decoder.decodeTimeoutId === null; // Added check for existing timer

             if (canScheduleDecode) {
                 // console.log("[DBG] KeyingLogic: No keys active, conditions met, scheduling decode.");
                 this._scheduleDecodeAfterDelay();
             }
             // If state was TYPING but sequence is now empty (cleared by decode/moveNext), revert to LISTENING
             else if (status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             // If keys are inactive, but we can't schedule decode yet (e.g., audio busy),
             // ensure state reflects waiting/listening if appropriate.
             else if (!canScheduleDecode && status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                 // Still waiting for audio/queue to clear, remain TYPING is likely okay
                 // Or switch back to LISTENING? Let's keep TYPING for now.
             }
             // Ensure listening state if game active and nothing else applies
             else if (this.gameState.isPlaying() && status !== GameStatus.LISTENING) {
                  // Avoid flapping between states if conditions aren't met yet.
                  // If sequence exists but can't decode, TYPING is okay.
                  // If no sequence, LISTENING is correct.
                  if (!this.gameState.currentInputSequence) {
                    this.gameState.status = GameStatus.LISTENING;
                  }
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
        // This function's core logic for timing and scheduling the *next* check remains the same
        // to preserve the input feel.

        this._clearRepeatOrIambicTimer(); // Clear previous timer if any

        const elementToSend = this.gameState.iambicState; // 'dit' or 'dah' to send *now*

        // Exit if not in a valid game state or no element determined yet
        if (!this.gameState.isPlaying() || !elementToSend) {
            this.lastEmitTime = 0; // Reset timing if state invalid
            // No, don't clear iambicState here - _processInputStateChange manages it
            // this.gameState.iambicState = null;
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
            // If keys released don't match mode, re-evaluate state immediately rather than proceeding
             // console.log(`[DBG] KeyingLogic: Key release detected during trigger, mode no longer valid. Re-evaluating.`);
             // Use setTimeout to allow current execution stack to clear before re-evaluating
             // This prevents potential infinite loops if state flips rapidly.
             setTimeout(() => this._processInputStateChange(), 0);
             return;
        }


        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        // Duration of the *previous* element + the gap needed *after* it
        const lastElementDurationMs = (this.lastInputTypeGenerated === 'dit' ? this.ditDurationMs : (this.lastInputTypeGenerated === 'dah' ? this.dahDurationMs : 0));
        // Require gap only if there *was* a previous element emitted by this logic
        const requiredTimeMs = (this.lastEmitTime > 0) ? (lastElementDurationMs + this.intraCharGapMs) : 0;

        // Check timing: Has enough time passed since the *start* of the last element + intra-element gap?
        // Allow immediate emission if lastEmitTime is 0 (first element).
        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            // Not enough time passed, schedule check slightly later
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            // console.log(`[DBG] KeyingLogic: Waiting ${remainingTimeMs.toFixed(0)}ms for intra-char gap.`);
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        // Check audio queue: Is the tone player busy?
        if (this.tonePlayer.inputToneNode !== null) {
             // --- Queue the input (Single Slot, No Overwrite) ---
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
                 // console.log(`[DBG] KeyingLogic: Audio busy, queued: ${elementToSend}`);
             } else {
                 // console.log(`[DBG] KeyingLogic: Audio busy, queue full. Ignored: ${elementToSend}`);
             }
             // Even if queued, we might need to schedule the *next* check if keys are still held
             // Let _handleToneEnd -> _processInputStateChange handle this scheduling. Return here.
             return;
        }

        // --- Conditions met: Emit the element ---
        // console.log(`[DBG] Emitting: ${elementToSend}`)
        this._emitInputToSequence(elementToSend);
        this.tonePlayer.playInputTone(elementToSend); // Play the sound
        this.lastInputTypeGenerated = elementToSend; // Remember what was just sent
        this.lastEmitTime = performance.now(); // Record time tone *started*

        // Determine the next element for Iambic mode
        if (this.gameState.isIambicHandling) {
            this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit'; // Alternate
            // console.log(`[DBG] KeyingLogic: Iambic B - Next element will be ${this.gameState.iambicState}`);
        }
        // In single key mode, iambicState remains the same (e.g., 'dit' or 'dah')

        // Schedule the next potential output check after this element's duration + gap
        const currentElementDurationMs = (elementToSend === 'dit' ? this.ditDurationMs : this.dahDurationMs);
        const delayForNextMs = currentElementDurationMs + this.intraCharGapMs;

        // Check *again* if keys are *still* held to decide if we schedule the next cycle
        // Use the potentially updated iambicState if we are in iambic mode
        const nextElementToCheck = this.gameState.iambicState || elementToSend; // Use current if iambicState became null somehow
        const checkDitActive = this.ditActive;
        const checkDahActive = this.dahActive;
         const shouldScheduleNext =
             (this.gameState.isIambicHandling && checkDitActive && checkDahActive) ||
             (!this.gameState.isIambicHandling && nextElementToCheck === 'dit' && checkDitActive) ||
             (!this.gameState.isIambicHandling && nextElementToCheck === 'dah' && checkDahActive);

        if (shouldScheduleNext) {
            // console.log(`[DBG] KeyingLogic: Scheduling next output check in ${delayForNextMs.toFixed(0)}ms`);
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
        } else {
             // If keys were released during this function's execution, ensure state is re-evaluated
             // This might happen if release occurs between the emit and this check.
             // _processInputStateChange will handle scheduling decode if appropriate.
             // console.log("[DBG] KeyingLogic: Keys released during processing, scheduling state re-evaluation after emit.");
             // Use setTimeout to allow current execution stack to clear.
             setTimeout(() => this._processInputStateChange(), 0);
        }
    }

    /** Callback function triggered by TonePlayer when an input tone finishes playing naturally. */
    _handleToneEnd() {
        // console.log("[DBG] KeyingLogic: Tone end callback received.");
        let processedQueueItem = false;

        // --- Process Queued Item (Unconditionally, as per original requirement) ---
        // If an item was queued because audio was busy, process it now
        if (this.queuedInput !== null) {
            const typeToProcess = this.queuedInput;
            this.queuedInput = null; // Clear queue *before* processing
            // console.log(`[DBG] KeyingLogic: Processing queued input: ${typeToProcess}`);

            // --- Play the dequeued item ---
            this._emitInputToSequence(typeToProcess);
            this.tonePlayer.playInputTone(typeToProcess); // This will trigger _handleToneEnd again when *it* finishes

            // Update tracking info for the element *just played* from the queue
            this.lastInputTypeGenerated = typeToProcess;
            this.lastEmitTime = performance.now();
            processedQueueItem = true;

            // Update game state if needed (e.g., if queue processing started input)
             if (this.gameState.status === GameStatus.LISTENING || this.gameState.status === GameStatus.READY) {
                 this.gameState.status = GameStatus.TYPING;
             }

             // IMPORTANT: Since playing the queued item starts a new tone, which will trigger
             // _handleToneEnd again, we stop processing here. The *next* _handleToneEnd call
             // (after the queued tone finishes) will trigger the state evaluation.
             return;
        }

        // --- Re-evaluate State After Tone Finishes (and queue was empty or just processed) ---
        // Use setTimeout to defer the state check slightly, ensuring the call stack clears
        // and allows any synchronous release events to be processed first.
        // console.log("[DBG] KeyingLogic: Tone ended (no queue processed or queue item just started), scheduling state check.");
        setTimeout(() => {
            // Let _processInputStateChange decide the next action based on the current key state
            // and other conditions (like whether decoding should now occur).
            this._processInputStateChange();
        }, 0); // Using 0ms delay allows yielding to the event loop quickly.
    }


    /** Schedules the character decode function after the inter-character gap timeout. */
     _scheduleDecodeAfterDelay() {
         // console.log(`[DBG] KeyingLogic: Attempting to schedule decode for sequence: '${this.gameState.currentInputSequence}'`);
         this.decoder.cancelScheduledDecode(); // Clear any previous decode timer (safe to call if null)
         if (this.gameState.characterTimeoutId) this.gameState.clearCharacterTimeout(); // Clear game state ref too

         // Check if we are in a state where decoding makes sense *now*
         // These checks are crucial to prevent scheduling when not appropriate.
         const canSchedule = (
             this.gameState.currentInputSequence && // Must have a sequence to decode
             (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.LISTENING) &&
             !this.ditActive && !this.dahActive && // No keys currently pressed
             this.tonePlayer.inputToneNode === null && // Audio player is free
             this.queuedInput === null // Queue is also empty
         );

         if (!canSchedule) {
              // console.log(`[DBG] KeyingLogic: Decode scheduling skipped. Status: ${this.gameState.status}, Sequence: '${this.gameState.currentInputSequence}', Keys Active: ${this.ditActive || this.dahActive}, Audio Busy: ${!!this.tonePlayer.inputToneNode}, Queue: ${this.queuedInput}`);
              // If we were TYPING but sequence is now empty (maybe cleared elsewhere?), go back to listening
              if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                   this.gameState.status = GameStatus.LISTENING;
              }
              // If conditions aren't met, _processInputStateChange might handle reverting state later if needed.
              return;
         }

         // console.log(`[DBG] KeyingLogic: Scheduling decode for sequence: '${this.gameState.currentInputSequence}' with appropriate delay.`);
         this.gameState.status = GameStatus.DECODING; // Set state

         // Ask the decoder to schedule the callback
         const timeoutId = this.decoder.scheduleDecode(() => {
             // This callback executes after the timeout defined in MorseDecoder
             // Check game state *again* when callback fires, as it might have changed
             // (e.g., user started typing again)
             if (this.gameState.status === GameStatus.DECODING) {
                 // console.log(`[DBG] KeyingLogic: Decode timeout fired. Calling onCharacterDecode for: '${this.gameState.currentInputSequence}'`);
                 this.callbacks.onCharacterDecode(); // Trigger character validation in main logic
             } else {
                  // console.log(`[DBG] KeyingLogic: Decode callback executed, but status is now ${this.gameState.status}. Ignoring decode attempt.`);
                  // If status changed away from DECODING, ensure state is reasonable (e.g., LISTENING)
                  // _processInputStateChange should handle this if keys were pressed/released,
                  // but as a fallback, ensure we aren't stuck.
                  if (this.gameState.isPlaying() && !this.ditActive && !this.dahActive && !this.gameState.currentInputSequence) {
                       this.gameState.status = GameStatus.LISTENING;
                  }
             }
             // Reset iambic state after decode attempt regardless of outcome
             // These should already be null if no keys are pressed, but doesn't hurt to ensure.
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
         });

         if (timeoutId) {
              this.gameState.setCharacterTimeout(timeoutId); // Keep gameState aware of the timer
         } else {
            // If decoder didn't return a timeoutId (e.g., delay was 0),
            // immediately revert state if decode didn't happen synchronously
            if(this.gameState.status === GameStatus.DECODING) {
                // This case is less likely with standard Morse timing but handles potential edge case.
                this.gameState.status = GameStatus.LISTENING;
            }
         }
     }

    /** Clears the single iambic/repeat generation timer. */
    _clearRepeatOrIambicTimer() {
        if (this.repeatOrIambicTimerId) {
            clearTimeout(this.repeatOrIambicTimerId);
            this.repeatOrIambicTimerId = null;
            // console.log("[DBG] KeyingLogic: Cleared repeat/iambic timer.");
        }
    }
}