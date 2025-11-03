// sheetStyleEditor.js
import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../../core/manager.js';
import { initializeText, parseSheetRender, loadValueSheetBySheetHashSheet } from "../renderer/sheetCustomRenderer.js";

let elements = null;
let templateInstance = null;

// Default style configuration
const DEFAULT_STYLE = { mode: 'regex', basedOn: 'html', regex: '.*', replace: '' };

/**
 * DOM element utility functions
 */
const dom = {
    setValue: (element, value) => element.get(0).value = value,
    getValue: (element) => element.get(0).value,
    setChecked: (element, checked) => element.get(0).checked = checked,
    isChecked: (element) => element.get(0).checked,
    toggleVisibility: (element, visible) => visible ? element.show() : element.hide(),
    triggerEvent: (element, eventName) => {
        const event = new Event(eventName);
        element.get(0).dispatchEvent(event);
    },
    addOption: (select, value, text) => {
        const option = document.createElement('option');
        option.value = value;
        option.text = text || value;
        select.get(0).appendChild(option);
        return option;
    }
};

/**
 * Unified editor refresh method
 */
function refreshEditor() {
    // console.log("refreshEditor-elements.rendererDisplay exists:", !!elements.rendererDisplay);
    // console.log("jQuery object length:", elements.rendererDisplay?.length || 0);
    renderHTML();
    updateGuideContent(elements, dom.getValue(elements.matchMethod) === 'regex');
    dom.toggleVisibility(elements.table_renderer_display_container, dom.isChecked(elements.tablePreviewButton));
    dom.toggleVisibility(elements.styleEnabledView, dom.isChecked(elements.tableStyleButton));
}

// function renderHTML() {
//     const currentConfig = collectConfigThenUpdateTemplate();
//     console.log("Test", currentConfig, templateInstance)
//     if (currentConfig.useCustomStyle === true) {
//         templateInstance.tableSheet = loadValueSheetBySheetHashSheet(templateInstance);  // Modified rendering logic to render tableSheet
//         elements.rendererDisplay.html(parseSheetRender(templateInstance, currentConfig));
//     } else {
//         elements.rendererDisplay.html(templateInstance.element);
//     }
//     elements.rendererDisplay.css('white-space', 'pre-wrap');
// }

/**
 * Render HTML, fixing jQuery's internal exception when HTML contains <script> tags
 */
function renderHTML() {
    const currentConfig = collectConfigThenUpdateTemplate();
    if (!elements?.rendererDisplay?.length) return;
    templateInstance.tableSheet = loadValueSheetBySheetHashSheet(templateInstance);
    let renderedHTML = currentConfig.useCustomStyle
        ? parseSheetRender(templateInstance, currentConfig)
        : templateInstance.element;
    // When returning a replaced string, remove all <script> tags; otherwise, if it returns an array, no processing is needed
    renderedHTML = typeof renderedHTML === 'string' ? renderedHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : renderedHTML;

    // Use native method to insert
    elements.rendererDisplay[0].innerHTML = renderedHTML;
    elements.rendererDisplay.css('white-space', 'pre-wrap');
}
/**
 * Get UI element binding object
 * @param {Object} $dlg jQuery object
 */
