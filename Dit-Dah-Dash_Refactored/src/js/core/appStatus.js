// Dit-Dah-Dash_Refactored/src/js/core/appStatus.js

/**
 * js/core/appStatus.js
 * --------------------
 * Defines the possible operational modes and status states for the application.
 * Extracted from the original gameState.js.
 */

// Defines the possible states of the application (focusing on activity)
export const GameStatus = Object.freeze({
    IDLE: 'idle',                   // App is idle, main menu likely shown
    MENU: 'menu',                   // Main menu is actively displayed
    SETTINGS: 'settings',           // Settings modal is open
    LEVEL_SELECT: 'level_select',   // Level selection screen is active
    READY: 'ready',                 // Sentence loaded (game/sandbox), waiting for first input
    LISTENING: 'listening',         // Actively listening for first dit/dah (game/sandbox)
    TYPING: 'typing',               // Receiving dits/dahs for current character (game/sandbox)
    DECODING: 'decoding',           // Short pause after last input, deciding character (game/sandbox)
    FINISHED: 'finished',           // Sentence completed calculation phase (game/sandbox)
    SHOWING_RESULTS: 'showing_results', // Results screen is active (game/sandbox)
    PLAYBACK_INPUT: 'playback_input', // Playback screen is shown, waiting for input/play
    PLAYING_BACK: 'playing_back',     // Audio playback is active (playback)
    SANDBOX_INPUT: 'sandbox_input', // Sandbox setup screen is active
    PAUSED: 'paused'                // (Optional) Game paused state
});

// Defines the current operational mode
export const AppMode = Object.freeze({
    MENU: 'menu',
    SETTINGS: 'settings',   // Indicates the settings modal is the focus
    GAME: 'game',           // Standard level progression
    SANDBOX: 'sandbox',     // Custom sentence practice
    PLAYBACK: 'playback'    // Sentence audio playback tool
});

// Example of how other modules would import and use these:
// import { GameStatus, AppMode } from './appStatus.js';
// if (gameState.status === GameStatus.READY) { ... }