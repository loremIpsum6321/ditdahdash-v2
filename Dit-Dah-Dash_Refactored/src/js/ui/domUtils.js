// Dit-Dah-Dash_Refactored/src/js/ui/domUtils.js

/**
 * js/ui/domUtils.js
 * -----------------
 * Provides common utility functions for interacting with the DOM.
 */

/**
 * Shows one or more DOM elements by removing the 'hidden' class.
 * @param {...(Element | null | undefined)} elements - The DOM element(s) to show. Falsy values are ignored.
 */
export function showElement(...elements) {
    elements.forEach(element => {
        if (element instanceof HTMLElement) {
            element.classList.remove('hidden');
        }
    });
}

/**
 * Hides one or more DOM elements by adding the 'hidden' class.
 * @param {...(Element | null | undefined)} elements - The DOM element(s) to hide. Falsy values are ignored.
 */
export function hideElement(...elements) {
     elements.forEach(element => {
        if (element instanceof HTMLElement) {
            element.classList.add('hidden');
        }
    });
}

/**
 * Toggles the visibility of a DOM element by toggling the 'hidden' class.
 * @param {Element | null | undefined} element - The DOM element to toggle.
 * @param {boolean} [forceShow] - Optional. If true, ensures element is shown. If false, ensures element is hidden.
 */
export function toggleElementVisibility(element, forceShow) {
     if (element instanceof HTMLElement) {
         if (typeof forceShow === 'boolean') {
            element.classList.toggle('hidden', !forceShow);
         } else {
            element.classList.toggle('hidden');
         }
    }
}

/**
 * Sets the text content of a DOM element.
 * Clears content if text is null or undefined. Uses textContent for security.
 * @param {Element | null | undefined} element - The DOM element to update.
 * @param {string | number | null | undefined} text - The text to set.
 */
export function setTextContent(element, text) {
    if (element instanceof HTMLElement) {
        element.textContent = (text === null || text === undefined) ? '' : String(text);
    }
}

/**
 * Sets the HTML content of a DOM element. Use with caution due to XSS risks.
 * Clears content if htmlString is null or undefined.
 * @param {Element | null | undefined} element - The DOM element to update.
 * @param {string | null | undefined} htmlString - The HTML string to set.
 */
export function setHtmlContent(element, htmlString) {
    if (element instanceof HTMLElement) {
        element.innerHTML = (htmlString === null || htmlString === undefined) ? '' : htmlString;
    }
}


/**
 * Enables one or more DOM elements (typically buttons or inputs).
 * @param {...(Element | null | undefined)} elements - The DOM element(s) to enable. Falsy values are ignored.
 */
export function enableElement(...elements) {
     elements.forEach(element => {
        if (element instanceof HTMLElement && 'disabled' in element) {
            element.disabled = false;
        }
    });
}

/**
 * Disables one or more DOM elements (typically buttons or inputs).
 * @param {...(Element | null | undefined)} elements - The DOM element(s) to disable. Falsy values are ignored.
 */
export function disableElement(...elements) {
     elements.forEach(element => {
        if (element instanceof HTMLElement && 'disabled' in element) {
            element.disabled = true;
        }
    });
}

/**
 * Gets a DOM element by its ID. Logs an error if not found.
 * @param {string} id - The ID of the element.
 * @returns {HTMLElement | null} The found element or null.
 */
export function getElementByIdSafe(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`DOM Utils: Element with ID '${id}' not found.`);
    }
    return element;
}

// Example Usage (in another module):
// import { showElement, hideElement, setTextContent } from './domUtils.js';
// const myButton = document.getElementById('my-button');
// const myDisplay = document.getElementById('my-display');
// hideElement(myButton);
// setTextContent(myDisplay, 'Hello World!');