async function getUIElements($dlg) {
    return {
        rendererDisplay: $dlg.find('#tableRendererDisplay'),
        styleEnabledView: $dlg.find('#table_style_enabled_container'),
        benchmark: $dlg.find('#push_to_chat_based_on'),
        regex: $dlg.find('#table_to_chat_regex'),
        replace: $dlg.find('#table_to_chat_replace'),
        tableToChatButton: $dlg.find('#table_to_chat_button'),
        tableStyleButton: $dlg.find('#table_style_button'),
        triggerSendToChatButton: $dlg.find('#table_triggerSendToChat_button'),
        alternateTableButton: $dlg.find('#table_alternateTable_button'),
        insertTableButton: $dlg.find('#table_insertTable_button'),
        skipTopButton: $dlg.find('#table_skipTop_button'),
        tablePreviewButton: $dlg.find('#table_style_preview_button'),
        presetStyle: $dlg.find('#preset_style'),
        matchMethod: $dlg.find('#match_method'),
        addStyleButton: $dlg.find('#table-push-to-chat-style-add'),
        editStyleButton: $dlg.find('#table-push-to-chat-style-edit'),
        importStyleButton: $dlg.find('#table-push-to-chat-style-import'),
        exportStyleButton: $dlg.find('#table-push-to-chat-style-export'),
        deleteStyleButton: $dlg.find('#table-push-to-chat-style-delete'),
        debugStyleButton: $dlg.find('#table-push-to-chat-style-debug'),
        previewStyleButton: $dlg.find('#table-push-to-chat-style-preview'),
        copyTextButton: $dlg.find('#table-push-to-chat-style-export'),
        table_renderer_display_container: $dlg.find('#table_renderer_display_container'),
        match_method_regex_container: $dlg.find('#match_method_regex_container'),
        push_to_chat_style_edit_guide_content: $dlg.find('#push_to_chat_style_edit_guide_content'),
        alternateLevel: $dlg.find('#table_to_alternate'),
    };
}

/**
 * Update guide content
 */
function updateGuideContent(elements, isRegex) {
    dom.toggleVisibility(elements.match_method_regex_container, isRegex);
    elements.push_to_chat_style_edit_guide_content.html(isRegex
        ? `Supports standard regular expression syntax. Wrapping partial code with <cycleDivide></cycleDivide> enables local looping—for example, to collapse items, quests, etc.`
        : `When the style content is empty, the original table is displayed by default. Supports defining structure and styling using HTML and CSS, and locating cells using <code>\\$\\w\\s+</code>.<br>For example, <code>$A0</code> refers to column 1, row 1 (header), and <code>$A1</code> refers to column 1, row 2 (first data row).`
    );
}

/**
 * Get currently selected style
 */
function getCurrentSelectedStyle() {
    if (!templateInstance.config.customStyles || Object.keys(templateInstance.config.customStyles).length === 0) {
        return DEFAULT_STYLE;
    }

    const selectedKey = templateInstance.config.selectedCustomStyleKey;
    return templateInstance.config.customStyles[selectedKey] || templateInstance.config.customStyles[Object.keys(templateInstance.config.customStyles)[0]] || DEFAULT_STYLE;
}

/**
 * Get current UI form data
 */
function getFormData() {
    return {
        mode: dom.getValue(elements.matchMethod),
        basedOn: dom.getValue(elements.benchmark),
        regex: dom.getValue(elements.regex),
        replace: dom.getValue(elements.replace)
    };
}

/**
 * Set form data
 */
function setFormData(style = {}) {
    const data = { ...DEFAULT_STYLE, ...style };
    dom.setValue(elements.matchMethod, data.mode);
    dom.setValue(elements.benchmark, data.basedOn);
    dom.setValue(elements.regex, data.regex);
    dom.setValue(elements.replace, data.replace);
}

/**
 * Initialize table style preview
 */
function setupSheetPreview() {
    if (!templateInstance) {
        console.warn("setupSheetPreview: Failed to obtain a valid table object.");
        return;
    }

    // Initialize style preview table
    templateInstance.element = null
    templateInstance.element = `<div class="justifyLeft scrollable">${templateInstance.renderSheet((cell) => {
        cell.element.style.cursor = 'default';
    }).outerHTML}</div>`;
    // console.log("setupSheetPreview-elements.rendererDisplay exists:", !!elements.rendererDisplay);
    // console.log("jQuery object length:", elements.rendererDisplay?.length || 0);
    renderHTML();
    dom.toggleVisibility(elements.table_renderer_display_container, false);
}

/**
 * Collect configuration from UI
 */
