import applicationFunctionManager from "./appFuncManager.js";

let _translations = null;

async function fetchTranslations() {
    try {
        const response = await fetch('/scripts/extensions/third-party/st-memory-enhancement/assets/locales/en.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading English translations:', error);
        return {};
    }
}

function applyTranslations(translations) {
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

async function getTranslations() {
    if (_translations) return _translations;
    _translations = await fetchTranslations();
    return _translations;
}

export async function executeTranslation() {
    const translations = await getTranslations();
    if (Object.keys(translations).length === 0) {
        console.warn("No English translations loaded.");
        return;
    }
    applyTranslations(translations);
    console.log("English translation applied.");
}

export async function translating(targetScope, source) {
    return source;
}

export async function switchLanguage(targetScope, source) {
    return source;
}
