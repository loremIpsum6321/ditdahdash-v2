// Dit-Dah-Dash_Refactored/src/js/core/appStatus.js
//js/core/appStatus.js


// Defines the possible states of the application (focusing on activity)
export const GameStatus = Object.freeze({
    IDLE: 'idle',                   // App is idle, main menu likely shown
    MENU: 'menu',                   // Main menu is actively displayed
    SETTINGS: 'settings',           // Settings modal is open
    LEVEL_SELECT: 'level_select',   // Level selection screen is active
    READY: 'ready',                 // Sentence loaded (game/sandbox/endless), waiting for first input
    LISTENING: 'listening',         // Actively listening for first dit/dah (game/sandbox/endless)
    TYPING: 'typing',               // Receiving dits/dahs for current character (game/sandbox/endless)
    DECODING: 'decoding',           // Short pause after last input, deciding character (game/sandbox/endless)
    FINISHED: 'finished',           // Sentence completed calculation phase (game/sandbox/endless)
    SHOWING_RESULTS: 'showing_results', // Results screen is active (game/sandbox/endless) - Note: Endless might not show results
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
    PLAYBACK: 'playback',   // Sentence audio playback tool
    ENDLESS: 'endless'      // Endless word generation mode
});

// Example of how other modules would import and use these:
// import { GameStatus, AppMode } from './appStatus.js';
// if (gameState.status === GameStatus.READY) { ... }