function collectConfigThenUpdateTemplate() {
    const selectedKey = dom.getValue(elements.presetStyle);
    const styleName = elements.presetStyle.find('option:selected').text();
    const customStyles = { ...(templateInstance.config.customStyles || {}) };
    const currentStyle = getFormData();
    if (selectedKey !== 'default' || Object.keys(customStyles).length === 0) {
        customStyles[styleName] = currentStyle;
    }

    const config = {
        toChat: dom.isChecked(elements.tableToChatButton),
        useCustomStyle: dom.isChecked(elements.tableStyleButton),
        triggerSendToChat: dom.isChecked(elements.triggerSendToChatButton),
        alternateTable: dom.isChecked(elements.alternateTableButton),
        insertTable: dom.isChecked(elements.insertTableButton),
        skipTop: dom.isChecked(elements.skipTopButton),
        alternateLevel: dom.getValue(elements.alternateLevel),
        selectedCustomStyleKey: styleName,
        customStyles: customStyles
    };
    templateInstance.config = config;
    return config;
}

/**
 * Render preview
 */
function renderPreview() {
    try {
        const regex = dom.getValue(elements.regex);
        const replace = dom.getValue(elements.replace);

        if (regex && replace) {
            const htmlContent = elements.rendererDisplay.html();
            const regExp = new RegExp(regex, 'g');
            elements.rendererDisplay.html(htmlContent.replace(regExp, replace));
        }
    } catch (e) {
        console.error("Preview rendering error:", e);
    }
}

/**
 * Initialize UI values
 */
function initUIValues() {
    // Initialize checkboxes
    dom.setChecked(elements.tableToChatButton, templateInstance.config.toChat !== false);
    dom.setChecked(elements.tableStyleButton, templateInstance.config.useCustomStyle !== false);
    dom.setChecked(elements.triggerSendToChatButton, templateInstance.config.triggerSendToChat !== false);
    dom.setChecked(elements.alternateTableButton, templateInstance.config.alternateTable == true);
    dom.setChecked(elements.insertTableButton, templateInstance.config.insertTable == true);
    dom.setChecked(elements.skipTopButton, templateInstance.config.skipTop == true);
    dom.setChecked(elements.tablePreviewButton, false);
    dom.setValue(elements.alternateLevel, templateInstance.config.alternateLevel || 0);
    initPresetStyleDropdown();
    setFormData(getCurrentSelectedStyle());
}

/**
 * Initialize preset style dropdown
 */
function initPresetStyleDropdown() {
    const presetDropdown = elements.presetStyle;
    presetDropdown.empty();

    if (templateInstance.config.customStyles && Object.keys(templateInstance.config.customStyles).length > 0) {
        // Add all custom styles
        Object.keys(templateInstance.config.customStyles).forEach(styleName => {
            dom.addOption(presetDropdown, styleName);
        });

        // Set selected item
        if (templateInstance.config.selectedCustomStyleKey && templateInstance.config.customStyles[templateInstance.config.selectedCustomStyleKey]) {
            dom.setValue(presetDropdown, templateInstance.config.selectedCustomStyleKey);
        } else {
            const firstStyleKey = presetDropdown.find('option:first').get(0).value;
            dom.setValue(presetDropdown, firstStyleKey);
            templateInstance.config.selectedCustomStyleKey = firstStyleKey;
        }
    } else {
        dom.addOption(presetDropdown, 'default', 'Default');
    }
}

/**
 * Bind all event handlers
 */
function bindEvents() {
    // Bind basic input element events
    ['input', 'input', 'change', 'change', 'change', 'change'].forEach((eventType, i) => {
        [elements.regex, elements.replace, elements.tablePreviewButton,
        elements.matchMethod, elements.benchmark, elements.tableStyleButton][i]
            .get(0).addEventListener(eventType, refreshEditor);
    });

    // Preset style change event
    elements.presetStyle.get(0).addEventListener('change', function (event) {
        const selectedKey = event.target.value;
        const selectedStyle = templateInstance.config.customStyles[selectedKey];
        if (selectedStyle) {
            setFormData(selectedStyle);
            refreshEditor();
        }
    });

    bindStyleManagementEvents();
    bindPreviewAndCopyEvents();
}

