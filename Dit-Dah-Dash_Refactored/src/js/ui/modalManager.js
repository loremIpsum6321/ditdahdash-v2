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

        if (!this.modalElement || !this.closeButton || !this.headerElement) {
            console.error(`Modal initialization failed: Modal ('${modalId}'), Close Button ('${closeButtonId}'), or Header ('${headerId}') not found.`);
            return;
        }
        if (openButtonId && !this.openButton) {
             console.warn(`Modal initialization warning: Open Button ('${openButtonId}') not found.`);
        }

        this._bindEvents();
        // Initial position is set on open, not constructor, to ensure it's centered each time
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
                 // If click is on content, stop propagation so header drag doesn't start
                 // e.stopPropagation(); // This might prevent clicks on content buttons/inputs? Test needed.
             }
        });


        // Touch events
        this.headerElement.addEventListener('touchstart', this._dragStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this._drag.bind(this), { passive: false }); // Listen on document
        document.addEventListener('touchend', this._dragEnd.bind(this));   // Listen on document
    }

     /**
     * Sets the initial position (centered) when the modal is opened.
     * Ensures transform is cleared if position was set manually by dragging.
     * @private
     */
     _setInitialPosition() {
         if (!this.modalElement) return;

         // Check if style.left/top have been set (indicating it was dragged)
         const hasBeenDragged = this.modalElement.style.left || this.modalElement.style.top;

         if (!hasBeenDragged) {
            // Center using transform only if not dragged previously
            this.modalElement.style.left = '50%';
            this.modalElement.style.top = '50%';
            this.modalElement.style.transform = 'translate(-50%, -50%)';
         } else {
             // If left/top *are* set, ensure transform is removed as we position via pixels
             this.modalElement.style.transform = '';
         }
     }

    /**
     * Opens the modal.
     */
    open() {
        if (!this.modalElement) return;
        this.modalElement.classList.remove('hidden');
        this._setInitialPosition(); // Recenter or ensure position is correct on open
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
     * Uses pageX/pageY for robust offset calculation across scrolling.
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
        this.modalElement.style.cursor = 'grabbing'; // Indicate dragging on modal
        this.headerElement.style.cursor = 'grabbing'; // Indicate dragging on header

        let pointerX, pointerY;
        if (e.type === "touchstart") {
            if (e.touches.length !== 1) { // Only support single touch drag
                this._dragEnd(e); return;
            }
            pointerX = e.touches[0].pageX; // Use pageX for touch relative to document
            pointerY = e.touches[0].pageY; // Use pageY for touch relative to document
            e.preventDefault(); // Prevent page scroll/zoom during touch drag on header
        } else {
            // Only handle left mouse button for dragging
            if (e.button !== 0) {
                 this.isDragging = false; // Don't start drag for other buttons
                 return;
            }
            pointerX = e.pageX; // Use pageX for mouse relative to document
            pointerY = e.pageY; // Use pageY for mouse relative to document
        }

        // --- Refined Offset Calculation ---
        // Remove transform to work reliably with pixel values via getBoundingClientRect
        this.modalElement.style.transform = '';

        // Get the current pixel position relative to viewport
        const rect = this.modalElement.getBoundingClientRect();
        // Convert viewport-relative rect.left/top to document-relative positions by adding scroll offset
        this.initialModalX = rect.left + window.scrollX;
        this.initialModalY = rect.top + window.scrollY;

        // Calculate offset from the modal's document-relative top-left corner to the pointer's document position
        this.offsetX = pointerX - this.initialModalX;
        this.offsetY = pointerY - this.initialModalY;

        // Set position explicitly using pixels immediately to prevent jump on first move
        this.modalElement.style.left = `${this.initialModalX}px`;
        this.modalElement.style.top = `${this.initialModalY}px`;
        // --- End Refinement ---
    }


    /**
     * Handles the drag movement (mousemove/touchmove).
     * Calculates new position based on pointer movement and initial offset.
     * @param {MouseEvent | TouchEvent} e - The event object.
     * @private
     */
    _drag(e) {
        if (!this.isDragging || !this.modalElement) return;

        // Prevent default actions like text selection during mouse drag
        if (e.type === "mousemove") {
            e.preventDefault();
        }

        let pointerX, pointerY;
        if (e.type === "touchmove") {
             if (e.touches.length !== 1) { // Ensure still single touch
                 this._dragEnd(e); return;
             }
             pointerX = e.touches[0].pageX; // Use pageX for touch
             pointerY = e.touches[0].pageY; // Use pageY for touch
             // preventDefault is handled in dragStart for touch
        } else {
            pointerX = e.pageX; // Use pageX for mouse
            pointerY = e.pageY; // Use pageY for mouse
        }

        // Calculate new top-left corner position based on current pointer and initial offset
        let newX = pointerX - this.offsetX;
        let newY = pointerY - this.offsetY;

        // Basic boundary check to keep modal roughly within viewport edges
        // Note: This is a simple check and might not be perfect with zooming/complex layouts
        const modalWidth = this.modalElement.offsetWidth;
        const modalHeight = this.modalElement.offsetHeight;
        const minX = 0; // Limit left edge to viewport left
        const minY = 0; // Limit top edge to viewport top
        // Limit right edge (modal's left + width) to viewport width
        const maxX = window.innerWidth - modalWidth;
        // Limit bottom edge (modal's top + height) to viewport height
        const maxY = window.innerHeight - modalHeight;

        // Adjust for scrolling position to compare against document coordinates
        const docMinX = window.scrollX + minX;
        const docMinY = window.scrollY + minY;
        const docMaxX = window.scrollX + maxX;
        const docMaxY = window.scrollY + maxY;

        // Clamp the calculated newX/newY within document bounds
        newX = Math.max(docMinX, Math.min(newX, docMaxX));
        newY = Math.max(docMinY, Math.min(newY, docMaxY));

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
         }
    }

    /**
     * Sets the position of the modal element using left/top styles (in pixels).
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