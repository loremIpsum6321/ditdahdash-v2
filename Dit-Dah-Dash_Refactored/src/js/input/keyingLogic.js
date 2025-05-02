/* Dit-Dah-Dash_Refactored/src/js/input/keyingLogic.js */

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
 * - Removed setTimeout(0) in _handleToneEnd for more direct state processing.
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
        this.wpm = 0; // Initialize differently to ensure first update runs
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

        this._calculateTimings(DEFAULT_WPM); // Initial calculation

        // Set the callback for when the tone player finishes a tone
        this.tonePlayer.setOnToneEndCallback(this._handleToneEnd.bind(this));

        console.log("KeyingLogic Initialized.");
    }

    /** Calculate timing values in milliseconds based on WPM. */
    _calculateTimings(wpm) {
        // Validate WPM input here as well for safety
        let validWpm = wpm;
        if (typeof wpm !== 'number' || isNaN(wpm) || wpm <= 0) {
            console.warn(`KeyingLogic: Invalid WPM value received: ${wpm}. Using current or default.`);
            validWpm = this.wpm > 0 ? this.wpm : DEFAULT_WPM; // Use current valid or default
        }

        // Only recalculate if WPM actually changes
        if (this.wpm === validWpm) return;
        this.wpm = validWpm;

        const ditMs = 1200 / this.wpm;
        this.ditDurationMs = ditMs;
        this.dahDurationMs = ditMs * DAH_DURATION_UNITS;
        this.intraCharGapMs = ditMs * INTRA_CHARACTER_GAP_UNITS;
        // Also update dependent modules
        this.decoder.updateWpm(this.wpm); // Let decoder handle its own validation
        this.tonePlayer.updateWpm(this.wpm);

        console.log(`[DEBUG KeyingLogic _calculateTimings] Timings updated (WPM=${this.wpm}): Dit=${this.ditDurationMs.toFixed(0)}ms, Dah=${this.dahDurationMs.toFixed(0)}ms, IntraGap=${this.intraCharGapMs.toFixed(0)}ms`); // Added log
    }


    /** Update WPM and recalculate timings. */
    updateWpm(newWpm) {
        console.log(`[DEBUG KeyingLogic updateWpm] Received new WPM: ${newWpm}`); // Added log
        // Pass validation to _calculateTimings
        this._calculateTimings(newWpm);
    }

    /** Handles press events forwarded from InputHandler. */
    handlePress(type, method) { // method ('key', 'mouse', 'touch') currently unused here but passed along
        console.log(`[DEBUG KeyingLogic handlePress] Type: ${type}, Method: ${method}. Current Status: ${this.gameState.status}`); // Added log
        const now = performance.now();
        let stateChanged = false;

        // Update internal active state
        if (type === 'dit' && !this.ditActive) {
            this.ditActive = true;
            this.pressStartTime.dit = now; // Record start time for iambic logic
            stateChanged = true;
            console.log(`[DEBUG KeyingLogic handlePress] Dit ACTIVATED. Start time: ${now}`); // Added log
        } else if (type === 'dah' && !this.dahActive) {
            this.dahActive = true;
            this.pressStartTime.dah = now;
            stateChanged = true;
             console.log(`[DEBUG KeyingLogic handlePress] Dah ACTIVATED. Start time: ${now}`); // Added log
        }

        // Only proceed if state actually changed to pressed
        if (!stateChanged) {
             console.log(`[DEBUG KeyingLogic handlePress] State did not change (already pressed). Ignoring.`); // Added log
             return;
        }

        // --- Context-specific Actions ---
        const status = this.gameState.status;

        // 1. Results Screen Input
        if (status === GameStatus.SHOWING_RESULTS) {
            console.log(`[DEBUG KeyingLogic handlePress] Results Action Triggered by: ${type}`); // Added log
            this.tonePlayer.playInputTone(type); // Play feedback tone
            this.callbacks.onResultsInput(type); // Trigger results action callback
            return; // Stop further processing for results screen
        }

        // 2. Game/Sandbox/Endless Input
        const isGameInputContext = (status === GameStatus.READY || status === GameStatus.LISTENING ||
                                     status === GameStatus.TYPING || status === GameStatus.DECODING);
        console.log(`[DEBUG KeyingLogic handlePress] isGameInputContext: ${isGameInputContext}`); // Added log

        if (isGameInputContext) {
             console.log("[DEBUG KeyingLogic handlePress] Ensuring audio context initialized."); // Added log
             // Ensure audio context is ready (might be first interaction)
             this.tonePlayer.audioCtxManager.initializeContext(); // Ensure context is active

             // If decoding was scheduled, cancel it because new input is arriving
             if (status === GameStatus.DECODING || this.decoder.decodeTimeoutId !== null) {
                  console.log("[DEBUG KeyingLogic handlePress] Cancelling scheduled decode due to new press."); // Added log
                  this.decoder.cancelScheduledDecode();
                  // Only revert to TYPING if there's still a sequence, otherwise LISTENING might be more appropriate
                  this.gameState.status = this.gameState.currentInputSequence ? GameStatus.TYPING : GameStatus.LISTENING;
                  console.log(`[DEBUG KeyingLogic handlePress] Status set to: ${this.gameState.status} after cancelling decode.`); // Added log
                  if (this.gameState.characterTimeoutId) this.gameState.clearCharacterTimeout(); // Clear state's ref too
             }

             // Process the new input state (handles iambic, auto-repeat, tone queueing)
             console.log("[DEBUG KeyingLogic handlePress] Calling _processInputStateChange."); // Added log
             this._processInputStateChange();
        }
    }

    /** Handles release events forwarded from InputHandler. */
    handleRelease(type, method) { // method currently unused
        console.log(`[DEBUG KeyingLogic handleRelease] Type: ${type}, Method: ${method}. Current Status: ${this.gameState.status}`); // Added log
        let stateChanged = false;

        // Update internal active state
        if (type === 'dit' && this.ditActive) {
            this.ditActive = false;
            stateChanged = true;
             console.log(`[DEBUG KeyingLogic handleRelease] Dit DEACTIVATED.`); // Added log
        } else if (type === 'dah' && this.dahActive) {
            this.dahActive = false;
            stateChanged = true;
             console.log(`[DEBUG KeyingLogic handleRelease] Dah DEACTIVATED.`); // Added log
        }

        // Only proceed if state actually changed to released
        if (!stateChanged) {
             console.log(`[DEBUG KeyingLogic handleRelease] State did not change (already released). Ignoring.`); // Added log
             return;
        }

        // --- Context-specific Actions ---
        const status = this.gameState.status;
        const isGameInputContext = (status === GameStatus.READY || status === GameStatus.LISTENING ||
                                     status === GameStatus.TYPING || status === GameStatus.DECODING);
        console.log(`[DEBUG KeyingLogic handleRelease] isGameInputContext: ${isGameInputContext}`); // Added log

        if (isGameInputContext) {
             // Re-evaluate the input state (might stop iambic/repeat or schedule decode)
             // No need for the extra queue check here; _handleToneEnd followed by _processInputStateChange will handle it.
              console.log("[DEBUG KeyingLogic handleRelease] Calling _processInputStateChange."); // Added log
             this._processInputStateChange();
        }
        // No specific action needed on release for results screen
    }

    /** Central logic to determine input mode (gameplay only) and manage timers/state. Called on press/release and after tone end. */
    _processInputStateChange() {
        console.log(`[DEBUG KeyingLogic _processInputStateChange] Called. DitActive: ${this.ditActive}, DahActive: ${this.dahActive}, Status: ${this.gameState.status}, isPlaying: ${this.gameState.isPlaying()}, StartTime: ${this.gameState.startTime}`); // Added log + startTime
        const status = this.gameState.status;
        // Check if playing game/sandbox/endless
        const isGameInputContext = this.gameState.isPlaying(); // Checks READY, LISTENING, TYPING, DECODING

        // If not in a state where keying matters, clear timers and state
        if (!isGameInputContext && status !== GameStatus.READY) { // Allow processing if starting from READY
           console.log(`[DEBUG KeyingLogic _processInputStateChange] Not in game input context. Clearing timers/state.`); // Added log
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

        // --- *** FIX START *** ---
        // If starting first input during READY or LISTENING state and timer hasn't started yet
        if ((status === GameStatus.READY || status === GameStatus.LISTENING) && this.gameState.startTime === 0 && (isDitActive || isDahActive)) { // <-- Modified condition
             console.log(`[DEBUG KeyingLogic _processInputStateChange] First input detected (Status: ${status}, startTime: ${this.gameState.startTime}). Starting timer.`); // Modified log
             if (this.gameState.startTimer()) { // Sets status to LISTENING if it was READY
                 console.log("[DEBUG KeyingLogic _processInputStateChange] gameState.startTimer() succeeded. Calling onInputStart callback."); // Added log
                 this.callbacks.onInputStart(); // Notify main logic to start UI timer etc.
             } else {
                 // This could happen if status is LISTENING but startTime somehow got set elsewhere, though unlikely now.
                 console.warn("[DEBUG KeyingLogic _processInputStateChange] gameState.startTimer() failed (maybe state issue?)."); // Modified log
             }
             // Immediately transition to typing on first input
             this.gameState.status = GameStatus.TYPING;
             console.log(`[DEBUG KeyingLogic _processInputStateChange] Status set to TYPING.`); // Added log
        }
        // --- *** FIX END *** ---

        // Determine Iambic state or single key press
        if (isDitActive && isDahActive) {
            console.log("[DEBUG KeyingLogic _processInputStateChange] Both keys active - Entering/Continuing Iambic Mode."); // Added log
            // --- Iambic Mode ---
            this.gameState.isIambicHandling = true;
            // Set initial iambic element based on which key was pressed first *if* state is new
            if (this.gameState.iambicState === null) {
                 this.gameState.iambicState = (this.pressStartTime.dah > this.pressStartTime.dit) ? 'dah' : 'dit';
                 console.log(`[DEBUG KeyingLogic _processInputStateChange] Starting Iambic B, initial element: ${this.gameState.iambicState}`); // Added log
            }
            this._triggerRepeatOrIambicOutput(); // Start/continue iambic output

        } else if (isDitActive) {
            console.log("[DEBUG KeyingLogic _processInputStateChange] Only Dit active."); // Added log
            // --- Dit Only Mode ---
            if (this.gameState.isIambicHandling) { // If switching from iambic
                 this.gameState.iambicState = 'dit'; // Set next element to dit
                 console.log(`[DEBUG KeyingLogic _processInputStateChange] Switching from Iambic to Dit only.`); // Added log
            } else if (this.gameState.iambicState === null) { // If first press or after pause
                 this.gameState.iambicState = 'dit';
                 console.log(`[DEBUG KeyingLogic _processInputStateChange] Starting Dit only mode.`); // Added log
            }
            this.gameState.isIambicHandling = false;
            this._triggerRepeatOrIambicOutput(); // Start/continue dit output

        } else if (isDahActive) {
             console.log("[DEBUG KeyingLogic _processInputStateChange] Only Dah active."); // Added log
             // --- Dah Only Mode ---
             if (this.gameState.isIambicHandling) { // If switching from iambic
                 this.gameState.iambicState = 'dah';
                 console.log(`[DEBUG KeyingLogic _processInputStateChange] Switching from Iambic to Dah only.`); // Added log
             } else if (this.gameState.iambicState === null) { // If first press or after pause
                 this.gameState.iambicState = 'dah';
                  console.log(`[DEBUG KeyingLogic _processInputStateChange] Starting Dah only mode.`); // Added log
             }
             this.gameState.isIambicHandling = false;
             this._triggerRepeatOrIambicOutput(); // Start/continue dah output

        } else {
             console.log("[DEBUG KeyingLogic _processInputStateChange] No keys active."); // Added log
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
            console.log(`[DEBUG KeyingLogic _processInputStateChange] Can schedule decode? ${canScheduleDecode}. Sequence: '${this.gameState.currentInputSequence}', Status: ${status}, AudioBusy: ${!!this.tonePlayer.inputToneNode}, Queue: ${this.queuedInput}, DecodeTimer: ${this.decoder.decodeTimeoutId}`); // Added log

             if (canScheduleDecode) {
                 console.log("[DEBUG KeyingLogic _processInputStateChange] Conditions met, scheduling decode."); // Added log
                 this._scheduleDecodeAfterDelay();
             }
             // If state was TYPING but sequence is now empty (cleared by decode/moveNext), revert to LISTENING
             else if (status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  console.log("[DEBUG KeyingLogic _processInputStateChange] Was TYPING, sequence now empty. Setting status to LISTENING."); // Added log
                  this.gameState.status = GameStatus.LISTENING;
             }
             // If keys are inactive, but we can't schedule decode yet (e.g., audio busy),
             // ensure state reflects waiting/listening if appropriate.
             else if (!canScheduleDecode && status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                 console.log("[DEBUG KeyingLogic _processInputStateChange] Keys inactive, sequence present, but cannot schedule decode yet. Staying TYPING."); // Added log
                 // Still waiting for audio/queue to clear, remain TYPING is likely okay
                 // Or switch back to LISTENING? Let's keep TYPING for now.
             }
             // Ensure listening state if game active and nothing else applies
             else if (this.gameState.isPlaying() && status !== GameStatus.LISTENING) {
                  // Avoid flapping between states if conditions aren't met yet.
                  // If sequence exists but can't decode, TYPING is okay.
                  // If no sequence, LISTENING is correct.
                  if (!this.gameState.currentInputSequence) {
                    console.log(`[DEBUG KeyingLogic _processInputStateChange] No keys active, no sequence. Ensuring status is LISTENING (was ${status}).`); // Added log
                    this.gameState.status = GameStatus.LISTENING;
                  } else {
                     console.log(`[DEBUG KeyingLogic _processInputStateChange] No keys active, but sequence exists ('${this.gameState.currentInputSequence}'). Keeping status ${status}.`); // Added log
                  }
             } else {
                 console.log(`[DEBUG KeyingLogic _processInputStateChange] No keys active, no state change needed (already LISTENING or not playing).`); // Added log
             }
        }
    }

    /** Adds the Morse element to the game state sequence and triggers UI update. */
    _emitInputToSequence(type) {
        console.log(`[DEBUG KeyingLogic _emitInputToSequence] Emitting: ${type}`); // Added log
        const morseChar = (type === 'dit') ? '.' : '-';
        this.gameState.addInput(morseChar); // Update game state
        this.callbacks.onUpdateUserPattern(this.gameState.currentInputSequence); // Update UI
        return morseChar;
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence if conditions met. */
    _triggerRepeatOrIambicOutput() {
        console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Called. iambicState: ${this.gameState.iambicState}, isIambicHandling: ${this.gameState.isIambicHandling}, lastEmitTime: ${this.lastEmitTime}`); // Added log
        this._clearRepeatOrIambicTimer(); // Clear previous timer if any

        const elementToSend = this.gameState.iambicState; // 'dit' or 'dah' to send *now*

        // Exit if not in a valid game state or no element determined yet
        if (!this.gameState.isPlaying() || !elementToSend) {
            console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Exiting: Not playing or no element to send (isPlaying: ${this.gameState.isPlaying()}, elementToSend: ${elementToSend}).`); // Added log
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
             console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Key release detected, mode no longer valid. Re-evaluating state.`); // Added log
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
        console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Time since last emit: ${timeSinceLastEmit.toFixed(0)}ms, Required time: ${requiredTimeMs.toFixed(0)}ms`); // Added log

        // Check timing: Has enough time passed since the *start* of the last element + intra-element gap?
        // Allow immediate emission if lastEmitTime is 0 (first element).
        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            // Not enough time passed, schedule check slightly later
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Waiting ${remainingTimeMs.toFixed(0)}ms for intra-char gap.`); // Added log
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        // Check audio queue: Is the tone player busy?
        const isAudioBusy = this.tonePlayer.inputToneNode !== null;
        console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Audio busy check: ${isAudioBusy}`); // Added log
        if (isAudioBusy) {
             // --- Queue the input (Single Slot, No Overwrite) ---
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
                 console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Audio busy, queued: ${elementToSend}`); // Added log
             } else {
                 console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Audio busy, queue full (${this.queuedInput}). Ignored: ${elementToSend}`); // Added log
             }
             // Even if queued, we might need to schedule the *next* check if keys are still held
             // Let _handleToneEnd -> _processInputStateChange handle this scheduling. Return here.
             return;
        }

        // --- Conditions met: Emit the element ---
        console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Emitting: ${elementToSend}`); // Added log
        this._emitInputToSequence(elementToSend);
        this.tonePlayer.playInputTone(elementToSend); // Play the sound
        this.lastInputTypeGenerated = elementToSend; // Remember what was just sent
        this.lastEmitTime = performance.now(); // Record time tone *started*
        console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Emitted ${elementToSend}. lastEmitTime set to ${this.lastEmitTime}`); // Added log

        // Determine the next element for Iambic mode
        if (this.gameState.isIambicHandling) {
            this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit'; // Alternate
            console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Iambic B - Next element will be ${this.gameState.iambicState}`); // Added log
        } else {
             console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Single key mode - iambicState remains ${this.gameState.iambicState}`); // Added log
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
        console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Should schedule next? ${shouldScheduleNext}. Delay: ${delayForNextMs.toFixed(0)}ms`); // Added log

        if (shouldScheduleNext) {
            console.log(`[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Scheduling next output check in ${delayForNextMs.toFixed(0)}ms`); // Added log
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
        } else {
             // If keys were released during this function's execution, ensure state is re-evaluated
             // This might happen if release occurs between the emit and this check.
             // _processInputStateChange will handle scheduling decode if appropriate.
             console.log("[DEBUG KeyingLogic _triggerRepeatOrIambicOutput] Keys released during processing, scheduling state re-evaluation after emit."); // Added log
             // Use setTimeout to allow current execution stack to clear.
             setTimeout(() => this._processInputStateChange(), 0);
        }
    }

    /** Callback function triggered by TonePlayer when an input tone finishes playing naturally. */
    _handleToneEnd() {
        console.log("[DEBUG KeyingLogic _handleToneEnd] Called. Current queuedInput:", this.queuedInput); // Added log
        let processedQueueItem = false;

        // --- Process Queued Item (Unconditionally, as per original requirement) ---
        // If an item was queued because audio was busy, process it now
        if (this.queuedInput !== null) {
            const typeToProcess = this.queuedInput;
            this.queuedInput = null; // Clear queue *before* processing
            console.log(`[DEBUG KeyingLogic _handleToneEnd] Processing queued input: ${typeToProcess}`); // Added log

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
                  console.log(`[DEBUG KeyingLogic _handleToneEnd] Status set to TYPING after processing queue.`); // Added log
             }

             // IMPORTANT: Since playing the queued item starts a new tone, which will trigger
             // _handleToneEnd again, we stop processing here. The *next* _handleToneEnd call
             // (after the queued tone finishes) will trigger the state evaluation.
             console.log(`[DEBUG KeyingLogic _handleToneEnd] Finished processing queue item. Returning to wait for next tone end.`); // Added log
             return;
        }

        // --- Re-evaluate State After Tone Finishes (and queue was empty or just processed) ---
        // Remove the setTimeout(..., 0) to call state check directly
        console.log("[DEBUG KeyingLogic _handleToneEnd] Tone ended (no queue processed), calling _processInputStateChange directly."); // Added log
        this._processInputStateChange();
    }


    /** Schedules the character decode function after the inter-character gap timeout. */
     _scheduleDecodeAfterDelay() {
         console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Called. Current sequence: '${this.gameState.currentInputSequence}'`); // Added log
         this.decoder.cancelScheduledDecode(); // Clear any previous decode timer (safe to call if null)
         if (this.gameState.characterTimeoutId) this.gameState.clearCharacterTimeout(); // Clear game state ref too

         // --- Add explicit check for decoder's threshold validity ---
         if (!this.decoder || typeof this.decoder.interCharGapThreshold !== 'number' || this.decoder.interCharGapThreshold <= 0) {
             console.error(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Error: Invalid morseDecoder.interCharGapThreshold (${this.decoder?.interCharGapThreshold}). Aborting decode schedule.`);
             // Attempt to reset state to avoid getting stuck
              if (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.DECODING) {
                   console.warn("[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Resetting status to LISTENING due to invalid threshold.");
                   this.gameState.status = GameStatus.LISTENING;
              }
             return;
         }
         // --- End explicit check ---

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
              console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Decode scheduling skipped. Status: ${this.gameState.status}, Sequence: '${this.gameState.currentInputSequence}', Keys Active: ${this.ditActive || this.dahActive}, Audio Busy: ${!!this.tonePlayer.inputToneNode}, Queue: ${this.queuedInput}`); // Added log
              // If we were TYPING but sequence is now empty (maybe cleared elsewhere?), go back to listening
              if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                   console.log("[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Was TYPING, sequence now empty. Setting status to LISTENING."); // Added log
                   this.gameState.status = GameStatus.LISTENING;
              }
              // If conditions aren't met, _processInputStateChange might handle reverting state later if needed.
              return;
         }

         console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Scheduling decode for sequence: '${this.gameState.currentInputSequence}' with delay: ${this.decoder.interCharGapThreshold.toFixed(0)}ms.`); // Added log
         this.gameState.status = GameStatus.DECODING; // Set state
         console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Status set to DECODING.`); // Added log

         // Ask the decoder to schedule the callback
         const timeoutId = this.decoder.scheduleDecode(() => {
             // This callback executes after the timeout defined in MorseDecoder
              console.log("[DEBUG KeyingLogic _scheduleDecodeAfterDelay -> Timeout Callback] Decode timer fired."); // Added log
             // Check game state *again* when callback fires, as it might have changed
             // (e.g., user started typing again)
             if (this.gameState.status === GameStatus.DECODING) {
                 console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay -> Timeout Callback] Status is still DECODING. Calling onCharacterDecode for: '${this.gameState.currentInputSequence}'`); // Added log
                 this.callbacks.onCharacterDecode(); // Trigger character validation in main logic
             } else {
                  console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay -> Timeout Callback] Decode callback executed, but status is now ${this.gameState.status}. Ignoring decode attempt.`); // Added log
                  // If status changed away from DECODING, ensure state is reasonable (e.g., LISTENING)
                  // _processInputStateChange should handle this if keys were pressed/released,
                  // but as a fallback, ensure we aren't stuck.
                  if (this.gameState.isPlaying() && !this.ditActive && !this.dahActive && !this.gameState.currentInputSequence) {
                       console.log("[DEBUG KeyingLogic _scheduleDecodeAfterDelay -> Timeout Callback] Ensuring status is LISTENING as fallback."); // Added log
                       this.gameState.status = GameStatus.LISTENING;
                  }
             }
             // Reset iambic state after decode attempt regardless of outcome
             // These should already be null if no keys are pressed, but doesn't hurt to ensure.
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
         });

         if (timeoutId) {
              console.log(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Decode scheduled with timeout ID: ${timeoutId}`); // Added log
              this.gameState.setCharacterTimeout(timeoutId); // Keep gameState aware of the timer
         } else {
            console.error(`[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Decoder did not return a timeout ID!`); // Added log
            // If decoder didn't return a timeoutId (e.g., delay was 0),
            // immediately revert state if decode didn't happen synchronously
            if(this.gameState.status === GameStatus.DECODING) {
                console.warn("[DEBUG KeyingLogic _scheduleDecodeAfterDelay] Reverting status to LISTENING due to missing timeout ID."); // Added log
                // This case is less likely with standard Morse timing but handles potential edge case.
                this.gameState.status = GameStatus.LISTENING;
            }
         }
     }

    /** Clears the single iambic/repeat generation timer. */
    _clearRepeatOrIambicTimer() {
        if (this.repeatOrIambicTimerId) {
            clearTimeout(this.repeatOrIambicTimerId);
            console.log(`[DEBUG KeyingLogic _clearRepeatOrIambicTimer] Cleared timer ID: ${this.repeatOrIambicTimerId}`); // Added log
            this.repeatOrIambicTimerId = null;
        }
    }
}