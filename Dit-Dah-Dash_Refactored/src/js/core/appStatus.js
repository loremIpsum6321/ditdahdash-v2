// Dit-Dah-Dash_Refactored/src/js/core/appStatus.js
//js/core/appStatus.js


// Defines the possible states of the application (focusing on activity)
export const GameStatus = Object.freeze({
    IDLE: 'idle',                   // App is idle, main menu likely shown
    MENU: 'menu',                   // Main menu is actively displayed
    SETTINGS: 'settings',           // Settings modal is open
    LEVEL_SELECT: 'level_select',   // Level selection screen is active
    READY: 'ready',                 // Sentence loaded (game/sandbox/loremipsum), waiting for first input
    LISTENING: 'listening',         // Actively listening for first dit/dah (game/sandbox/loremipsum)
    TYPING: 'typing',               // Receiving dits/dahs for current character (game/sandbox/loremipsum)
    DECODING: 'decoding',           // Short pause after last input, deciding character (game/sandbox/loremipsum)
    FINISHED: 'finished',           // Sentence completed calculation phase (game/sandbox/loremipsum)
    SHOWING_RESULTS: 'showing_results', // Results screen is active (game/sandbox) - Note: LoremIpsum might not show results
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
    LOREM_IPSUM: 'lorem_ipsum' // Lorem Ipsum word generation mode (Renamed from ENDLESS)
});

// Example of how other modules would import and use these:
// import { GameStatus, AppMode } from './appStatus.js';
// if (gameState.status === GameStatus.READY) { ... }
// if (gameState.currentMode === AppMode.LOREM_IPSUM) { ... }