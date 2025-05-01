// Dit-Dah-Dash_Refactored/src/js/settingsManager.js

import {
    STORAGE_KEYS, DEFAULT_WPM, AUDIO_DEFAULT_TONE_FREQUENCY, AUDIO_MIN_FREQUENCY, AUDIO_MAX_FREQUENCY,
    AUDIO_DEFAULT_VOLUME, KEYBINDING_DEFAULTS, HINT_DEFAULT_VISIBLE
} from './core/configConstants.js';

/**
 * js/settingsManager.js
 * ---------------------
 * Manages loading, saving, and applying application settings.
 * Interacts with localStorage and updates relevant modules when settings change.
 */

export class SettingsManager {
    /**
     * @param {object} modules - An object containing instances of modules that need settings applied.
     * @param {MorseDecoder} modules.morseDecoder
     * @param {TonePlayer} modules.tonePlayer
     * @param {SequencePlayer} modules.sequencePlayer
     * @param {InputHandler} modules.inputHandler
     * @param {UIManagerFacade} modules.uiManagerFacade
     * @param {GameScreen} modules.gameScreen - Specifically for hint visibility setting.
     * @param {AudioContextManager} modules.audioCtxManager - For sound enabled/volume.
     * @param {SettingsModal} [modules.settingsModalUI] - Optional, to update its display values.
     */
    constructor(modules) {
        // Validate required modules
        if (!modules || !modules.morseDecoder || !modules.tonePlayer || !modules.sequencePlayer ||
            !modules.inputHandler || !modules.uiManagerFacade || !modules.gameScreen || !modules.audioCtxManager) {
             throw new Error("SettingsManager requires morseDecoder, tonePlayer, sequencePlayer, inputHandler, uiManagerFacade, gameScreen, and audioCtxManager instances.");
         }
        this.modules = modules;

        // Internal settings state
        this.settings = {
            wpm: DEFAULT_WPM,
            frequency: AUDIO_DEFAULT_TONE_FREQUENCY,
            volume: AUDIO_DEFAULT_VOLUME,
            soundEnabled: true,
            darkModeEnabled: false,
            hintVisible: HINT_DEFAULT_VISIBLE,
            ditKey: KEYBINDING_DEFAULTS.dit,
            dahKey: KEYBINDING_DEFAULTS.dah
        };

        this.loadSettings(); // Load settings from storage on initialization
        console.log("SettingsManager Initialized.");
    }

    /** Loads settings from localStorage, validates, and updates internal state. */
    loadSettings() {
        try {
            const savedWpm = localStorage.getItem(STORAGE_KEYS.SETTINGS_WPM);
            const savedSound = localStorage.getItem(STORAGE_KEYS.SETTINGS_SOUND);
            const savedDarkMode = localStorage.getItem(STORAGE_KEYS.SETTINGS_DARK_MODE);
            const savedFrequency = localStorage.getItem(STORAGE_KEYS.SETTINGS_FREQUENCY);
            const savedHintVisible = localStorage.getItem(STORAGE_KEYS.SETTINGS_HINT_VISIBLE);
            const savedVolume = localStorage.getItem(STORAGE_KEYS.SETTINGS_VOLUME);
            const savedDitKey = localStorage.getItem(STORAGE_KEYS.SETTINGS_DIT_KEY);
            const savedDahKey = localStorage.getItem(STORAGE_KEYS.SETTINGS_DAH_KEY);

            // Apply saved values or defaults, with validation/parsing
            let wpm = savedWpm !== null ? parseInt(savedWpm, 10) : DEFAULT_WPM;
            let frequency = savedFrequency !== null ? parseInt(savedFrequency, 10) : AUDIO_DEFAULT_TONE_FREQUENCY;
            let volume = savedVolume !== null ? parseFloat(savedVolume) : AUDIO_DEFAULT_VOLUME;
            let soundEnabled = savedSound !== null ? JSON.parse(savedSound) === true : true; // Default true
            let darkModeEnabled = savedDarkMode !== null ? JSON.parse(savedDarkMode) === true : false; // Default false
            let hintVisible = savedHintVisible !== null ? JSON.parse(savedHintVisible) === true : HINT_DEFAULT_VISIBLE;
            let ditKey = (savedDitKey && savedDitKey.trim() !== '') ? savedDitKey : KEYBINDING_DEFAULTS.dit;
            let dahKey = (savedDahKey && savedDahKey.trim() !== '') ? savedDahKey : KEYBINDING_DEFAULTS.dah;

            // --- Validation & Clamping ---
            if (isNaN(wpm) || wpm <= 0) wpm = DEFAULT_WPM;
            if (isNaN(frequency)) frequency = AUDIO_DEFAULT_TONE_FREQUENCY;
            frequency = Math.max(AUDIO_MIN_FREQUENCY, Math.min(AUDIO_MAX_FREQUENCY, frequency));
            if (isNaN(volume)) volume = AUDIO_DEFAULT_VOLUME;
            volume = Math.max(0.0, Math.min(1.0, volume));

            // Prevent assigning same key to both
            if (ditKey === dahKey) {
                console.warn(`SettingsManager: Loaded keys are identical ('${ditKey}'). Resetting Dah key to default.`);
                dahKey = KEYBINDING_DEFAULTS.dah;
                // If default Dah is ALSO the same as Dit (edge case), reset Dit too
                if (ditKey === dahKey) {
                    ditKey = KEYBINDING_DEFAULTS.dit; // Should be different now
                }
                // Save corrected keys back immediately? Or wait for explicit save? Let's wait.
            }
            // --- End Validation ---

            // Update internal state
            this.settings = { wpm, frequency, volume, soundEnabled, darkModeEnabled, hintVisible, ditKey, dahKey };

            console.log("Settings Loaded:", this.settings);

            // Apply loaded settings to modules
            this.applySettings();
            // Update settings modal UI if provided
            this.modules.settingsModalUI?.updateDisplayValues(this.settings);


        } catch (e) {
            console.error("Error loading settings from localStorage:", e);
            // Fallback to defaults in case of error
            this.settings = {
                wpm: DEFAULT_WPM, frequency: AUDIO_DEFAULT_TONE_FREQUENCY, volume: AUDIO_DEFAULT_VOLUME,
                soundEnabled: true, darkModeEnabled: false, hintVisible: HINT_DEFAULT_VISIBLE,
                ditKey: KEYBINDING_DEFAULTS.dit, dahKey: KEYBINDING_DEFAULTS.dah
            };
             this.applySettings(); // Apply defaults
             this.modules.settingsModalUI?.updateDisplayValues(this.settings);
        }
    }

