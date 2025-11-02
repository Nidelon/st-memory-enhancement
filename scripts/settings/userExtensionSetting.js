import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../../core/manager.js';
import {updateSystemMessageTableStatus, updateAlternateTable} from "../renderer/tablePushToChat.js";
import {rebuildSheets , modifyRebuildTemplate, newRebuildTemplate, deleteRebuildTemplate, exportRebuildTemplate, importRebuildTemplate, triggerStepByStepNow} from "../runtime/absoluteRefresh.js";
import {generateDeviceId} from "../../utils/utility.js";
import {updateModelList, handleApiTestRequest ,processApiKey} from "./standaloneAPI.js";
import {filterTableDataPopup} from "../../data/pluginSetting.js";
import {initRefreshTypeSelector} from "../runtime/absoluteRefresh.js";
import {rollbackVersion} from "../../services/debugs.js";
import {customSheetsStylePopup} from "../editor/customSheetsStyle.js";
import {openAppHeaderTableDrawer} from "../renderer/appHeaderTableBaseDrawer.js";
import {buildSheetsByTemplates} from "../../index.js"

/**
 * Format depth setting
 */
function formatDeep() {
    USER.tableBaseSetting.deep = Math.abs(USER.tableBaseSetting.deep)
}

/**
 * Update switch status in settings
 */
function updateSwitch(selector, switchValue) {
    if (switchValue) {
        $(selector).prop('checked', true);
    } else {
        $(selector).prop('checked', false);
    }
}

/**
 * Update table structure DOM in settings
 */
function updateTableView() {
    const show_drawer_in_extension_list = USER.tableBaseSetting.show_drawer_in_extension_list;
    const extensionsMenu = document.querySelector('#extensionsMenu');
    const show_settings_in_extension_menu = USER.tableBaseSetting.show_settings_in_extension_menu;
    const alternate_switch = USER.tableBaseSetting.alternate_switch;
    const extensions_settings = document.querySelector('#extensions_settings');

    if (show_drawer_in_extension_list === true) {
        // Create if not exists
        if (document.querySelector('#drawer_in_extension_list_button')) return
        $(extensionsMenu).append(`
<div id="drawer_in_extension_list_button" class="list-group-item flex-container flexGap5 interactable">
    <div class="fa-solid fa-table extensionsMenuExtensionButton"></div>
    <span>Enhanced Memory Table</span>
</div>
`);
        // Set click event
        $('#drawer_in_extension_list_button').on('click', () => {
            // $('#table_drawer_icon').click()
            openAppHeaderTableDrawer('database');
        });
    } else {
        document.querySelector('#drawer_in_extension_list_button')?.remove();
    }

//     if (show_drawer_in_extension_list === true) {
//         // Create if not exists
//         if (document.querySelector('#drawer_in_extension_list_button')) return
//         $(extensions_settings).append(`
// <div id="drawer_in_extension_list_button" class="list-group-item flex-container flexGap5 interactable">
// </div>
// `);
//     } else {
//
//     }
}

function getSheetsCellStyle() {
    const style = document.createElement('style');  // Add a style for sheetContainer content
    // Get sheetContainer element
    const cellWidth = USER.tableBaseSetting.table_cell_width_mode
    let sheet_cell_style_container = document.querySelector('#sheet_cell_style_container');
    if (sheet_cell_style_container) {
        // Clear existing styles
        sheet_cell_style_container.innerHTML = '';
    } else {
        // Create a new sheet_cell_style_container element
        sheet_cell_style_container = document.createElement('div');
        sheet_cell_style_container.id = 'sheet_cell_style_container';
        document.body.appendChild(sheet_cell_style_container);
    }
    switch (cellWidth) {
        case 'single_line':
            style.innerHTML = ``;
            break;
        case 'wide1_cell':
            style.innerHTML = ` tr .sheet-cell { max-width: 800px !important; white-space: normal !important; } `;
            break;
        case 'wide1_2_cell':
            style.innerHTML = ` tr .sheet-cell { max-width: 400px !important; white-space: normal !important; } `;
            break;
        case 'wide1_4_cell':
            style.innerHTML = ` tr .sheet-cell { max-width: 200px !important; white-space: normal !important; } `;
            break;
    }
    sheet_cell_style_container.appendChild(style);
}

/**
 * Convert table structure to settings DOM
 * @param {object} tableStructure Table structure
 * @returns Settings DOM
 */
