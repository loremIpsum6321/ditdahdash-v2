// Dit-Dah-Dash_Refactored/src/js/audio/audioContextManager.js

import { AUDIO_DEFAULT_VOLUME, AUDIO_RAMP_TIME } from '../core/configConstants.js';

/**
 * js/audio/audioContextManager.js
 * -------------------------------
 * Manages the Web Audio API AudioContext instance and master gain node.
 * Handles context initialization, state changes, and volume control.
 * Extracted from the original audioPlayer.js.
 */

export class AudioContextManager {
    constructor() {
        this.audioContext = null;
        this.masterGainNode = null;
        this.isInitialized = false; // Context created and running/resumed
        this.isSoundGloballyEnabled = true; // Tracks the global mute state
        this.currentVolumeSetting = AUDIO_DEFAULT_VOLUME; // Tracks the desired volume level (0-1)

        console.log("AudioContextManager Initialized (Context not yet created)");
    }

    /**
     * Attempts to create or resume the AudioContext.
     * Should be called upon user interaction.
     * @returns {boolean} True if the context is ready ('running'), false otherwise.
     */
    initializeContext() {
        // Avoid re-initialization if already running
        if (this.isInitialized && this.audioContext?.state === 'running') {
            return true;
        }

        // Create context if it doesn't exist
        if (!this.audioContext) {
            try {
                console.log("Attempting to create AudioContext...");
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGainNode = this.audioContext.createGain();
                this.masterGainNode.connect(this.audioContext.destination);

                // Set initial gain based on current settings
                this._applyMasterGain();

                this.audioContext.onstatechange = () => {
                    console.log("AudioContext state changed:", this.audioContext?.state);
                    this.isInitialized = this.audioContext?.state === 'running';
                    if (this.isInitialized) {
                        this._applyMasterGain(); // Re-apply volume if state becomes running
                    }
                };
                console.log("AudioContext created, state:", this.audioContext.state);

            } catch (e) {
                console.error("Web Audio API context creation failed.", e);
                this.audioContext = null;
                this.masterGainNode = null;
                this.isInitialized = false;
                this.isSoundGloballyEnabled = false; // Disable sound if context fails
                return false;
            }
        }

        // Handle suspended state (common on mobile before interaction)
        if (this.audioContext.state === 'suspended') {
            console.log("AudioContext is suspended, attempting to resume...");
            this.audioContext.resume()
                .then(() => {
                    console.log("AudioContext resumed successfully.");
                    this.isInitialized = true;
                    this._applyMasterGain(); // Apply volume after resume
                })
                .catch(err => {
                    console.error("AudioContext resume failed:", err);
                    this.isInitialized = false; // Mark as not initialized on resume failure
                });
            // Resume is async, return current (not ready) state
            return false;
        }

        // Update initialized flag based on current state
        this.isInitialized = this.audioContext.state === 'running';
        return this.isInitialized;
    }

    /**
     * Returns the managed AudioContext instance.
     * Callers should check initializeContext() first or handle null return.
     * @returns {AudioContext | null}
     */
    getAudioContext() {
        if (!this.isInitialized && this.audioContext?.state !== 'running') {
             // Attempt lazy initialization/resume if accessed while not ready
             // This might help in some scenarios but isn't guaranteed without user interaction
            console.warn("getAudioContext called when context not running. Attempting init/resume.");
            this.initializeContext();
        }
        return (this.audioContext?.state === 'running') ? this.audioContext : null;
    }

    /**
     * Returns the master GainNode.
     * Callers should check initializeContext() first or handle null return.
     * @returns {GainNode | null}
     */
    getMasterGainNode() {
         if (!this.isInitialized && this.audioContext?.state !== 'running') {
             console.warn("getMasterGainNode called when context not running.");
              this.initializeContext(); // Attempt lazy init
         }
        return (this.audioContext?.state === 'running') ? this.masterGainNode : null;
    }

    /**
     * Checks if the audio context is created and in a running state.
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized && this.audioContext?.state === 'running';
    }

    /**
     * Sets the desired master volume level.
     * @param {number} level - Volume level from 0.0 (silent) to 1.0 (full).
     */
    setVolume(level) {
        const newVolume = Math.max(0, Math.min(1, level)); // Clamp between 0 and 1
        if (this.currentVolumeSetting !== newVolume) {
            this.currentVolumeSetting = newVolume;
            // console.log(`Volume setting updated to: ${this.currentVolumeSetting.toFixed(2)}`); // Debug
            this._applyMasterGain(); // Apply the change to the gain node
        }
    }

    /**
     * Enables or disables sound output globally (mutes/unmutes).
     * @param {boolean} enabled - True to enable sound, false to disable/mute.
     */
    setSoundEnabled(enabled) {
        if (this.isSoundGloballyEnabled === enabled) return; // No change

        this.isSoundGloballyEnabled = enabled;
        console.log(`Sound globally ${enabled ? 'enabled' : 'disabled'}`);
        this._applyMasterGain(); // Apply the change to the gain node

        // Consider stopping sounds if globally disabled (responsibility of player modules)
        // if (!enabled) {
        //    // e.g., sequencePlayer.stop(), tonePlayer.stopAll()
        // }
    }

    /**
     * Applies the current volume and mute state to the masterGainNode.
     * @private
     */
    _applyMasterGain() {
        if (this.masterGainNode && this.audioContext && this.audioContext.state === 'running') {
            const targetGain = this.isSoundGloballyEnabled ? this.currentVolumeSetting : 0;
            const now = this.audioContext.currentTime;
            try {
                // Use a gentle ramp to avoid clicks
                this.masterGainNode.gain.cancelScheduledValues(now);
                // Set current value immediately before ramp if needed (usually not necessary for linearRamp)
                // this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
                this.masterGainNode.gain.linearRampToValueAtTime(targetGain, now + AUDIO_RAMP_TIME * 2);
                // console.log(`Applied master gain: ${targetGain.toFixed(2)}`); // Debug
            } catch (e) {
                 // This can happen if the context closes unexpectedly
                console.warn("Could not apply master gain:", e.message);
                this.isInitialized = false; // Context likely closed
            }
        } else {
            // console.warn("Cannot apply master gain: Context/GainNode not ready."); // Debug
        }
    }
}

// Example Usage (in another module):
// import { AudioContextManager } from './audioContextManager.js';
// const audioCtxManager = new AudioContextManager();
// // On user interaction:
// if (audioCtxManager.initializeContext()) {
//     const masterGain = audioCtxManager.getMasterGainNode();
//     // ... connect other nodes to masterGain ...
// }
// audioCtxManager.setVolume(0.5);
// audioCtxManager.setSoundEnabled(false); // Mute