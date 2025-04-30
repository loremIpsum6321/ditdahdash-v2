// Dit-Dah-Dash_Refactored/src/js/audio/sequencePlayer.js

import {
    AUDIO_DEFAULT_TONE_FREQUENCY,
    AUDIO_RAMP_TIME,
    DEFAULT_WPM,
    DIT_DURATION_UNITS,
    DAH_DURATION_UNITS,
    INTRA_CHARACTER_GAP_UNITS,
    INTER_CHARACTER_GAP_UNITS,
    WORD_GAP_UNITS
} from '../core/configConstants.js';
// Note: GameStatus is not used here; state changes are handled by the caller via callbacks.

/**
 * js/audio/sequencePlayer.js
 * --------------------------
 * Handles playback of formatted Morse code sequences using the Web Audio API.
 * Requires an AudioContextManager instance and timing information.
 * Extracted and adapted from the original audioPlayer.js.
 */

export class SequencePlayer {
    /**
     * @param {AudioContextManager} audioCtxManager - The shared audio context manager instance.
     */
    constructor(audioCtxManager) {
        if (!audioCtxManager) {
            throw new Error("SequencePlayer requires an AudioContextManager instance.");
        }
        this.audioCtxManager = audioCtxManager;
        this.toneFrequency = AUDIO_DEFAULT_TONE_FREQUENCY;
        this.rampTime = AUDIO_RAMP_TIME;

        // Timing (derived from WPM)
        this.wpm = DEFAULT_WPM;
        this.ditDurationSec = 0;
        this.dahDurationSec = 0;
        this.intraCharGapSec = 0;
        this.interCharGapSec = 0;
        this.wordGapSec = 0;
        this._calculateTimings(this.wpm); // Initial calculation

        // Playback state
        this.playbackNodes = []; // Stores { osc, gain } for sequence playback nodes
        this.playbackCompletionTimeoutId = null;
        this.isCurrentlyPlayingBack = false;

        console.log("SequencePlayer Initialized.");
    }

    /**
     * Calculates Morse element durations based on the current WPM.
     * @param {number} wpm - The current Words Per Minute.
     * @private
     */
    _calculateTimings(wpm) {
        if (wpm > 0) {
            const ditMs = 1200 / wpm;
            this.ditDurationSec = ditMs / 1000;
            this.dahDurationSec = (ditMs * DAH_DURATION_UNITS) / 1000;
            this.intraCharGapSec = (ditMs * INTRA_CHARACTER_GAP_UNITS) / 1000;
            this.interCharGapSec = (ditMs * INTER_CHARACTER_GAP_UNITS) / 1000;
            this.wordGapSec = (ditMs * WORD_GAP_UNITS) / 1000;
        } else {
            // Set to zero if WPM is invalid
            this.ditDurationSec = 0;
            this.dahDurationSec = 0;
            this.intraCharGapSec = 0;
            this.interCharGapSec = 0;
            this.wordGapSec = 0;
        }
         // console.log(`SequencePlayer timings updated (WPM=${wpm}): Dit=${(this.ditDurationSec*1000).toFixed(0)}ms`);
    }

    /**
     * Updates the WPM setting used for calculating playback timings.
     * @param {number} wpm - The new WPM value.
     */
    updateWpm(wpm) {
        if (this.wpm !== wpm && wpm > 0) {
            this.wpm = wpm;
            this._calculateTimings(wpm);
             if (this.isCurrentlyPlayingBack) {
                 console.warn("SequencePlayer: WPM changed during playback. Timing might be affected.");
             }
        }
    }

    /**
     * Updates the base frequency for the playback tones.
     * @param {number} frequency - The new frequency in Hz.
     */
    updateFrequency(frequency) {
        if (typeof frequency === 'number' && frequency > 0) {
            this.toneFrequency = frequency;
        }
    }