function tableStructureToSettingDOM(tableStructure) {
    const tableIndex = tableStructure.tableIndex;
    const $item = $('<div>', { class: 'dataTable_tableEditor_item' });
    const $index = $('<div>').text(`#${tableIndex}`); // Index
    const $input = $('<div>', {
        class: 'tableName_pole margin0',
    });
    $input.text(tableStructure.tableName);
    const $checkboxLabel = $('<label>', { class: 'checkbox' });
    const $checkbox = $('<input>', { type: 'checkbox', 'data-index': tableIndex, checked: tableStructure.enable, class: 'tableEditor_switch' });
    $checkboxLabel.append($checkbox, 'Enable');
    const $editButton = $('<div>', {
        class: 'menu_button menu_button_icon fa-solid fa-pencil tableEditor_editButton',
        title: 'Edit',
        'data-index': tableIndex, // Bind index
    }).text('Edit');
    $item.append($index, $input, $checkboxLabel, $editButton);
    return $item;
}

/**
 * Import plugin settings
 */
async function importTableSet() {
    // Create an input element for file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json'; // Restrict file type to JSON

    // Listen to input element's change event, triggered after user selects a file
    input.addEventListener('change', async (event) => {
        const file = event.target.files[0]; // Get the selected file

        if (!file) {
            return; // User didn't select a file, return immediately
        }

        const reader = new FileReader(); // Create FileReader object to read file content

        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result); // Parse JSON file content

                // Get first-level keys of imported JSON
                const firstLevelKeys = Object.keys(importedData);

                // Build HTML structure to display first-level keys
                let keyListHTML = '<ul>';
                firstLevelKeys.forEach(key => {
                    keyListHTML += `<li>${key}</li>`;
                });
                keyListHTML += '</ul>';

                const tableInitPopup = $(`<div>
                    <p>Settings to be imported (first-level keys):</p>
                    ${keyListHTML}
                    <p>Proceed with import and reset these settings?</p>
                </div>`);

                const confirmation = await EDITOR.callGenericPopup(tableInitPopup, EDITOR.POPUP_TYPE.CONFIRM, 'Import Settings Confirmation', { okButton: "Proceed Import", cancelButton: "Cancel" });
                if (!confirmation) return; // User canceled import

                // Apply data after user confirms import
                // Note: This assumes you want to merge all importedData into USER.tableBaseSetting
                // You may need to adjust merging logic based on actual needs (e.g., merge only first-level keys or finer granularity)
                for (let key in importedData) {
                    USER.tableBaseSetting[key] = importedData[key];
                }

                renderSetting(); // Re-render settings UI to apply new settings
                // Re-convert templates
                initTableStructureToTemplate()
                BASE.refreshTempView(true) // Refresh template view
                EDITOR.success('Import successful and selected settings have been reset'); // Notify user of successful import

                // [New] If all table data in current session is "empty", clear chat domain and override with global template
                try {
                    const { piece } = USER.getChatPiece() || {};
                    // Skip if no carrier (cannot save to chat history)
                    if (piece) {
                        // Prompt user confirmation before replacement
                        const confirmReplace = await EDITOR.callGenericPopup(
                            'Replace current chat template? (Important: This will permanently clear old table data in this chat)',
                            EDITOR.POPUP_TYPE.CONFIRM,
                            'Template Replacement Confirmation',
                            { okButton: 'Clear and Apply Preset Tables', cancelButton: 'Do Not Replace' }
                        );
                        if (!confirmReplace) {
                            EDITOR.success && EDITOR.success('Template replacement canceled');
                        } else {
                            BASE.sheetsData.context = {}; // Clear chat domain and rebuild with global template
                            // Remove hash_sheets from all pieces in chat list
                            try {
                                const chatArr = USER.getContext()?.chat || [];
                                for (const msg of chatArr) {
                                    if (msg && Object.prototype.hasOwnProperty.call(msg, 'hash_sheets')) {
                                        delete msg.hash_sheets;
                                    }
                                }
                            } catch (_) {}
                            // Rebuild on current carrier using global template
                            buildSheetsByTemplates(piece);
                            // Refresh UI and system messages
                            BASE.refreshContextView();
                            BASE.refreshTempView(true)
                            updateSystemMessageTableStatus(true);
                            EDITOR.success('Global template successfully applied to chat domain');
                        }
                    } else {
                        // Provide clear message when no carrier exists
                        EDITOR.warning('Skipped preset table template replacement because current chat has no carrier');
                    }
                } catch (e) {
                    // Fail silently without affecting main import flow
                    console.warn('[Preset Import] Non-fatal error during chat domain template override:', e);
                }

            } catch (error) {
                EDITOR.error('JSON file parsing failed. Please check file format.', error.message, error); // Notify JSON parsing failure
                console.error("File read or parse error:", error); // Log detailed error to console
            }
        };

        reader.onerror = (error) => {
            EDITOR.error(`File read failed`, error.message, error); // Notify file read failure
        };

        reader.readAsText(file); // Read file as text
    });

    input.click(); // Simulate click on input element to open file picker
}


