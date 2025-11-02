import applicationFunctionManager from "./appFuncManager.js";

/**
 * Asynchronously fetch English translation file
 * @returns {Promise<Object>} - Translation object
 */
async function fetchTranslations() {
    try {
        const response = await fetch('/scripts/extensions/third-party/st-memory-enhancement/assets/locales/en.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading English translations:', error);
        return {};
    }
}

/**
 * Apply translations to DOM elements
 * @param {Object} translations - Translation object
 */
function applyTranslations(translations) {
    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            if (element.hasAttribute('title')) {
                element.setAttribute('title', translations[key]);
            } else {
                element.textContent = translations[key];
            }
        }
    });

    // Translate specific elements by selector
    const selectorTranslations = {
        '#table_clear_up a': 'Reorganize tables now',
        '#dataTable_to_chat_button a': 'Edit style of tables rendered in conversation'
    };

    for (const [selector, key] of Object.entries(selectorTranslations)) {
        if (translations[key]) {
            document.querySelectorAll(selector).forEach(el => {
                el.textContent = translations[key];
            });
        }
    }
}

/**
 * Main function to load English translations and apply them to the DOM
 */
export async function executeTranslation() {
    const translations = await fetchTranslations();

    if (Object.keys(translations).length === 0) {
        console.warn("No English translations loaded.");
        return;
    }

    applyTranslations(translations);
    console.log("English translation applied.");
}
