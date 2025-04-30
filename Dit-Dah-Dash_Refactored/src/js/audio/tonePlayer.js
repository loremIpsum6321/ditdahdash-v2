// Dit-Dah-Dash_Refactored/src/js/audio/tonePlayer.js

import {
    AUDIO_DEFAULT_TONE_FREQUENCY,
    AUDIO_RAMP_TIME,
    DEFAULT_WPM, // Needed for initial timing calculation
    DIT_DURATION_UNITS,
    DAH_DURATION_UNITS
} from '../core/configConstants.js';

/**
 * js/audio/tonePlayer.js
 * ----------------------
 * Plays individual Morse code tones (dit, dah) and feedback sounds.
 * Requires an AudioContextManager instance and timing information.
 * Extracted and adapted from the original audioPlayer.js.
 */

export class TonePlayer {
    /**
     * @param {AudioContextManager} audioCtxManager - The shared audio context manager instance.
     */
    constructor(audioCtxManager) {
        if (!audioCtxManager) {
            throw new Error("TonePlayer requires an AudioContextManager instance.");
        }
        this.audioCtxManager = audioCtxManager;
        this.toneFrequency = AUDIO_DEFAULT_TONE_FREQUENCY;
        this.rampTime = AUDIO_RAMP_TIME;

        // Timing (initialized with defaults, should be updated externally)
        this.ditDurationSec = 0;
        this.dahDurationSec = 0;
        this._calculateTimings(DEFAULT_WPM); // Initial calculation

        // State
        this.feedbackNodes = []; // Stores { osc, gain } for feedback sounds
        this.inputToneNode = null; // Stores { osc, gain, type: 'dit'|'dah' } for the currently playing input tone
        this.onToneEndCallback = null; // Callback when an input tone finishes naturally

        console.log("TonePlayer Initialized.");
    }

    /**
     * Updates the durations based on WPM.
     * @param {number} wpm - The current Words Per Minute.
     * @private
     */
    _calculateTimings(wpm) {
        if (wpm > 0) {
            const ditMs = 1200 / wpm;
            this.ditDurationSec = ditMs / 1000;
            this.dahDurationSec = (ditMs * DAH_DURATION_UNITS) / 1000;
        } else {
            this.ditDurationSec = 0;
            this.dahDurationSec = 0;
        }
         // console.log(`TonePlayer timings updated: Dit=${(this.ditDurationSec * 1000).toFixed(0)}ms, Dah=${(this.dahDurationSec * 1000).toFixed(0)}ms`);
    }

    /**
     * Updates the timing based on the current WPM setting.
     * Should be called when WPM changes.
     * @param {number} wpm - The new WPM value.
     */
    updateWpm(wpm) {
        this._calculateTimings(wpm);
    }

    /**
     * Updates the base frequency for the tones.
     * @param {number} frequency - The new frequency in Hz.
     */
    updateFrequency(frequency) {
         // Basic validation (min/max handled by settings manager/config)
         if (typeof frequency === 'number' && frequency > 0) {
            this.toneFrequency = frequency;
            // console.log(`TonePlayer frequency updated to: ${this.toneFrequency} Hz`);
         }
    }

    /**
     * Sets the callback function to be executed when an input tone finishes playing naturally.
     * @param {function | null} callback - The function to call, or null to clear.
     */
    setOnToneEndCallback(callback) {
        this.onToneEndCallback = callback;
    }