/**
 * Bind style management button events
 */
function bindStyleManagementEvents() {
    // Add style
    elements.addStyleButton.get(0).addEventListener('click', async function () {
        const styleName = await EDITOR.callGenericPopup("Enter new style name:", EDITOR.POPUP_TYPE.INPUT);
        if (!styleName) return;

        templateInstance.config.customStyles = templateInstance.config.customStyles || {};
        templateInstance.config.customStyles[styleName] = getFormData();
        dom.addOption(elements.presetStyle, styleName);
        dom.setValue(elements.presetStyle, styleName);
        dom.triggerEvent(elements.presetStyle, 'change');
    });

    // Edit style name
    elements.editStyleButton.get(0).addEventListener('click', async function () {
        const selectedKey = dom.getValue(elements.presetStyle);
        if (selectedKey === 'default' || !templateInstance.config.customStyles[selectedKey]) return;

        const newName = await EDITOR.callGenericPopup("Modify style name:", EDITOR.POPUP_TYPE.INPUT, selectedKey);
        if (!newName || newName === selectedKey) return;

        // Rename style
        templateInstance.config.customStyles[newName] = templateInstance.config.customStyles[selectedKey];
        delete templateInstance.config.customStyles[selectedKey];

        // Update dropdown
        const option = elements.presetStyle.find(`option[value="${selectedKey}"]`).get(0);
        option.text = newName;
        option.value = newName;
        dom.setValue(elements.presetStyle, newName);
    });

    // Delete style
    elements.deleteStyleButton.get(0).addEventListener('click', async function () {
        const selectedKey = dom.getValue(elements.presetStyle);
        if (selectedKey === 'default') {
            return EDITOR.error('Cannot delete default style');
        }

        const confirmation = await EDITOR.callGenericPopup("Are you sure you want to delete this style?", EDITOR.POPUP_TYPE.CONFIRM);
        if (!confirmation) return;

        delete templateInstance.config.customStyles[selectedKey];
        elements.presetStyle.find(`option[value="${selectedKey}"]`).remove();
        dom.setValue(elements.presetStyle, elements.presetStyle.find('option:first').get(0).value);
        dom.triggerEvent(elements.presetStyle, 'change');
    });

    // Import style
    elements.importStyleButton.get(0).addEventListener('click', async function () {
        const importData = await EDITOR.callGenericPopup("Paste style configuration JSON:", EDITOR.POPUP_TYPE.INPUT, '', { rows: 10 });
        if (!importData) return;

        try {
            const styleData = JSON.parse(importData);
            const styleName = styleData.name || "Imported Style";

            // Remove unnecessary properties
            delete styleData.name;
            delete styleData.uid;

            templateInstance.config.customStyles = templateInstance.config.customStyles || {};
            templateInstance.config.customStyles[styleName] = styleData;

            dom.addOption(elements.presetStyle, styleName);
            dom.setValue(elements.presetStyle, styleName);
            dom.triggerEvent(elements.presetStyle, 'change');

            EDITOR.success('Style imported successfully');
        } catch (e) {
            EDITOR.error('Style import failed: invalid JSON format', e.message, e);
        }
    });

    // Export style
    elements.exportStyleButton.get(0).addEventListener('click', function () {
        const selectedKey = dom.getValue(elements.presetStyle);
        if (selectedKey === 'default' || !templateInstance.config.customStyles[selectedKey]) return;

        const exportData = { ...templateInstance.config.customStyles[selectedKey], name: selectedKey };
        navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
            .then(() => EDITOR.success('Style copied to clipboard'));
    });
}

/**
 * Bind preview and copy button events
 */
