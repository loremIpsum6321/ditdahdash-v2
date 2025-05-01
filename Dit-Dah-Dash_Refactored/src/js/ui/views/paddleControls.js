// Dit-Dah-Dash_Refactored/src/js/ui/views/paddleControls.js

import { getElementByIdSafe, enableElement, disableElement, setTextContent } from '../domUtils.js';
import { STORAGE_KEYS } from '../../core/configConstants.js';
import { AppMode } from '../../core/appStatus.js'; // Needed for updatePaddleLabels logic

/**
 * js/ui/views/paddleControls.js
 * -----------------------------
 * Manages the UI and interactions for the Dit and Dah paddle buttons,
 * including labels, active states, and texture drag-and-drop.
 */

export class PaddleControls {
    constructor() {
        this.ditButton = getElementByIdSafe('dit-button');
        this.dahButton = getElementByIdSafe('dah-button');
        this.ditPaddleLabel = this.ditButton?.querySelector('.paddle-label');
        this.dahPaddleLabel = this.dahButton?.querySelector('.paddle-label');
        // SVGs might not be needed directly if only label/class changes
        // this.ditPaddleSvg = this.ditButton?.querySelector('.paddle-svg');
        // this.dahPaddleSvg = this.dahButton?.querySelector('.paddle-svg');

        this.paddleTextures = { dit: null, dah: null }; // In-memory store

        if (!this.ditButton || !this.dahButton || !this.ditPaddleLabel || !this.dahPaddleLabel) {
            console.error("PaddleControls: Could not find all required paddle elements (buttons/labels). Check IDs.");
        }

        this._loadPaddleTextures(); // Load saved textures on init
        this._addDragDropListeners();
        console.log("PaddleControls Initialized.");
    }

    /**
     * Sets the visual active state of a paddle button.
     * @param {'dit' | 'dah'} buttonType - Which paddle to modify.
     * @param {boolean} isActive - True to set active, false to set inactive.
     */
    setButtonActive(buttonType, isActive) {
        const button = buttonType === 'dit' ? this.ditButton : this.dahButton;
        if (button) {
            button.classList.toggle('active', isActive);
        }
    }

    /**
     * Updates paddle labels and enabled state for game vs results mode.
     * @param {'game' | 'results'} mode - The current UI mode for the paddles.
     * @param {boolean} [hasNextLevel=false] - Whether a 'Next' option is available (only relevant in results mode).
     * @param {AppMode} [gameMode=AppMode.GAME] - The overall game mode (GAME or SANDBOX).
     */
    updatePaddleLabels(mode, hasNextLevel = false, gameMode = AppMode.GAME) {
        const buttons = [this.ditButton, this.dahButton];
        const labels = [this.ditPaddleLabel, this.dahPaddleLabel];

        if (!buttons[0] || !buttons[1] || !labels[0] || !labels[1]) return;

        if (mode === 'results') {
            setTextContent(labels[0], "Retry"); // Dit = Retry
            setTextContent(labels[1], "Next");  // Dah = Next
            const isNextDisabled = (gameMode === AppMode.SANDBOX || !hasNextLevel);

            enableElement(buttons[0]); // Retry always enabled
            if (isNextDisabled) {
                disableElement(buttons[1]);
            } else {
                enableElement(buttons[1]);
            }
            buttons.forEach(btn => btn?.classList.add('results-label-active'));
        } else { // Game mode
            setTextContent(labels[0], ""); // Clear labels for game mode
            setTextContent(labels[1], "");
            enableElement(buttons[0], buttons[1]); // Ensure both are enabled
            buttons.forEach(btn => btn?.classList.remove('results-label-active'));
        }
    }

    // --- Paddle Texture Drag and Drop ---
    _loadPaddleTextures() {
        try {
            const savedTextures = localStorage.getItem(STORAGE_KEYS.PADDLE_TEXTURES);
            if (savedTextures) {
                const parsedTextures = JSON.parse(savedTextures);
                // Validate before applying
                if (parsedTextures?.dit && typeof parsedTextures.dit === 'string') {
                    this._applyTexture(this.ditButton, parsedTextures.dit);
                    this.paddleTextures.dit = parsedTextures.dit;
                }
                if (parsedTextures?.dah && typeof parsedTextures.dah === 'string') {
                    this._applyTexture(this.dahButton, parsedTextures.dah);
                    this.paddleTextures.dah = parsedTextures.dah;
                }
                // console.log("Paddle textures loaded:", this.paddleTextures);
            }
        } catch (e) {
            console.error("Error loading paddle textures:", e);
            this.paddleTextures = { dit: null, dah: null };
            localStorage.removeItem(STORAGE_KEYS.PADDLE_TEXTURES); // Clear corrupted data
        }
    }

    _savePaddleTextures() {
        try {
            localStorage.setItem(STORAGE_KEYS.PADDLE_TEXTURES, JSON.stringify(this.paddleTextures));
            // console.log("Paddle textures saved:", this.paddleTextures);
        } catch (e) {
            console.error("Error saving paddle textures:", e);
        }
    }