    /**
     * Plays a single Morse tone (dit or dah) immediately.
     * @param {'dit' | 'dah'} type - The type of tone to play.
     * @returns {boolean} True if the tone was successfully scheduled, false otherwise.
     */
    playInputTone(type) {
        const audioContext = this.audioCtxManager.getAudioContext(); // Gets context, attempts resume if needed
        const masterGainNode = this.audioCtxManager.getMasterGainNode();

        if (!audioContext || !masterGainNode || !this.audioCtxManager.isSoundGloballyEnabled) {
            // console.warn(`playInputTone (${type}) skipped: Context/Gain not ready or sound disabled.`);
            return false;
        }

        // Stop any existing input tone forcefully first.
        if (this.inputToneNode) {
            // console.warn(`playInputTone called while inputToneNode active. Stopping previous tone (${this.inputToneNode.type}).`);
            this._stopNode(this.inputToneNode.osc, this.inputToneNode.gain, false); // Don't trigger callback on manual stop
            this.inputToneNode = null;
        }

        const duration = type === 'dah' ? this.dahDurationSec : this.ditDurationSec;
        if (duration <= 0) {
            console.warn(`playInputTone called with invalid duration (${duration.toFixed(4)}s) for type ${type}. Check WPM.`);
            return false;
        }

        const startTime = audioContext.currentTime;
        const toneNodes = this._scheduleToneInternal(
            startTime,
            duration,
            this.toneFrequency,
            masterGainNode // Pass the master gain node
        );

        if (!toneNodes) {
            console.error(`Failed to schedule tone for ${type}.`);
            return false; // Scheduling failed
        }

        this.inputToneNode = { ...toneNodes, type }; // Store reference { osc, gain, type }

        // Setup the onended handler for natural completion
        const currentNodeRef = this.inputToneNode; // Capture ref for closure
        currentNodeRef.osc.onended = () => {
            // Check if this is still the active node (wasn't manually stopped)
            if (this.inputToneNode === currentNodeRef) {
                this.inputToneNode = null; // Clear the reference *first*
                 // console.log(`Input tone ${currentNodeRef.type} ended naturally.`); // Debug
                if (this.onToneEndCallback) {
                    // console.log("Executing onToneEndCallback."); // Debug
                    this.onToneEndCallback(); // Notify handler that audio is free
                }
            } else {
                 // console.log(`onended for stale input tone ${currentNodeRef.type}. Ignoring callback.`); // Debug
            }
            // Basic cleanup (disconnect nodes) - should be handled by _stopNode called internally by onended if needed
             this._disconnectNodes(currentNodeRef.osc, currentNodeRef.gain);
        };

        return true; // Tone scheduled successfully
    }

    /**
     * Stops the currently playing input tone immediately.
     */
    stopInputTone() {
        if (this.inputToneNode) {
            const nodeToStop = this.inputToneNode;
            this.inputToneNode = null; // Clear reference *immediately*
             // console.log(`Stopping input tone manually: ${nodeToStop.type}`); // Debug
            this._stopNode(nodeToStop.osc, nodeToStop.gain, false); // Don't trigger callback
        }
    }

    // --- Feedback Sounds ---

    /** Plays an incorrect feedback sound. */
    playIncorrectSound() {
        // Simple check: don't play feedback if an input tone is active
        if (this.inputToneNode) return;

        // Lower pitch, short duration
        const freq = this.toneFrequency * 0.7;
        const duration = 0.1; // seconds
        this._playFeedbackSound(freq, duration);
    }

    /** Stops any currently playing feedback sounds immediately. */
    stopFeedbackSounds() {
        if (this.feedbackNodes.length > 0) {
            // console.log(`Stopping ${this.feedbackNodes.length} feedback nodes.`); // Debug
            [...this.feedbackNodes].forEach(({ osc, gain }) => {
                this._stopNode(osc, gain, false); // No callback for feedback sounds
            });
            this.feedbackNodes = []; // Clear the array
        }
    }

     /**
     * Internal helper to play simple feedback sounds.
     * @param {number} frequency - The frequency of the feedback tone.
     * @param {number} durationSeconds - The duration of the feedback tone.
     * @private
     */
    _playFeedbackSound(frequency, durationSeconds) {
        const audioContext = this.audioCtxManager.getAudioContext();
        const masterGainNode = this.audioCtxManager.getMasterGainNode();

        if (!audioContext || !masterGainNode || !this.audioCtxManager.isSoundGloballyEnabled) {
            // console.warn("_playFeedbackSound skipped: Context/Gain not ready or sound disabled.");
            return;
        }
        if (frequency <= 0 || durationSeconds <= 0) return;

        this.stopFeedbackSounds(); // Ensure only one plays

        const startTime = audioContext.currentTime;
        const feedbackNodes = this._scheduleToneInternal(
            startTime,
            durationSeconds,
            frequency,
            masterGainNode,
            'triangle', // Different wave type for feedback
            0.5 // Lower gain for feedback
        );

        if (feedbackNodes) {
            this.feedbackNodes.push(feedbackNodes);
            // Basic cleanup onended handler for feedback nodes
            const currentNodeRef = feedbackNodes;
            currentNodeRef.osc.onended = () => {
                this.feedbackNodes = this.feedbackNodes.filter(n => n.osc !== currentNodeRef.osc);
                this._disconnectNodes(currentNodeRef.osc, currentNodeRef.gain);
                 // console.log("Feedback sound ended."); // Debug
            };
        }
    }