function bindPreviewAndCopyEvents() {
    // Preview button
    elements.previewStyleButton.get(0).addEventListener('click', async () => {
        const currentConfig = collectConfigThenUpdateTemplate();
        const selectedStyle = currentConfig.customStyles[currentConfig.selectedCustomStyleKey];
        const initialText = initializeText(templateInstance, selectedStyle);
        const benchmarkValue = dom.getValue(elements.benchmark);

        // Create selector options
        const benchmarkOptions = Array.from(elements.benchmark.get(0).options)
            .map(option => `<option value="${option.value}" ${option.value === benchmarkValue ? 'selected' : ''}>${option.text}</option>`)
            .join('');

        const previewHtml = `
            <div>
                <div style="margin-bottom: 10px; display: flex; align-items: center;">
                    <span style="margin-right: 10px;">Based on:</span>
                    <select id="preview_benchmark_selector" style="min-width: 100px">${benchmarkOptions}</select>
                </div>
                <textarea id="table_to_chat_text_preview" rows="10" style="width: 100%">${initialText}</textarea>
            </div>`;

        const popup = new EDITOR.Popup(previewHtml, EDITOR.POPUP_TYPE.TEXT, '', { wide: true });
        const $dlg = $(popup.dlg);

        popup.show().then(() => {
            dom.setValue(elements.benchmark, selectedStyle.basedOn);
            refreshEditor();
        });

        setTimeout(() => {
            $dlg.find('#preview_benchmark_selector').on('change', function () {
                selectedStyle.basedOn = this.value;
                $dlg.find('#table_to_chat_text_preview').val(initializeText(templateInstance, selectedStyle));
            });
        }, 0);
    });

    // Copy button
    elements.copyTextButton.get(0).addEventListener('click', () =>
        navigator.clipboard.writeText(elements.rendererDisplay.html())
            .then(() => EDITOR.success('HTML content copied to clipboard')));
}

/**
 * Initialize editor components and values
 */
async function initializeEditor() {
    initUIValues();
    setupSheetPreview();
    renderPreview();

    setTimeout(() => {
        updateGuideContent(elements, dom.getValue(elements.matchMethod) === 'regex');
        refreshEditor();
    }, 0);
}

/**
 * Open table style renderer popup
 * @param {Object} originInstance Original table object
 * @returns {Promise<Object>} Processing result
 */
export async function openSheetStyleRendererPopup(originInstance) {
    // Initialize popup
    const manager = await SYSTEM.getTemplate('customSheetStyle');
    const tableRendererPopup = new EDITOR.Popup(manager, EDITOR.POPUP_TYPE.CONFIRM, '', { large: true, wide: true, allowVerticalScrolling: true, okButton: "Save Changes", cancelButton: "Cancel" });
    const $dlg = $(tableRendererPopup.dlg);
    templateInstance = originInstance;

    // Initialize
    elements = await getUIElements($dlg);
    await initializeEditor();
    bindEvents();

    // Show popup and handle result
    await tableRendererPopup.show();

    if (tableRendererPopup.result) {
        const finalConfig = collectConfigThenUpdateTemplate();
        const alternateLevel = Number(finalConfig.alternateLevel);
        const styleBasedOn = ["html", "csv", "json", "array"];
        const numberBoollen = isNaN(alternateLevel) || alternateLevel < 0 || Number.isInteger(alternateLevel) === false;  // Whether it satisfies non-negative integer
        const styleBoollen = styleBasedOn.includes(finalConfig.customStyles[finalConfig.selectedCustomStyleKey].basedOn);      // Format must be html, csv, json, or array
        if (numberBoollen || (alternateLevel > 0 && !styleBoollen)) {     // Insertion level must be a non-negative integer and cannot be Markdown format; otherwise, force it to 0
            finalConfig.alternateLevel = 0;
            EDITOR.warning('Insertion level must be a non-negative integer and cannot be in Markdown format; it has been reset to 0');
        }
        Object.assign(originInstance.config, finalConfig);
        console.log('Table style updated', originInstance.config.alternateLevel);
        originInstance.save();
        BASE.updateSystemMessageTableStatus()
        EDITOR.success('Table style updated');
    }
}