    /**
     * Plays a full Morse sequence based on a formatted string.
     * String format: '.' = dit, '-' = dah, ' ' = intra-element gap, '/' = inter-character gap, '|' = word gap.
     * @param {string} morseString - The formatted Morse sequence (e.g., ". - . / - --- | .").
     * @param {function} [onComplete] - Optional callback function executed when playback finishes naturally.
     */
    playMorseSequence(morseString, onComplete) {
        const audioContext = this.audioCtxManager.getAudioContext(); // Gets context, attempts resume if needed
        const masterGainNode = this.audioCtxManager.getMasterGainNode();

        if (!audioContext || !masterGainNode || !this.audioCtxManager.isSoundGloballyEnabled || !morseString) {
            console.warn("playMorseSequence skipped: Context/Gain not ready, sound disabled, or empty string.");
            this.isCurrentlyPlayingBack = false; // Ensure state is correct
            if (onComplete) {
                 // Call complete immediately if we can't play
                 try { onComplete(); } catch(e) { console.error("Error in onComplete callback:", e); }
            }
            return;
        }

        this.stopPlayback(); // Stop any previous sequence first
        this.isCurrentlyPlayingBack = true;
        console.log("Starting Morse sequence playback...");

        let scheduledTime = audioContext.currentTime;
        // Split by spaces, keeping delimiters that represent gaps ('/', '|')
        const elements = morseString.split(/(\s+|\/|\|)/);

        elements.forEach(element => {
            if (!element || element === ' ') return; // Skip empty strings and simple spaces from split

            element = element.trim(); // Trim potential whitespace around delimiters
            let currentDuration = 0;
            let gapDuration = 0; // Time *after* this element finishes

            if (element === '.') {
                currentDuration = this.ditDurationSec;
                if (currentDuration > 0) {
                    const node = this._scheduleToneInternal(scheduledTime, currentDuration, this.toneFrequency, masterGainNode);
                    if (node) this.playbackNodes.push(node);
                }
                gapDuration = this.intraCharGapSec; // Standard gap after dit/dah element
            } else if (element === '-') {
                currentDuration = this.dahDurationSec;
                 if (currentDuration > 0) {
                    const node = this._scheduleToneInternal(scheduledTime, currentDuration, this.toneFrequency, masterGainNode);
                    if (node) this.playbackNodes.push(node);
                 }
                gapDuration = this.intraCharGapSec; // Standard gap after dit/dah element
            } else if (element === '/') {
                 // Represents inter-character gap (total 3 units).
                 // The previous element already added 1 unit (intraCharGapSec).
                 // So, add the remaining duration needed.
                 gapDuration = Math.max(0, this.interCharGapSec - this.intraCharGapSec);
                 currentDuration = 0; // No sound duration for the gap itself
            } else if (element === '|') {
                 // Represents word gap (total 7 units).
                 // Previous element added 1 unit. Add remaining.
                 gapDuration = Math.max(0, this.wordGapSec - this.intraCharGapSec);
                 currentDuration = 0; // No sound duration
             }
             // Any other element is ignored (e.g., unexpected characters in string)

             scheduledTime += currentDuration + gapDuration;
        });

        // Calculate total duration from the start time to the final scheduled time
        const totalDurationMs = (scheduledTime - audioContext.currentTime) * 1000;

        // Schedule the completion callback slightly after the last sound/gap should end
        const completionDelay = Math.max(10, totalDurationMs + this.rampTime * 1000 + 150); // Ensure positive delay, add buffer

        this.playbackCompletionTimeoutId = setTimeout(() => {
            // Check if still marked as playing back (wasn't manually stopped)
            if (this.isCurrentlyPlayingBack) {
                this.isCurrentlyPlayingBack = false;
                this.playbackNodes = []; // Clear node references
                this.playbackCompletionTimeoutId = null;
                console.log("Morse sequence playback finished naturally.");
                if (onComplete) {
                    try { onComplete(); } catch (e) { console.error("Error in onComplete callback:", e); }
                }
            }
        }, completionDelay);
    }

    /**
     * Stops any currently playing Morse sequence playback immediately.
     * Cleans up audio nodes and cancels the completion callback.
     */
    stopPlayback() {
        if (this.playbackCompletionTimeoutId) {
            clearTimeout(this.playbackCompletionTimeoutId);
            this.playbackCompletionTimeoutId = null;
        }

        if (this.playbackNodes.length > 0) {
             // console.log(`Stopping playback manually. ${this.playbackNodes.length} nodes active.`); // Debug
            [...this.playbackNodes].forEach(({ osc, gain }) => {
                this._stopNode(osc, gain); // Use helper to stop/disconnect
            });
            this.playbackNodes = []; // Clear the array immediately
        }

        if (this.isCurrentlyPlayingBack) {
            this.isCurrentlyPlayingBack = false;
            console.log("Playback stopped manually.");
        }
    }

    /**
     * Internal helper to schedule a single tone (used by playMorseSequence).
     * @private
     */
    _scheduleToneInternal(startTime, duration, frequency, masterGainNode, waveType = 'sine', gainLevel = 0.9) {
        const audioContext = this.audioCtxManager.getAudioContext();
         if (!audioContext || !masterGainNode || duration <= 0) return null;

        try {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(masterGainNode);

            osc.type = waveType;
            osc.frequency.setValueAtTime(frequency, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(gainLevel, startTime + this.rampTime);
            if (duration > this.rampTime * 2) {
                 gain.gain.setValueAtTime(gainLevel, startTime + duration - this.rampTime);
            }
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc.start(startTime);
            const stopTime = startTime + duration + this.rampTime + 0.01;
            osc.stop(stopTime);

            // Add a basic onended handler for self-cleanup
            osc.onended = () => {
                 this.playbackNodes = this.playbackNodes.filter(n => n.osc !== osc); // Remove self
                 this._disconnectNodes(osc, gain);
            };

            return { osc, gain };

        } catch (error) {
            console.error("SequencePlayer: Error scheduling tone:", error);
            try { osc?.disconnect(); gain?.disconnect(); } catch(e){}
            return null;
        }
    }

     /**
     * Stops a specific node pair immediately with fade-out.
     * @private
     */
     _stopNode(osc, gain) {
        const audioContext = this.audioCtxManager.getAudioContext();
        if (!audioContext || !osc || !gain) return;

        const now = audioContext.currentTime;
        try {
            osc.onended = null; // Remove any existing handler

            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + this.rampTime);

            osc.stop(now + this.rampTime + 0.01);

            setTimeout(() => { this._disconnectNodes(osc, gain); }, this.rampTime * 1000 + 20);

        } catch (e) {
            console.warn("Error stopping node:", e);
            this._disconnectNodes(osc, gain);
        }
    }

    /**
     * Safely disconnects nodes.
     * @private
     */
    _disconnectNodes(osc, gain) {
         try { if (osc) osc.disconnect(); } catch (e) { /* Ignore */ }
         try { if (gain) gain.disconnect(); } catch (e) { /* Ignore */ }
    }
}

// Example Usage (in another module):
// import { SequencePlayer } from './sequencePlayer.js';
// import { AudioContextManager } from './audioContextManager.js';
//
// const audioCtxManager = new AudioContextManager();
// // ... initialize audioCtxManager on user interaction ...
//
// const sequencePlayer = new SequencePlayer(audioCtxManager);
// sequencePlayer.updateWpm(20);
// sequencePlayer.playMorseSequence("... --- ...", () => console.log("SOS played."));