/**
 * Export plugin settings
 */
async function exportTableSet() {
    templateToTableStructure()
    const { filterData, confirmation } = await filterTableDataPopup(USER.tableBaseSetting,"Select data to export","")
    if (!confirmation) return;

    try {
        const blob = new Blob([JSON.stringify(filterData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a')
        a.href = url;
        a.download = `tableCustomConfig-${SYSTEM.generateRandomString(8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        EDITOR.success('Export successful');
    } catch (error) {
        EDITOR.error(`Export failed`, error.message, error);
    }
}

/**
 * Reset settings
 */
async function resetSettings() {
    const { filterData, confirmation } = await filterTableDataPopup(USER.tableBaseDefaultSettings, "Select data to reset","It is recommended to back up data before resetting")
    if (!confirmation) return;

    try {
        for (let key in filterData) {
            USER.tableBaseSetting[key] = filterData[key]
        }
        renderSetting()
        if('tableStructure' in filterData){
            initTableStructureToTemplate()
            BASE.refreshTempView(true)
        }
        EDITOR.success('Selected settings have been reset');
    } catch (error) {
        EDITOR.error(`Failed to reset settings`, error.message, error);
    }
}

function InitBinging() {
    console.log('Initialize bindings')
    // Start binding events
    // Import preset
    $('#table-set-import').on('click', () => importTableSet());
    // Export
    $("#table-set-export").on('click', () => exportTableSet());
    // Reset settings
    $("#table-reset").on('click', () => resetSettings());
    // Rollback table version from 2.0 to 1.0
    $("#table-init-from-2-to-1").on('click', async () => {
        if (await rollbackVersion() === true) {
            window.location.reload()
        }
    });
    // Plugin master switch
    $('#table_switch').change(function () {
        USER.tableBaseSetting.isExtensionAble = this.checked;
        EDITOR.success(this.checked ? 'Plugin enabled' : 'Plugin disabled. Tables can be opened and manually edited, but AI will not read or generate tables');
        updateSystemMessageTableStatus();   // Update table data status in system message
    });
    // Debug mode switch
    $('#table_switch_debug_mode').change(function () {
        USER.tableBaseSetting.tableDebugModeAble = this.checked;
        EDITOR.success(this.checked ? 'Debug mode enabled' : 'Debug mode disabled');
    });
    // Plugin table reading switch
    $('#table_read_switch').change(function () {
        USER.tableBaseSetting.isAiReadTable = this.checked;
        EDITOR.success(this.checked ? 'AI will now read tables' : 'AI will not read tables');
    });
    // Plugin table writing switch
    $('#table_edit_switch').change(function () {
        USER.tableBaseSetting.isAiWriteTable = this.checked;
        EDITOR.success(this.checked ? 'AI changes will now be written to tables' : 'AI changes will not be written to tables');
    });

    // Table injection mode
    $('#dataTable_injection_mode').change(function (event) {
        USER.tableBaseSetting.injection_mode = event.target.value;
    });
    $("#fill_table_time").change(function() {
        const value = $(this).val();
        const step_by_step = value === 'after'
        $('#reply_options').toggle(!step_by_step);
        $('#step_by_step_options').toggle(step_by_step);
        USER.tableBaseSetting.step_by_step = step_by_step;
    })
    // Confirm before execution
    $('#confirm_before_execution').change(function() {
        USER.tableBaseSetting.confirm_before_execution = $(this).prop('checked');
    })
    // // Advanced table organization settings
    // $('#advanced_settings').change(function() {
    //     $('#advanced_options').toggle(this.checked);
    //     USER.tableBaseSetting.advanced_settings = this.checked;
    // });
    // Ignore deletion
    $('#ignore_del').change(function() {
        USER.tableBaseSetting.bool_ignore_del = $(this).prop('checked');
    });
    // Ignore user replies
    $('#ignore_user_sent').change(function() {
        USER.tableBaseSetting.ignore_user_sent = $(this).prop('checked');
    });
    // // Force refresh
    // $('#bool_force_refresh').change(function() {
    //     USER.tableBaseSetting.bool_force_refresh = $(this).prop('checked');
    // });
    // Silent refresh
    $('#bool_silent_refresh').change(function() {
        USER.tableBaseSetting.bool_silent_refresh = $(this).prop('checked');
    });
    // Use token limit instead of message layer limit
    $('#use_token_limit').change(function() {
        $('#token_limit_container').toggle(this.checked);
        $('#clear_up_stairs_container').toggle(!this.checked);
        USER.tableBaseSetting.use_token_limit = this.checked;
    });
    // Initialize API settings display state
    $('#use_main_api').change(function() {
        USER.tableBaseSetting.use_main_api = this.checked;
    });
    // Initialize API settings display state for step-by-step mode
    $('#step_by_step_use_main_api').change(function() {
        USER.tableBaseSetting.step_by_step_use_main_api = this.checked;
    });
    // Update custom model name based on dropdown selection
    $('#model_selector').change(function(event) {
        $('#custom_model_name').val(event.target.value);
        USER.IMPORTANT_USER_PRIVACY_DATA.custom_model_name = event.target.value;
        USER.saveSettings && USER.saveSettings(); // Save settings
    });
    // Table push-to-chat switch
    $('#table_to_chat').change(function () {
        USER.tableBaseSetting.isTableToChat = this.checked;
        EDITOR.success(this.checked ? 'Tables will be pushed to chat' : 'Table push-to-chat disabled');
        $('#table_to_chat_options').toggle(this.checked);
        updateSystemMessageTableStatus();   // Update table data status in system message
    });
    // Show table settings in extension menu switch
    $('#show_settings_in_extension_menu').change(function () {
        USER.tableBaseSetting.show_settings_in_extension_menu = this.checked;
        updateTableView();
    });
    // Show alternate model settings in extension menu switch
    $('#alternate_switch').change(function () {
        USER.tableBaseSetting.alternate_switch = this.checked;
        EDITOR.success(this.checked ? 'Table rendering interleaving mode enabled' : 'Table rendering interleaving mode disabled');
        updateTableView();
        updateAlternateTable();
    });
    // Show table drawer in extension list
    $('#show_drawer_in_extension_list').change(function () {
        USER.tableBaseSetting.show_drawer_in_extension_list = this.checked;
        updateTableView();
    });
    // Allow editing of table data pushed to frontend
    $('#table_to_chat_can_edit').change(function () {
        USER.tableBaseSetting.table_to_chat_can_edit = this.checked;
        updateSystemMessageTableStatus();   // Update table data status in system message
    });
    // Select table push position from dropdown
    $('#table_to_chat_mode').change(function(event) {
        USER.tableBaseSetting.table_to_chat_mode = event.target.value;
        $('#table_to_chat_is_micro_d').toggle(event.target.value === 'macro');
        updateSystemMessageTableStatus();   // Update table data status in system message
    });

    // Select table cell width mode from dropdown
    $('#table_cell_width_mode').change(function(event) {
        USER.tableBaseSetting.table_cell_width_mode = event.target.value;
        getSheetsCellStyle()
    });


    // API URL
    $('#custom_api_url').on('input', function() {
        USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_url = $(this).val();
        USER.saveSettings && USER.saveSettings(); // Save settings
    });
    // API KEY
    let apiKeyDebounceTimer;
    $('#custom_api_key').on('input', function () {
        clearTimeout(apiKeyDebounceTimer);
        apiKeyDebounceTimer = setTimeout(async () => {
            try {
                const rawKey = $(this).val();
                const result = processApiKey(rawKey, generateDeviceId());
                USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_key = result.encryptedResult.encrypted || result.encryptedResult;
                USER.saveSettings && USER.saveSettings(); // Save settings
                EDITOR.success(result.message);
            } catch (error) {
                console.error('API Key processing failed:', error);
                EDITOR.error('Failed to obtain API KEY. Please re-enter.', error.message, error);
            }
        }, 500); // 500ms debounce delay
    })
    // Model name
    $('#custom_model_name').on('input', function() {
        USER.IMPORTANT_USER_PRIVACY_DATA.custom_model_name = $(this).val();
        USER.saveSettings && USER.saveSettings(); // Save settings
    });
    // Table message template
    $('#dataTable_message_template').on("input", function () {
        const value = $(this).val();
        USER.tableBaseSetting.message_template = value;
    })
    // Table depth
    $('#dataTable_deep').on("input", function () {
        const value = $(this).val();
        USER.tableBaseSetting.deep = Math.abs(value);
    })
    // Step-by-step table filling prompt
    $('#step_by_step_user_prompt').on('input', function() {
        USER.tableBaseSetting.step_by_step_user_prompt = $(this).val();
    });
    // Context layers read during step-by-step table filling
    $('#separateReadContextLayers').on('input', function() {
        USER.tableBaseSetting.separateReadContextLayers = Number($(this).val());
    });
    // Whether to read lorebook during step-by-step table filling
    $('#separateReadLorebook').change(function() {
        USER.tableBaseSetting.separateReadLorebook = this.checked;
        USER.saveSettings && USER.saveSettings();
    });
    // Reset step-by-step table filling prompt to default
    $('#reset_step_by_step_user_prompt').on('click', function() {
        const defaultValue = USER.tableBaseDefaultSettings.step_by_step_user_prompt;
        $('#step_by_step_user_prompt').val(defaultValue);
        // Also update in-memory settings
        USER.tableBaseSetting.step_by_step_user_prompt = defaultValue;
        EDITOR.success('Step-by-step table filling prompt reset to default.');
    });
    // Clean chat history layers
    $('#clear_up_stairs').on('input', function() {
        const value = $(this).val();
        $('#clear_up_stairs_value').text(value);
        USER.tableBaseSetting.clear_up_stairs = Number(value);
    });
    // Token limit
    $('#rebuild_token_limit').on('input', function() {
        const value = $(this).val();
        $('#rebuild_token_limit_value').text(value);
        USER.tableBaseSetting.rebuild_token_limit_value = Number(value);
    });
    // Model temperature setting
    $('#custom_temperature').on('input', function() {
        const value = $(this).val();
        $('#custom_temperature_value').text(value);
        USER.tableBaseSetting.custom_temperature = Number(value);
    });

    // Proxy address
    $('#table_proxy_address').on('input', function() {
        USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address = $(this).val();
        USER.saveSettings && USER.saveSettings(); // Save settings
    });
    // Proxy key
    $('#table_proxy_key').on('input', function() {
        USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key = $(this).val();
        USER.saveSettings && USER.saveSettings(); // Save settings
    });

    // Fetch model list
    $('#fetch_models_button').on('click', updateModelList);

    // Test API
    $(document).on('click', '#table_test_api_button',async () => {
        const apiUrl = $('#custom_api_url').val();
        const modelName = $('#custom_model_name').val();
        const encryptedApiKeys = USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_key;
        const results = await handleApiTestRequest(apiUrl, encryptedApiKeys, modelName);
    });

    // Start organizing tables
    $("#table_clear_up").on('click', () => {
        rebuildSheets()
    });

    // Full table rebuild (merged into dropdown above)
    // $('#rebuild_table').on('click', () => rebuildTableActions(USER.tableBaseSetting.bool_force_refresh, USER.tableBaseSetting.bool_silent_refresh));

    // Push tables to chat
    $("#dataTable_to_chat_button").on("click", async function () {
        customSheetsStylePopup()
    })

    // Reorganize template editing
    $("#rebuild--set-rename").on("click", modifyRebuildTemplate)
    $("#rebuild--set-new").on("click", newRebuildTemplate)
    $("#rebuild--set-delete").on("click", deleteRebuildTemplate)
    $("#rebuild--set-export").on("click", exportRebuildTemplate)
    $("#rebuild--set-import").on("click", importRebuildTemplate)
    $('#rebuild--select').on('change', function() {
        USER.tableBaseSetting.lastSelectedTemplate = $(this).val();
        USER.saveSettings && USER.saveSettings();
    });

    // Manually trigger step-by-step table filling
    $(document).on('click', '#trigger_step_by_step_button', () => {
        triggerStepByStepNow();
    });

}

/**
 * Render settings
 */
export function renderSetting() {
    // Initialize values
    $(`#dataTable_injection_mode option[value="${USER.tableBaseSetting.injection_mode}"]`).prop('selected', true);
    $(`#table_to_chat_mode option[value="${USER.tableBaseSetting.table_to_chat_mode}"]`).prop('selected', true);
    $(`#table_cell_width_mode option[value="${USER.tableBaseSetting.table_cell_width_mode}"]`).prop('selected', true);
    $('#dataTable_message_template').val(USER.tableBaseSetting.message_template);
    $('#dataTable_deep').val(USER.tableBaseSetting.deep);
    $('#clear_up_stairs').val(USER.tableBaseSetting.clear_up_stairs);
    $('#clear_up_stairs_value').text(USER.tableBaseSetting.clear_up_stairs);
    $('#rebuild_token_limit').val(USER.tableBaseSetting.rebuild_token_limit_value);
    $('#rebuild_token_limit_value').text(USER.tableBaseSetting.rebuild_token_limit_value);
    $('#custom_temperature').val(USER.tableBaseSetting.custom_temperature);
    $('#custom_temperature_value').text(USER.tableBaseSetting.custom_temperature);
    // Load step-by-step user prompt
    $('#step_by_step_user_prompt').val(USER.tableBaseSetting.step_by_step_user_prompt || '');
    // Context layers read during step-by-step table filling
    $('#separateReadContextLayers').val(USER.tableBaseSetting.separateReadContextLayers);
    // Whether to read lorebook during step-by-step table filling
    updateSwitch('#separateReadLorebook', USER.tableBaseSetting.separateReadLorebook);
    $("#fill_table_time").val(USER.tableBaseSetting.step_by_step ? 'after' : 'chat');
    refreshRebuildTemplate()

    // private data
    $('#custom_api_url').val(USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_url || '');
    $('#custom_api_key').val(USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_key || '');
    $('#custom_model_name').val(USER.IMPORTANT_USER_PRIVACY_DATA.custom_model_name || '');
    $('#table_proxy_address').val(USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address || '');
    $('#table_proxy_key').val(USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key || '');

    // Initialize switch states
    updateSwitch('#table_switch', USER.tableBaseSetting.isExtensionAble);
    updateSwitch('#table_switch_debug_mode', USER.tableBaseSetting.tableDebugModeAble);
    updateSwitch('#table_read_switch', USER.tableBaseSetting.isAiReadTable);
    updateSwitch('#table_edit_switch', USER.tableBaseSetting.isAiWriteTable);
    updateSwitch('#table_to_chat', USER.tableBaseSetting.isTableToChat);
    // updateSwitch('#advanced_settings', USER.tableBaseSetting.advanced_settings);
    updateSwitch('#confirm_before_execution', USER.tableBaseSetting.confirm_before_execution);
    updateSwitch('#use_main_api', USER.tableBaseSetting.use_main_api);
    updateSwitch('#step_by_step_use_main_api', USER.tableBaseSetting.step_by_step_use_main_api);
    updateSwitch('#ignore_del', USER.tableBaseSetting.bool_ignore_del);
    // updateSwitch('#bool_force_refresh', USER.tableBaseSetting.bool_force_refresh);
    updateSwitch('#bool_silent_refresh', USER.tableBaseSetting.bool_silent_refresh);
    // updateSwitch('#use_token_limit', USER.tableBaseSetting.use_token_limit);
    updateSwitch('#ignore_user_sent', USER.tableBaseSetting.ignore_user_sent);
    updateSwitch('#show_settings_in_extension_menu', USER.tableBaseSetting.show_settings_in_extension_menu);
    updateSwitch('#alternate_switch', USER.tableBaseSetting.alternate_switch);
    updateSwitch('#show_drawer_in_extension_list', USER.tableBaseSetting.show_drawer_in_extension_list);
    updateSwitch('#table_to_chat_can_edit', USER.tableBaseSetting.table_to_chat_can_edit);
    $('#reply_options').toggle(!USER.tableBaseSetting.step_by_step);
    $('#step_by_step_options').toggle(USER.tableBaseSetting.step_by_step);
    $('#table_to_chat_options').toggle(USER.tableBaseSetting.isTableToChat);
    $('#table_to_chat_is_micro_d').toggle(USER.tableBaseSetting.table_to_chat_mode === 'macro');

    // No longer display table structure in settings
    // updateTableStructureDOM()
    console.log("Settings rendered")
}

/**
 * Load settings
 */
export function loadSettings() {
    USER.IMPORTANT_USER_PRIVACY_DATA = USER.IMPORTANT_USER_PRIVACY_DATA || {};

    // Compatibility for old version prompt changes
    if (USER.tableBaseSetting.updateIndex < 3) {
        USER.getSettings().message_template = USER.tableBaseDefaultSettings.message_template
        USER.tableBaseSetting.to_chat_container = USER.tableBaseDefaultSettings.to_chat_container
        // USER.tableBaseSetting.tableStructure = USER.tableBaseDefaultSettings.tableStructure
        USER.tableBaseSetting.updateIndex = 3
    }

    // Version 2 table structure compatibility
    console.log("updateIndex", USER.tableBaseSetting.updateIndex)
    if (USER.tableBaseSetting.updateIndex < 4) {
        // tableStructureToTemplate(USER.tableBaseSetting.tableStructure)
        initTableStructureToTemplate()
        USER.tableBaseSetting.updateIndex = 4
    }
    if (USER.tableBaseSetting.deep < 0) formatDeep()

    renderSetting();
    InitBinging();
    initRefreshTypeSelector(); // Initialize table refresh type selector
    updateTableView(); // Update table view
    getSheetsCellStyle()
}

export function initTableStructureToTemplate() {
    const sheetDefaultTemplates = USER.tableBaseSetting.tableStructure
    USER.getSettings().table_selected_sheets = []
    USER.getSettings().table_database_templates = [];
    for (let defaultTemplate of sheetDefaultTemplates) {
        const newTemplate = new BASE.SheetTemplate()
        newTemplate.domain = 'global'
        newTemplate.createNewTemplate(defaultTemplate.columns.length + 1, 1, false)
        newTemplate.name = defaultTemplate.tableName
        defaultTemplate.columns.forEach((column, index) => {
            newTemplate.findCellByPosition(0, index + 1).data.value = column
        })
        newTemplate.enable = defaultTemplate.enable
        newTemplate.tochat = defaultTemplate.tochat
        newTemplate.required = defaultTemplate.Required
        newTemplate.triggerSend = defaultTemplate.triggerSend
        newTemplate.triggerSendDeep = defaultTemplate.triggerSendDeep
        if(defaultTemplate.config)
            newTemplate.config = JSON.parse(JSON.stringify(defaultTemplate.config))
        newTemplate.source.data.note = defaultTemplate.note
        newTemplate.source.data.initNode = defaultTemplate.initNode
        newTemplate.source.data.deleteNode = defaultTemplate.deleteNode
        newTemplate.source.data.updateNode = defaultTemplate.updateNode
        newTemplate.source.data.insertNode = defaultTemplate.insertNode
        USER.getSettings().table_selected_sheets.push(newTemplate.uid)
        newTemplate.save()
    }
    USER.saveSettings()
}

function templateToTableStructure() {
    const tableTemplates = BASE.templates.map((templateData, index) => {
        const template = new BASE.SheetTemplate(templateData.uid)
        return {
            tableIndex: index,
            tableName: template.name,
            columns: template.hashSheet[0].slice(1).map(cellUid => template.cells.get(cellUid).data.value),
            note: template.data.note,
            initNode: template.data.initNode,
            deleteNode: template.data.deleteNode,
            updateNode: template.data.updateNode,
            insertNode: template.data.insertNode,
            config: JSON.parse(JSON.stringify(template.config)),
            Required: template.required,
            tochat: template.tochat,
            enable: template.enable,
            triggerSend: template.triggerSend,
            triggerSendDeep: template.triggerSendDeep,
        }
    })
    USER.tableBaseSetting.tableStructure = tableTemplates
    USER.saveSettings()
}

/**
 * Refresh rebuild template
 */
export function refreshRebuildTemplate() {
    const templateSelect = $('#rebuild--select');
    templateSelect.empty(); // Clear existing options
    const defaultOption = $('<option>', {
        value: "rebuild_base",
        text: "Default",
    });
    templateSelect.append(defaultOption);
    Object.keys(USER.tableBaseSetting.rebuild_message_template_list).forEach(key => {
        const option = $('<option>', {
            value: key,
            text: key
        });
        templateSelect.append(option);
    });
    // Set default selection
    if (USER.tableBaseSetting.lastSelectedTemplate) {
        console.log("Default", USER.tableBaseSetting.lastSelectedTemplate)
        $('#rebuild--select').val(USER.tableBaseSetting.lastSelectedTemplate);
    }
}
