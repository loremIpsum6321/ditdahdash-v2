/*

    // Dit-Dah-Dash_Refactored/src/js/core/configConstants.js

    """
    js/core/configConstants.js
    --------------------------
    Core configuration constants for the Dit-Dah-Dash game.
    Extracted from original config.js. Excludes level data.
    Includes Morse code mappings, timing defaults, audio defaults,
    storage keys, keybinding defaults, and UI settings.
    """

    // --- Morse Code Mapping ---
    // Includes letters, numbers, common punctuation, and some prosigns/abbreviations.
    // Prosigns are represented within angle brackets <> for clarity.
*/
export const MORSE_MAP = Object.freeze({
    // Letters
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z',
    // Numbers
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
    '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
    // Punctuation
    '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'", '-.-.--': '!',
    '-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&', '---...': ':',
    '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_',
    '.-..-.': '"', '...-..-': '$', '.--.-.': '@',
    // Prosigns / Abbreviations
    '...---...': '<SOS>', // Distress Signal
    '.-.-.': '<AR>',    // End of Message / New Page
    '...-.': '<AS>',    // Wait
    '-.-.-': '<BT>',    // Pause / Separator (like '=')
    '.-...': '<CT>',    // Start Copying / Attention (often KA) - Using CT representation
    '........': '<HH>',  // Error / Correction
    '-.-': '<KN>',    // Invite Specific Station (often just K) - Use if needed
    '...-.-': '<SK>',    // End of Contact / End of Work
    '-.--.' : '<SN>'    // Understood (often VE) - Use if needed
});

// --- Timing Configuration ---
export const DEFAULT_WPM = 20;
export const PARIS_STANDARD_WORD_LENGTH = 5;
export const DIT_DURATION_UNITS = 1;
export const DAH_DURATION_UNITS = 3;
export const INTRA_CHARACTER_GAP_UNITS = 1; // Gap between elements within a character
export const INTER_CHARACTER_GAP_UNITS = 3; // Gap between characters in a word
export const WORD_GAP_UNITS = 7;            // Gap between words
// Multipliers influencing timing logic (e.g., how long decoder waits)
export const INTRA_CHAR_GAP_MULTIPLIER = 0.8;
export const CHARACTER_INPUT_TIMEOUT_MULTIPLIER = 0.8;

// --- Audio Configuration ---
export const AUDIO_DEFAULT_TONE_FREQUENCY = 400; // Default frequency in Hz
export const AUDIO_RAMP_TIME = 0.005;          // Fade in/out time for tones (seconds)
export const AUDIO_MIN_FREQUENCY = 200;          // Minimum adjustable frequency
export const AUDIO_MAX_FREQUENCY = 1000;         // Maximum adjustable frequency
export const AUDIO_DEFAULT_VOLUME = 1.0;           // Default volume (0.0 to 1.0)

// --- Scoring ---
export const INCORRECT_ATTEMPT_PENALTY = 0.1; // Penalty multiplier for accuracy calculation

// --- Keybindings ---
// Default keys if not found in localStorage or on reset
export const KEYBINDING_DEFAULTS = Object.freeze({
    dit: '.',
    dah: '-'
});

// Key display mapping for settings UI
export const KEYBIND_DISPLAY_MAP = Object.freeze({
    ' ': 'Space', '.': '.', '-': '-', 'Enter': 'Enter', 'Shift': 'Shift',
    'Control': 'Ctrl', 'Alt': 'Alt', 'Meta': 'Cmd/Win',
    'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
    // Add more mappings as needed
});
// Function to get displayable key name (exported for use in UI modules)
export const getKeyDisplay = (key) => {
    if (!key) return '';
    return KEYBIND_DISPLAY_MAP[key] || key.toUpperCase();
};

// --- Local Storage Keys ---
const STORAGE_KEY_PREFIX = 'ditDahDash_';
export const STORAGE_KEYS = Object.freeze({
    HIGH_SCORES: `${STORAGE_KEY_PREFIX}highScores`,
    UNLOCKED_LEVELS: `${STORAGE_KEY_PREFIX}unlockedLevels`,
    SETTINGS_WPM: `${STORAGE_KEY_PREFIX}settingsWpm`,
    SETTINGS_SOUND: `${STORAGE_KEY_PREFIX}settingsSound`,
    SETTINGS_DARK_MODE: `${STORAGE_KEY_PREFIX}settingsDarkMode`,
    SETTINGS_FREQUENCY: `${STORAGE_KEY_PREFIX}settingsFrequency`,
    SETTINGS_VOLUME: `${STORAGE_KEY_PREFIX}settingsVolume`,
    SETTINGS_DIT_KEY: `${STORAGE_KEY_PREFIX}settingsDitKey`,
    SETTINGS_DAH_KEY: `${STORAGE_KEY_PREFIX}settingsDahKey`,
    SETTINGS_HINT_VISIBLE: `${STORAGE_KEY_PREFIX}settingsHintVisible`,
    PADDLE_TEXTURES: `${STORAGE_KEY_PREFIX}paddleTextures`
});

// --- UI ---
export const INCORRECT_FLASH_DURATION = 300; // ms for incorrect feedback flash
export const HINT_DEFAULT_VISIBLE = true; // Hint is visible by default for new users

// Note: LEVELS_DATA is intentionally moved to src/js/data/levelsData.js