    _addDragDropListeners() {
        [this.ditButton, this.dahButton].forEach(paddle => {
            if (paddle) {
                paddle.addEventListener('dragover', this._handleDragOver.bind(this));
                paddle.addEventListener('dragleave', this._handleDragLeave.bind(this));
                paddle.addEventListener('drop', this._handleDrop.bind(this));
                // Optional: Add a way to clear the texture, e.g., right-click?
                paddle.addEventListener('contextmenu', (e) => {
                     e.preventDefault(); // Prevent default context menu
                     if (paddle.classList.contains('has-texture')) {
                        if (confirm(`Remove custom texture from ${paddle.id === 'dit-button' ? 'Dit' : 'Dah'} paddle?`)) {
                            this._removeTexture(paddle);
                        }
                     }
                });
            }
        });
         console.log("PaddleControls: Drag/drop listeners added.");
    }

    _handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        const paddle = event.currentTarget;
        if (paddle instanceof HTMLElement) {
            paddle.classList.add('drag-over');
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
            }
        }
    }

    _handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        const paddle = event.currentTarget;
         if (paddle instanceof HTMLElement) {
            paddle.classList.remove('drag-over');
        }
    }

    _handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const paddle = event.currentTarget;
        if (!(paddle instanceof HTMLElement)) return;

        paddle.classList.remove('drag-over');
        const paddleType = paddle.id === 'dit-button' ? 'dit' : 'dah';

        const dt = event.dataTransfer;
        if (!dt) return;
        const files = dt.files;

        // Handle dropped files (preferred)
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataUrl = e.target?.result;
                    if (imageDataUrl && typeof imageDataUrl === 'string') {
                        this._applyTexture(paddle, imageDataUrl);
                        this.paddleTextures[paddleType] = imageDataUrl;
                        this._savePaddleTextures();
                        // console.log(`Applied file texture to ${paddleType} paddle: ${file.name}`);
                    } else {
                         alert("Could not read image file data.");
                    }
                };
                 reader.onerror = () => {
                      alert("Error reading image file.");
                 };
                reader.readAsDataURL(file);
            } else {
                alert("Please drop an image file (e.g., JPG, PNG, GIF, SVG).");
            }
        }
        // Handle dropped URLs or HTML image elements as fallback
        else {
            let imageUrl = dt.getData('text/uri-list') || dt.getData('URL');
            if (!imageUrl) {
                 const htmlData = dt.getData('text/html');
                 if (htmlData) {
                     try {
                        // More robust parsing: create a temporary element
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = htmlData;
                        const imgElement = tempDiv.querySelector('img');
                        if (imgElement) imageUrl = imgElement.src;
                     } catch(e) { console.error("Error parsing dropped HTML for image", e); }
                 }
            }

            // Validate and apply the found URL
            if (imageUrl && typeof imageUrl === 'string' && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image'))) {
                this._applyTexture(paddle, imageUrl);
                this.paddleTextures[paddleType] = imageUrl;
                this._savePaddleTextures();
                // console.log(`Applying URL/HTML texture to ${paddleType} paddle: ${imageUrl.substring(0,100)}...`);
            } else {
                 alert("Could not get a valid image URL from the dropped item. Try dropping an image file directly.");
            }
        }
    }

    _applyTexture(paddleElement, imageUrl) {
        if (!paddleElement || !imageUrl) return;
        // Use CSS variable or direct style for background image
        paddleElement.style.backgroundImage = `url('${imageUrl}')`;
        paddleElement.classList.add('has-texture');
        // console.log("Texture applied to:", paddleElement.id);
    }

    _removeTexture(paddleElement) {
         if (!paddleElement) return;
         paddleElement.style.backgroundImage = 'none';
         paddleElement.classList.remove('has-texture');
         const paddleType = paddleElement.id === 'dit-button' ? 'dit' : 'dah';
         if (paddleType) {
            this.paddleTextures[paddleType] = null;
            this._savePaddleTextures();
         }
        // console.log("Texture removed from:", paddleElement.id);
    }
    /** Resets paddle textures to default (none) and clears storage. */
    resetPaddleTextures() {
        console.log("Resetting paddle textures..."); // Debug
        this._removeTexture(this.ditButton);
        this._removeTexture(this.dahButton);
        // Clear internal state
        this.paddleTextures.dit = null;
        this.paddleTextures.dah = null;
        // Remove from local storage
        try {
            localStorage.removeItem(STORAGE_KEYS.PADDLE_TEXTURES);
        } catch (e) {
            console.error("Error removing paddle textures from localStorage:", e);
        }
    }
    // --- End Paddle Texture Drag and Drop ---

}

// Example Usage (in main.js or uiManagerFacade.js):
// import { PaddleControls } from './views/paddleControls.js';
// const paddleControls = new PaddleControls();
// paddleControls.setButtonActive('dit', true);
// paddleControls.updatePaddleLabels('results', true, AppMode.GAME);