    /** Saves the current internal settings state to localStorage. */
    _saveSettings() {
         try {
             localStorage.setItem(STORAGE_KEYS.SETTINGS_WPM, this.settings.wpm);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_SOUND, this.settings.soundEnabled);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_DARK_MODE, this.settings.darkModeEnabled);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_FREQUENCY, this.settings.frequency);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_HINT_VISIBLE, this.settings.hintVisible);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_VOLUME, this.settings.volume);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_DIT_KEY, this.settings.ditKey);
             localStorage.setItem(STORAGE_KEYS.SETTINGS_DAH_KEY, this.settings.dahKey);
             // console.log("Settings Saved:", this.settings); // Debug
         } catch (e) {
             console.error("Error saving settings to localStorage:", e);
         }
     }

    /** Applies the current internal settings to all relevant modules. */
    applySettings() {
        console.log("Applying settings to modules...");
        // WPM
        this.modules.morseDecoder.updateWpm(this.settings.wpm);
        this.modules.tonePlayer.updateWpm(this.settings.wpm);
        this.modules.sequencePlayer.updateWpm(this.settings.wpm);

        // Frequency
        this.modules.tonePlayer.updateFrequency(this.settings.frequency);
        this.modules.sequencePlayer.updateFrequency(this.settings.frequency);

        // Volume & Sound Enabled (handled by AudioContextManager)
        this.modules.audioCtxManager.setVolume(this.settings.volume);
        this.modules.audioCtxManager.setSoundEnabled(this.settings.soundEnabled);
        this.modules.gameScreen.updateVolumeUI(this.settings.volume); // Update slider and icon
        // Dark Mode (handled by UI Facade)
        this.modules.uiManagerFacade.applyDarkMode(this.settings.darkModeEnabled);

        // Hint Visibility (handled by GameScreen via UI Facade or directly)
        this.modules.gameScreen.setHintVisibility(this.settings.hintVisible);

        // Key Mappings (handled by InputHandler)
        this.modules.inputHandler.updateKeyMappings(this.getKeyMappings());

        // Ensure audio context is initialized if sound is enabled
        if (this.settings.soundEnabled) {
             this.modules.audioCtxManager.initializeContext();
        }
    }

    // --- Getters ---

    /** Returns the current settings object. */
    getSettings() {
        return { ...this.settings }; // Return a copy
    }

    /** Returns the current key mappings. */
    getKeyMappings() {
         return {
             dit: this.settings.ditKey,
             dah: this.settings.dahKey
         };
    }

    // --- Setters (Update internal state, save, and apply) ---

    setWpm(wpm) {
        const newWpm = parseInt(wpm, 10);
        if (!isNaN(newWpm) && newWpm > 0 && this.settings.wpm !== newWpm) {
            this.settings.wpm = newWpm;
            this._saveSettings();
            this.modules.morseDecoder.updateWpm(newWpm);
            this.modules.tonePlayer.updateWpm(newWpm);
            this.modules.sequencePlayer.updateWpm(newWpm);
             // console.log(`Setting WPM applied: ${newWpm}`); // Debug
        }
    }

    setFrequency(freq) {
        let newFreq = parseInt(freq, 10);
        if (!isNaN(newFreq)) {
            newFreq = Math.max(AUDIO_MIN_FREQUENCY, Math.min(AUDIO_MAX_FREQUENCY, newFreq));
            if (this.settings.frequency !== newFreq) {
                this.settings.frequency = newFreq;
                this._saveSettings();
                this.modules.tonePlayer.updateFrequency(newFreq);
                this.modules.sequencePlayer.updateFrequency(newFreq);
                // console.log(`Setting Frequency applied: ${newFreq}`); // Debug
            }
        }
    }

     setVolume(vol) {
        let newVol = parseFloat(vol);
        if (!isNaN(newVol)) {
            newVol = Math.max(0.0, Math.min(1.0, newVol));
             if (this.settings.volume !== newVol) {
                this.settings.volume = newVol;
                this._saveSettings();
                this.modules.audioCtxManager.setVolume(newVol);
                this.modules.gameScreen.updateVolumeUI(newVol); // Update slider and icon
                // console.log(`Setting Volume applied: ${newVol}`); // Debug
            }
        }
    }

    setSoundEnabled(enabled) {
        const newEnabled = enabled === true;
        if (this.settings.soundEnabled !== newEnabled) {
            this.settings.soundEnabled = newEnabled;
            this._saveSettings();
            this.modules.audioCtxManager.setSoundEnabled(newEnabled);
             // console.log(`Setting Sound Enabled applied: ${newEnabled}`); // Debug
        }
    }

    setDarkModeEnabled(enabled) {
        const newEnabled = enabled === true;
        if (this.settings.darkModeEnabled !== newEnabled) {
            this.settings.darkModeEnabled = newEnabled;
            this._saveSettings();
            this.modules.uiManagerFacade.applyDarkMode(newEnabled);
            // console.log(`Setting Dark Mode applied: ${newEnabled}`); // Debug
        }
    }

     setHintVisible(visible) {
        const newVisible = visible === true;
        if (this.settings.hintVisible !== newVisible) {
            this.settings.hintVisible = newVisible;
            this._saveSettings();
            this.modules.gameScreen.setHintVisibility(newVisible); // Apply directly to game screen
             // console.log(`Setting Hint Visible applied: ${newVisible}`); // Debug
        }
    }

    setKeyMappings(mappings) {
         if (mappings && typeof mappings.dit === 'string' && typeof mappings.dah === 'string') {
             const newDit = mappings.dit.trim();
             const newDah = mappings.dah.trim();
             // Validate: not empty, not identical
             if (newDit && newDah && newDit !== newDah) {
                 if (this.settings.ditKey !== newDit || this.settings.dahKey !== newDah) {
                    this.settings.ditKey = newDit;
                    this.settings.dahKey = newDah;
                    this._saveSettings();
                    this.modules.inputHandler.updateKeyMappings(this.getKeyMappings());
                     // console.log(`Setting Key Mappings applied: Dit='${newDit}', Dah='${newDah}'`); // Debug
                     // Update settings modal UI immediately if it exists
                     this.modules.settingsModalUI?.updateDisplayValues(this.settings);
                 }
             } else {
                 console.warn("SettingsManager: Invalid key mapping received in setKeyMappings.", mappings);
             }
         } else {
              console.warn("SettingsManager: Invalid key mapping object structure.", mappings);
         }
    }

    /** Resets settings to defaults and applies them. */
    resetToDefaults() {
         console.log("Resetting settings to defaults...");
         this.settings = {
            wpm: DEFAULT_WPM, frequency: AUDIO_DEFAULT_TONE_FREQUENCY, volume: AUDIO_DEFAULT_VOLUME,
            soundEnabled: true, darkModeEnabled: false, hintVisible: HINT_DEFAULT_VISIBLE,
            ditKey: KEYBINDING_DEFAULTS.dit, dahKey: KEYBINDING_DEFAULTS.dah
         };
         this._saveSettings();
         this.applySettings();
         // Update settings modal UI if provided
         this.modules.settingsModalUI?.updateDisplayValues(this.settings);
    }
}

// Example Usage (in main.js):
// import { SettingsManager } from './settingsManager.js';
// // Assuming instances of morseDecoder, tonePlayer, etc., exist
// const modules = { morseDecoder, tonePlayer, sequencePlayer, inputHandler, uiManagerFacade, gameScreen, audioCtxManager, settingsModalUI };
// const settingsManager = new SettingsManager(modules);
// // Get settings: const currentSettings = settingsManager.getSettings();
// // Set a setting: settingsManager.setWpm(25);