    // --- Internal Audio Node Management ---

    /**
     * Internal helper to schedule a single oscillator tone.
     * Connects to the provided masterGainNode.
     * @param {number} startTime - The audioContext time when the tone should start.
     * @param {number} duration - The duration of the tone in seconds.
     * @param {number} frequency - The frequency of the tone in Hz.
     * @param {GainNode} masterGainNode - The master gain node to connect to.
     * @param {OscillatorType} [waveType='sine'] - The oscillator wave type.
     * @param {number} [gainLevel=0.9] - The peak gain level for this tone.
     * @returns {{osc: OscillatorNode, gain: GainNode} | null} Reference to the created nodes or null on failure.
     * @private
     */
    _scheduleToneInternal(startTime, duration, frequency, masterGainNode, waveType = 'sine', gainLevel = 0.9) {
        const audioContext = this.audioCtxManager.getAudioContext();
        if (!audioContext || !masterGainNode || duration <= 0) {
            console.error("Cannot schedule tone: Invalid context, gain node, or duration.");
            return null;
        }

        try {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain(); // Individual gain for ramp
            osc.connect(gain);
            gain.connect(masterGainNode); // Connect individual gain to MASTER gain

            osc.type = waveType;
            osc.frequency.setValueAtTime(frequency, startTime);

            // Gain scheduling (ramp up, hold, ramp down)
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(gainLevel, startTime + this.rampTime);
            // Ensure hold phase exists if duration is longer than ramp times
            if (duration > this.rampTime * 2) {
                 gain.gain.setValueAtTime(gainLevel, startTime + duration - this.rampTime);
            }
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc.start(startTime);
            // Calculate stop time slightly after gain ramp completes
            const stopTime = startTime + duration + this.rampTime + 0.01; // Add small buffer
            osc.stop(stopTime);

            return { osc, gain };

        } catch (error) {
            console.error("TonePlayer: Error scheduling tone:", error);
            // Attempt cleanup on error
            try { osc?.disconnect(); gain?.disconnect(); } catch(e){}
            return null;
        }
    }

     /**
     * Stops a specific oscillator and gain node pair immediately with fade-out.
     * @param {OscillatorNode} osc - The oscillator node.
     * @param {GainNode} gain - The gain node.
     * @param {boolean} triggerCallback - Whether to trigger the onToneEndCallback (used for input tones ending naturally).
     * @private
     */
     _stopNode(osc, gain, triggerCallback = false) {
        const audioContext = this.audioCtxManager.getAudioContext();
        if (!audioContext || !osc || !gain) return;

        const now = audioContext.currentTime;
        try {
            // Remove the natural 'onended' handler
            osc.onended = null;

            // Cancel future gain changes and ramp down smoothly
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now); // Hold current gain
            gain.gain.linearRampToValueAtTime(0, now + this.rampTime);

            // Stop the oscillator shortly after the ramp down completes
            osc.stop(now + this.rampTime + 0.01);

            // Disconnect slightly later (important!)
            setTimeout(() => {
                 this._disconnectNodes(osc, gain);
                 // Check if this was the input tone *after* stopping/disconnecting
                 if (triggerCallback && this.onToneEndCallback) {
                    // console.log("Executing onToneEndCallback after node stop (natural end)."); // Debug
                     this.onToneEndCallback();
                 }
             }, this.rampTime * 1000 + 20); // Wait for ramp + buffer

        } catch (e) {
            console.warn("Error stopping audio node:", e);
            this._disconnectNodes(osc, gain); // Fallback disconnect
        }
    }

    /**
     * Safely disconnects oscillator and gain nodes.
     * @param {OscillatorNode} osc
     * @param {GainNode} gain
     * @private
     */
    _disconnectNodes(osc, gain) {
         try { if (osc) osc.disconnect(); } catch (e) { /* Ignore */ }
         try { if (gain) gain.disconnect(); } catch (e) { /* Ignore */ }
    }
}

// Example Usage (in another module):
// import { TonePlayer } from './tonePlayer.js';
// import { AudioContextManager } from './audioContextManager.js';
//
// const audioCtxManager = new AudioContextManager();
// // ... initialize audioCtxManager on user interaction ...
//
// const tonePlayer = new TonePlayer(audioCtxManager);
// tonePlayer.updateWpm(20);
// tonePlayer.playInputTone('dit');