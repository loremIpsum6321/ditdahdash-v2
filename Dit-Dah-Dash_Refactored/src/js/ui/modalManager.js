// Dit-Dah-Dash_Refactored/src/js/ui/modalManager.js

/**
 * js/ui/modalManager.js
 * ---------------------
 * Handles basic modal functionality including showing, hiding,
 * and simple drag-and-drop for a modal window.
 * Adapted from the original modal.js.
 */

export class Modal {
    /**
     * Initializes the Modal instance.
     * @param {string} modalId - The ID of the modal container element.
     * @param {string} openButtonId - The ID of the button that opens the modal (or null if opened programmatically).
     * @param {string} closeButtonId - The ID of the button that closes the modal.
     * @param {string} headerId - The ID of the modal header element (for dragging).
     * @param {function} [onOpen] - Optional callback when modal opens.
     * @param {function} [onClose] - Optional callback when modal closes.
     */
    constructor(modalId, openButtonId, closeButtonId, headerId, onOpen, onClose) {
        this.modalElement = document.getElementById(modalId);
        // openButton can be optional
        this.openButton = openButtonId ? document.getElementById(openButtonId) : null;
        this.closeButton = document.getElementById(closeButtonId);
        this.headerElement = document.getElementById(headerId);
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.isDragging = false;
        // Store initial offset from top-left corner of modal to mouse pointer
        this.offsetX = 0;
        this.offsetY = 0;
        // Store initial modal position to avoid recalculating bounds constantly
        this.initialModalX = 0;
        this.initialModalY = 0;
        // Track if the modal has been dragged since last opened
        this.hasBeenDraggedSinceOpen = false;

        if (!this.modalElement || !this.closeButton || !this.headerElement) {
            console.error(`Modal initialization failed: Modal ('${modalId}'), Close Button ('${closeButtonId}'), or Header ('${headerId}') not found.`);
            return;
        }
        if (openButtonId && !this.openButton) {
             console.warn(`Modal initialization warning: Open Button ('${openButtonId}') not found.`);
        }

        this._bindEvents();
        // Initial position is set on open, not constructor
    }

    /**
     * Binds necessary event listeners for opening, closing, and dragging.
     * @private
     */
    _bindEvents() {
        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }
        this.closeButton.addEventListener('click', this.close.bind(this));

        // Close on Escape key
        window.addEventListener('keydown', (e) => {
            // Check if modal is visible (doesn't have 'hidden' class)
            if (e.key === 'Escape' && this.modalElement && !this.modalElement.classList.contains('hidden')) {
                this.close();
            }
        });

        // Drag events
        this.headerElement.addEventListener('mousedown', this._dragStart.bind(this));
        document.addEventListener('mousemove', this._drag.bind(this)); // Listen on document
        document.addEventListener('mouseup', this._dragEnd.bind(this));   // Listen on document

        // Prevent mouse drag interfering with text selection inside modal content
        this.modalElement.addEventListener('mousedown', (e) => {
             // Allow drag only if target is the header or within the header
             if (!(e.target === this.headerElement || this.headerElement.contains(e.target))) {
                 // Stop clicks in content from initiating a drag
                 e.stopPropagation();
             }
        });


        // Touch events
        this.headerElement.addEventListener('touchstart', this._dragStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this._drag.bind(this), { passive: false }); // Listen on document
        document.addEventListener('touchend', this._dragEnd.bind(this));   // Listen on document
    }

     /**
     * Sets the initial position when the modal is opened.
     * Centers using transform if not previously dragged, otherwise restores pixel position.
     * @private
     */
     _setInitialPosition() {
         if (!this.modalElement) return;

         // Reset drag flag on open
         this.hasBeenDraggedSinceOpen = false;

         // Check if style.left/top have been set (indicating it was dragged last time)
         const hasPixelPosition = this.modalElement.style.left || this.modalElement.style.top;

         if (!hasPixelPosition) {
            // Center using transform only if no pixel position is set
            this.modalElement.style.left = '50%';
            this.modalElement.style.top = '50%';
            this.modalElement.style.transform = 'translate(-50%, -50%)';
            // console.log("Modal: Centering with transform."); // Debug
         } else {
             // If left/top *are* set, ensure transform is removed
             this.modalElement.style.transform = '';
             // console.log(`Modal: Restoring pixel position: left=${this.modalElement.style.left}, top=${this.modalElement.style.top}`); // Debug
         }
     }

    /**
     * Opens the modal.
     */
    open() {
        if (!this.modalElement) return;
        this._setInitialPosition(); // Set position *before* removing hidden class
        this.modalElement.classList.remove('hidden');
        if (typeof this.onOpen === 'function') {
            try {
                this.onOpen();
            } catch (e) {
                console.error("Error in modal onOpen callback:", e);
            }
        }
        // console.log("Modal opened"); // Debug
    }

    /**
     * Closes the modal.
     */
    close() {
        if (!this.modalElement) return;
        this.modalElement.classList.add('hidden');
        if (typeof this.onClose === 'function') {
             try {
                this.onClose();
             } catch (e) {
                 console.error("Error in modal onClose callback:", e);
             }
        }
        // Reset drag flag on close, position will be recalculated on next open
        this.hasBeenDraggedSinceOpen = false;
        // console.log("Modal closed"); // Debug
    }

    /**
     * Checks if the modal is currently visible.
     * @returns {boolean} True if the modal is open/visible, false otherwise.
     */
    isOpen() {
        return this.modalElement && !this.modalElement.classList.contains('hidden');
    }

    /**
     * Handles the start of a drag operation (mousedown/touchstart).
     * Calculates offsets correctly whether initially centered or pixel-positioned.
     * @param {MouseEvent | TouchEvent} e - The event object.
     * @private
     */
    _dragStart(e) {
        // Ensure drag starts only on the header itself or its children
        if (!(e.target === this.headerElement || this.headerElement.contains(e.target))) {
            return;
        }
        if (!this.modalElement) return;

        this.isDragging = true;
        this.modalElement.style.cursor = 'grabbing';
        this.headerElement.style.cursor = 'grabbing';
        this.hasBeenDraggedSinceOpen = true; // Mark as dragged

        let pointerX, pointerY;
        if (e.type === "touchstart") {
            if (e.touches.length !== 1) { this._dragEnd(e); return; }
            pointerX = e.touches[0].pageX;
            pointerY = e.touches[0].pageY;
            e.preventDefault();
        } else {
            if (e.button !== 0) { this.isDragging = false; return; }
            pointerX = e.pageX;
            pointerY = e.pageY;
        }

        // --- Calculate Initial Position and Offset ---
        // 1. Get current visual position (accounts for transform or pixel pos)
        const rect = this.modalElement.getBoundingClientRect();
        const currentModalDocX = rect.left + window.scrollX;
        const currentModalDocY = rect.top + window.scrollY;

        // 2. Calculate offset from current top-left to pointer
        this.offsetX = pointerX - currentModalDocX;
        this.offsetY = pointerY - currentModalDocY;

        // 3. Immediately switch to pixel positioning to avoid jump
        // Remove transform *if it exists*
        this.modalElement.style.transform = '';
        // Set position using calculated document coordinates
        this.modalElement.style.left = `${currentModalDocX}px`;
        this.modalElement.style.top = `${currentModalDocY}px`;
        // --- End Calculation ---
        // console.log(`Drag Start: Initial Pos (${currentModalDocX.toFixed(0)}, ${currentModalDocY.toFixed(0)}), Offset (${this.offsetX.toFixed(0)}, ${this.offsetY.toFixed(0)})`); // Debug
    }


    /**
     * Handles the drag movement (mousemove/touchmove).
     * Calculates new position based on pointer movement and initial offset.
     * @param {MouseEvent | TouchEvent} e - The event object.
     * @private
     */
    _drag(e) {
        if (!this.isDragging || !this.modalElement) return;

        if (e.type === "mousemove") {
            e.preventDefault();
        }

        let pointerX, pointerY;
        if (e.type === "touchmove") {
             if (e.touches.length !== 1) { this._dragEnd(e); return; }
             pointerX = e.touches[0].pageX;
             pointerY = e.touches[0].pageY;
        } else {
            pointerX = e.pageX;
            pointerY = e.pageY;
        }

        // Calculate new top-left corner position based on current pointer and initial offset
        let newX = pointerX - this.offsetX;
        let newY = pointerY - this.offsetY;

        // --- Boundary Check (Keep modal roughly within viewport) ---
        // Simplified check: ensure top-left corner stays within scrollable document area
        // A more sophisticated check might consider the entire modal dimensions vs viewport
        const docWidth = document.documentElement.scrollWidth;
        const docHeight = document.documentElement.scrollHeight;
        const modalWidth = this.modalElement.offsetWidth;
        const modalHeight = this.modalElement.offsetHeight;

        // Clamp X: Ensure left edge > 0 and right edge < docWidth
        newX = Math.max(0, Math.min(newX, docWidth - modalWidth));
        // Clamp Y: Ensure top edge > 0 and bottom edge < docHeight
        newY = Math.max(0, Math.min(newY, docHeight - modalHeight));

        // Alternative simpler boundary check: keep within viewport (less robust with scrolling)
        // const vpWidth = window.innerWidth;
        // const vpHeight = window.innerHeight;
        // newX = Math.max(window.scrollX, Math.min(newX, window.scrollX + vpWidth - modalWidth));
        // newY = Math.max(window.scrollY, Math.min(newY, window.scrollY + vpHeight - modalHeight));

        // Apply the calculated position
        this._setPosition(newX, newY);
    }

    /**
     * Handles the end of a drag operation (mouseup/touchend).
     * @param {MouseEvent | TouchEvent} e - The event object.
     * @private
     */
    _dragEnd(e) {
        if (this.isDragging) {
             this.isDragging = false;
             if (this.modalElement) this.modalElement.style.cursor = ''; // Reset cursor on modal
             if (this.headerElement) this.headerElement.style.cursor = 'move'; // Reset header cursor
             // Position is already set in pixels by _drag
             // console.log(`Drag End: Final Pos (${this.modalElement.style.left}, ${this.modalElement.style.top})`); // Debug
         }
    }

    /**
     * Sets the position of the modal element using left/top styles (in pixels).
     * Ensures transform is cleared.
     * @param {number} xPos - The target X coordinate (document-relative).
     * @param {number} yPos - The target Y coordinate (document-relative).
     * @private
     */
    _setPosition(xPos, yPos) {
        if (!this.modalElement) return;
        this.modalElement.style.left = `${xPos}px`;
        this.modalElement.style.top = `${yPos}px`;
        // Ensure transform is cleared as we are using left/top for positioning
        this.modalElement.style.transform = '';
    }
}

// Example Usage (in another module):
// import { Modal } from './modalManager.js';
// const settingsModal = new Modal(
//     'settings-modal-id',
//     'open-settings-button-id', // Can be null if opened programmatically
//     'close-settings-button-id',
//     'settings-modal-header-id',
//     () => { console.log("Settings modal opened"); },
//     () => { console.log("Settings modal closed"); }
// );
// settingsModal.open(); // To open programmatically