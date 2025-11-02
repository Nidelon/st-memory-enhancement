// absoluteRefresh.js
import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../../core/manager.js';
import {  convertOldTablesToNewSheets, executeTableEditActions, getTableEditTag } from "../../index.js";
import JSON5 from '../../utils/json5.min.mjs'
import { updateSystemMessageTableStatus } from "../renderer/tablePushToChat.js";
import { TableTwoStepSummary } from "./separateTableUpdate.js";
import { estimateTokenCount, handleCustomAPIRequest, handleMainAPIRequest } from "../settings/standaloneAPI.js";
import { profile_prompts } from "../../data/profile_prompts.js";
import { Form } from '../../components/formManager.js';
import { refreshRebuildTemplate } from "../settings/userExtensionSetting.js"
import { safeParse } from '../../utils/stringUtil.js';

// Add validation after parsing the response
function validateActions(actions) {
    if (!Array.isArray(actions)) {
        console.error('Action list must be an array');
        return false;
    }
    return actions.every(action => {
        // Check required fields
        if (!action.action || !['insert', 'update', 'delete'].includes(action.action.toLowerCase())) {
            console.error(`Invalid action type: ${action.action}`);
            return false;
        }
        if (typeof action.tableIndex !== 'number') {
            console.error(`tableIndex must be a number: ${action.tableIndex}`);
            return false;
        }
        if (action.action !== 'insert' && typeof action.rowIndex !== 'number') {
            console.error(`rowIndex must be a number: ${action.rowIndex}`);
            return false;
        }
        // Check data field
        if (action.data && typeof action.data === 'object') {
            const invalidKeys = Object.keys(action.data).filter(k => !/^\d+$/.test(k));
            if (invalidKeys.length > 0) {
                console.error(`Non-numeric keys found: ${invalidKeys.join(', ')}`);
                return false;
            }
        }
        return true;
    });
}

function confirmTheOperationPerformed(content) {
    console.log('content:', content);
    return `
<div class="wide100p padding5 dataBankAttachments">
    <div class="refresh-title-bar">
        <h2 class="refresh-title"> Please confirm the following operations </h2>
        <div>

        </div>
    </div>
    <div id="tableRefresh" class="refresh-scroll-content">
        <div>
            <div class="operation-list-container"> ${content.map(table => {
        return `
<h3 class="operation-list-title">${table.tableName}</h3>
<div class="operation-list">
    <table class="tableDom sheet-table">
        <thead>
            <tr>
                ${table.columns.map(column => `<th>${column}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${table.content.map(row => `
            <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
            `).join('')}
        </tbody>
    </table>
</div>
<hr>
`;
    }).join('')}
            </div>
        </div>
    </div>
</div>

<style>
    .operation-list-title {
        text-align: left;
        margin-top: 10px;
    }
    .operation-list-container {
        display: flex;
        flex-wrap: wrap;
    }
    .operation-list {
        width: 100%;
        max-width: 100%;
        overflow: auto;
    }
</style>
`;
}



/**
 * Initialize table refresh type selector
 * Dynamically generate dropdown options based on the profile_prompts object
 */
export function initRefreshTypeSelector() {
    const $selector = $('#table_refresh_type_selector');
    if (!$selector.length) return;

    // Clear and re-add options
    $selector.empty();

    // Iterate over profile_prompts object and add options
    Object.entries(profile_prompts).forEach(([key, value]) => {
        const option = $('<option></option>')
            .attr('value', key)
            .text((() => {
                switch (value.type) {
                    case 'refresh':
                        return '**Legacy** ' + (value.name || key);
                    case 'third_party':
                        return '**Third-party author** ' + (value.name || key);
                    default:
                        return value.name || key;
                }
            })());
        $selector.append(option);
    });

    // Add default option if no options exist
    if ($selector.children().length === 0) {
        $selector.append($('<option></option>').attr('value', 'rebuild_base').text('~~~This option indicates an error~~~~'));
    }

    console.log('Table refresh type selector updated');

    // // Check if existing options match profile_prompts
    // let needsUpdate = false;
    // const currentOptions = $selector.find('option').map(function() {
    //     return {
    //         value: $(this).val(),
    //         text: $(this).text()
    //     };
    // }).get();

    // // Check if option count matches
    // if (currentOptions.length !== Object.keys(profile_prompts).length) {
    //     needsUpdate = true;
    // } else {
    //     // Check if each option's value and text match
    //     Object.entries(profile_prompts).forEach(([key, value]) => {
    //         const currentOption = currentOptions.find(opt => opt.value === key);
    //         if (!currentOption ||
    //             currentOption.text !== ((value.type=='refresh'? '**Legacy** ':'')+value.name|| key)) {
    //             needsUpdate = true;
    //         }
    //     });
    // }

    // // Clear and re-add options if mismatched
    // if (needsUpdate) {
    //     $selector.empty();

    //     // Iterate over profile_prompts object and add options
    //     Object.entries(profile_prompts).forEach(([key, value]) => {
    //         const option = $('<option></option>')
    //             .attr('value', key)
    //             .text((value.type=='refresh'? '**Legacy** ':'')+value.name|| key);
    //         $selector.append(option);
    //     });

    //     // Add default option if no options exist
    //     if ($selector.children().length === 0) {
    //         $selector.append($('<option></option>').attr('value', 'rebuild_base').text('~~~This option indicates an error~~~~'));
    //     }

    //     console.log('Table refresh type selector updated');
}



/**
 * Get the corresponding prompt template based on selected refresh type and call rebuildTableActions
 * @param {string} templateName Prompt template name
 * @param {string} additionalPrompt Additional prompt content
 * @param {boolean} force Whether to force refresh without showing confirmation dialog
 * @param {boolean} isSilentUpdate Whether to perform silent update without showing operation confirmation
 * @param {string} chatToBeUsed Chat history to use; if empty, uses most recent chat history
 * @returns {Promise<void>}
 */
export async function getPromptAndRebuildTable(templateName = '', additionalPrompt, force, isSilentUpdate = USER.tableBaseSetting.bool_silent_refresh, chatToBeUsed = '') {
    let r = '';
    try {
        r = await rebuildTableActions(force || true, isSilentUpdate, chatToBeUsed);
        return r;
    } catch (error) {
        console.error('Summarization failed:', error);
        EDITOR.error(`Summarization failed: ${error.message}`);
    }
}

/**
 * Regenerate complete tables
 * @param {*} force Whether to force refresh
 * @param {*} silentUpdate Whether to perform silent update
 * @param chatToBeUsed
 * @returns
 */
export async function rebuildTableActions(force = false, silentUpdate = USER.tableBaseSetting.bool_silent_refresh, chatToBeUsed = '') {
    // #region Table summarization execution
    let r = '';
    if (!SYSTEM.lazy('rebuildTableActions', 1000)) return;

    console.log('Starting complete table regeneration');
    const isUseMainAPI = $('#use_main_api').prop('checked');
    try {
        const { piece } = BASE.getLastSheetsPiece();
        if (!piece) {
            throw new Error('findLastestTableData did not return valid table data');
        }
        const latestTables = BASE.hashSheetsToSheets(piece.hash_sheets).filter(sheet => sheet.enable);
        DERIVED.any.waitingTable = latestTables;
        DERIVED.any.waitingTableIdMap = latestTables.map(table => table.uid);

        const tableJson = latestTables.map((table, index) => ({...table.getReadableJson(), tableIndex: index}));
        const tableJsonText = JSON.stringify(tableJson);

        // Extract header information
        const tableHeaders = latestTables.map(table => {
            return {
                tableId: table.uid,
                headers: table.getHeader()
            };
        });
        const tableHeadersText = JSON.stringify(tableHeaders);

        console.log('Header data (JSON):', tableHeadersText);
        console.log('Reorganized - Latest table data:', tableJsonText);

        // Get last clear_up_stairs chat messages
        const chat = USER.getContext().chat;
        const lastChats = chatToBeUsed === '' ? await getRecentChatHistory(chat,
            USER.tableBaseSetting.clear_up_stairs,
            USER.tableBaseSetting.ignore_user_sent,
            USER.tableBaseSetting.rebuild_token_limit_value
        ) : chatToBeUsed;

        // Construct AI prompt
        const select = USER.tableBaseSetting.lastSelectedTemplate ?? "rebuild_base"
        const template = select === "rebuild_base" ? {
            name: "rebuild_base",
            system_prompt: USER.tableBaseSetting.rebuild_default_system_message_template,
            user_prompt_begin: USER.tableBaseSetting.rebuild_default_message_template,
        } : USER.tableBaseSetting.rebuild_message_template_list[select]
        if (!template) {
            console.error('Corresponding prompt template not found, please check configuration', select, template);
            EDITOR.error('Corresponding prompt template not found, please check configuration');
            return;
        }
        let systemPrompt = template.system_prompt
        let userPrompt = template.user_prompt_begin;

        let parsedSystemPrompt

        try {
            parsedSystemPrompt = JSON5.parse(systemPrompt)
            console.log('Parsed systemPrompt:', parsedSystemPrompt);
        } catch (error) {
            console.log("Parsing failed", error)
            parsedSystemPrompt = systemPrompt
        }

        const replacePrompt = (input) => {
            let output = input
            output = output.replace(/\$0/g, tableJsonText);
            output = output.replace(/\$1/g, lastChats);
            output = output.replace(/\$2/g, tableHeadersText);
            output = output.replace(/\$3/g, DERIVED.any.additionalPrompt ?? '');
            return output
        }

        if (typeof parsedSystemPrompt === 'string') {
            // Search for $0 and $1 fields in systemPrompt, replace $0 with originText, $1 with lastChats
            parsedSystemPrompt = replacePrompt(parsedSystemPrompt);
        } else {
            parsedSystemPrompt = parsedSystemPrompt.map(mes => ({ ...mes, content: replacePrompt(mes.content) }))
        }


        // Search for $0 and $1 fields in userPrompt, replace $0 with originText, $1 with lastChats, $2 with empty headers
        userPrompt = userPrompt.replace(/\$0/g, tableJsonText);
        userPrompt = userPrompt.replace(/\$1/g, lastChats);
        userPrompt = userPrompt.replace(/\$2/g, tableHeadersText);
        userPrompt = userPrompt.replace(/\$3/g, DERIVED.any.additionalPrompt ?? '');

        console.log('systemPrompt:', parsedSystemPrompt);
        // console.log('userPrompt:', userPrompt);

        // Generate response content
        let rawContent;
        if (isUseMainAPI) {
            try {
                rawContent = await handleMainAPIRequest(parsedSystemPrompt, userPrompt);
                if (rawContent === 'suspended') {
                    EDITOR.info('Operation canceled');
                    return
                }
            } catch (error) {
                EDITOR.clear();
                EDITOR.error('Main API request error: ' , error.message, error);
                console.error('Main API request error:', error);
            }
        }
        else {
            try {
                rawContent = await handleCustomAPIRequest(parsedSystemPrompt, userPrompt);
                if (rawContent === 'suspended') {
                    EDITOR.clear();
                    EDITOR.info('Operation canceled');
                    return
                }
            } catch (error) {
                EDITOR.clear();
                EDITOR.error('Custom API request error: ' , error.message, error);
            }
        }
        console.log('rawContent:', rawContent);

        // Check if rawContent is valid
        if (typeof rawContent !== 'string') {
            EDITOR.clear();
            EDITOR.error('API response content is invalid, cannot continue processing tables.');
            console.error('API response content is invalid, rawContent:', rawContent);
            return;
        }

        if (!rawContent.trim()) {
            EDITOR.clear();
            EDITOR.error('API response content is empty; empty responses are usually due to jailbreak issues');
            console.error('API response content is empty, rawContent:', rawContent);
            return;
        }

        const temp = USER.tableBaseSetting.rebuild_message_template_list[USER.tableBaseSetting.lastSelectedTemplate];
        if (temp && temp.parseType === 'text') {
            showTextPreview(rawContent);
        }

        console.log('Response content:', rawContent);
        let cleanContentTable = null;
        try{
            const parsed = safeParse(rawContent);
            cleanContentTable = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
        }catch (error) {
            console.error('Failed to parse response content:', error);
            EDITOR.clear();
            EDITOR.error('Failed to parse response content; please check if API returned content matches expected format.', error.message, error);
            showErrorTextPreview(rawContent);
            return;
        }
        
        console.log('cleanContent:', cleanContentTable);

        // Save tables back
        if (cleanContentTable) {
            try {
                // Validate data format
                if (!Array.isArray(cleanContentTable)) {
                    throw new Error("Generated new table data is not an array");
                }

                // If not silent update, show operation confirmation
                if (!silentUpdate) {
                    // Push uniqueActions content to user for confirmation
                    const confirmContent = confirmTheOperationPerformed(cleanContentTable);
                    const tableRefreshPopup = new EDITOR.Popup(confirmContent, EDITOR.POPUP_TYPE.TEXT, '', { okButton: "Continue", cancelButton: "Cancel" });
                    EDITOR.clear();
                    await tableRefreshPopup.show();
                    if (!tableRefreshPopup.result) {
                        EDITOR.info('Operation canceled');
                        return;
                    }
                }

                // Update chat history
                const { piece } = USER.getChatPiece()
                if (piece) {
                    for (const index in cleanContentTable) {
                        let sheet;
                        const table = cleanContentTable[index];
                        if (table.tableUid){
                            sheet = BASE.getChatSheet(table.tableUid)
                        }else if(table.tableIndex !== undefined) {
                            const uid = DERIVED.any.waitingTableIdMap[table.tableIndex]
                            sheet = BASE.getChatSheet(uid)
                        }else{
                            const uid = DERIVED.any.waitingTableIdMap[index]
                            sheet = BASE.getChatSheet(uid)
                        }
                        if(!sheet) {
                            console.error(`Cannot find corresponding sheet for table ${table.tableName}`);
                            continue;
                        }
                        const valueSheet = [table.columns, ...table.content].map(row => ['', ...row])
                        sheet.rebuildHashSheetByValueSheet(valueSheet);
                        sheet.save(piece, true)
                    }
                    await USER.getContext().saveChat(); // Wait for save to complete
                } else {
                    throw new Error("Chat history is empty; please have at least one chat message before summarizing");
                }

                BASE.refreshContextView();
                updateSystemMessageTableStatus();
                EDITOR.success('Table generation successful!');
            } catch (error) {
                console.error('Error saving tables:', error);
                EDITOR.error(`Table generation failed`, error.message, error);
            }
        } else {
            EDITOR.error("Table generation save failed: content is empty");
            true
        }

    } catch (e) {
        console.error('Error in rebuildTableActions:', e);
        return;
    } finally {

    }
    // #endregion
}

async function showTextPreview(text) {
    const previewHtml = `
        <div>
            <span style="margin-right: 10px;">Returned summary result; please copy for use</span>
        </div>
        <textarea rows="10" style="width: 100%">${text}</textarea>
    `;

    const popup = new EDITOR.Popup(previewHtml, EDITOR.POPUP_TYPE.TEXT, '', { wide: true });
    await popup.show();
}

async function showErrorTextPreview(text) {
    const previewHtml = `
        <div>
            <span style="margin-right: 10px;">This is the information returned by AI that couldn't be parsed by the script and stopped</span>
        </div>
        <textarea rows="10" style="width: 100%">${text}</textarea>
    `;

    const popup = new EDITOR.Popup(previewHtml, EDITOR.POPUP_TYPE.TEXT, '', { wide: true });
    await popup.show();
}

export async function rebuildSheets() {
    const container = document.createElement('div');
    console.log('Test started');


    const style = document.createElement('style');
    style.innerHTML = `
        .rebuild-preview-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .rebuild-preview-text {
            display: flex;
            justify-content: left
        }
    `;
    container.appendChild(style);

    // Replace jQuery append with standard DOM methods
    const h3Element = document.createElement('h3');
    h3Element.textContent = 'Rebuild table data';
    container.appendChild(h3Element);

    const previewDiv1 = document.createElement('div');
    previewDiv1.className = 'rebuild-preview-item';
    previewDiv1.innerHTML = `<span>Confirm after completion?:</span>${USER.tableBaseSetting.bool_silent_refresh ? 'No' : 'Yes'}`;
    container.appendChild(previewDiv1);

    const previewDiv2 = document.createElement('div');
    previewDiv2.className = 'rebuild-preview-item';
    previewDiv2.innerHTML = `<span>API:</span>${USER.tableBaseSetting.use_main_api ? 'Use main API' : 'Use backup API'}`;
    container.appendChild(previewDiv2);

    const hr = document.createElement('hr');
    container.appendChild(hr);

    // Create selector container
    const selectorContainer = document.createElement('div');
    container.appendChild(selectorContainer);

    // Add prompt template selector
    const selectorContent = document.createElement('div');
    selectorContent.innerHTML = `
        <span class="rebuild-preview-text" style="margin-top: 10px">Prompt template:</span>
        <select id="rebuild_template_selector" class="rebuild-preview-text text_pole" style="width: 100%">
            <option value="">Loading...</option>
        </select>
        <span class="rebuild-preview-text" style="margin-top: 10px">Template info:</span>
        <div id="rebuild_template_info" class="rebuild-preview-text" style="margin-top: 10px"></div>
        <span class="rebuild-preview-text" style="margin-top: 10px">Additional requirements:</span>
        <textarea id="rebuild_additional_prompt" class="rebuild-preview-text text_pole" style="width: 100%; height: 80px;"></textarea>
    `;
    selectorContainer.appendChild(selectorContent);

    // Initialize selector options
    const $selector = $(selectorContent.querySelector('#rebuild_template_selector'))
    const $templateInfo = $(selectorContent.querySelector('#rebuild_template_info'))
    const $additionalPrompt = $(selectorContent.querySelector('#rebuild_additional_prompt'))
    $selector.empty(); // Clear loading state

    const temps = USER.tableBaseSetting.rebuild_message_template_list
    // Add options
    Object.entries(temps).forEach(([key, prompt]) => {

        $selector.append(
            $('<option></option>')
                .val(key)
                .text(prompt.name || key)
        );
    });

    // Set default selection
    // Read last selected option from USER, use default if none exists
    const defaultTemplate = USER.tableBaseSetting?.lastSelectedTemplate || 'rebuild_base';
    $selector.val(defaultTemplate);
    // Update template info display
    if (defaultTemplate === 'rebuild_base') {
        $templateInfo.text("Default template, suitable for Gemini, Grok, DeepSeek. Uses chat history and table information to rebuild tables, applied in initial table filling, table optimization scenarios. Jailbreak originates from TT.");
    } else {
        const templateInfo = temps[defaultTemplate]?.info || 'No template info';
        $templateInfo.text(templateInfo);
    }


    // Listen for selector changes
    $selector.on('change', function () {
        const selectedTemplate = $(this).val();
        const template = temps[selectedTemplate];
        $templateInfo.text(template.info || 'No template info');
    })



    const confirmation = new EDITOR.Popup(container, EDITOR.POPUP_TYPE.CONFIRM, '', {
        okButton: "Continue",
        cancelButton: "Cancel"
    });

    await confirmation.show();
    if (confirmation.result) {
        const selectedTemplate = $selector.val();
        const additionalPrompt = $additionalPrompt.val();
        USER.tableBaseSetting.lastSelectedTemplate = selectedTemplate; // Save user-selected template
        DERIVED.any.additionalPrompt = additionalPrompt; // Save additional prompt content
        getPromptAndRebuildTable();
    }
}


// Parse tablesData back into Table array
function tableDataToTables(tablesData) {
    return tablesData.map(item => {
        // Ensure columns is an array with string elements
        const columns = Array.isArray(item.columns)
            ? item.columns.map(col => String(col)) // Force conversion to string
            : inferColumnsFromContent(item.content); // Infer from content
        return {
            tableName: item.tableName || 'Unnamed Table',
            columns,
            content: item.content || [],
            insertedRows: item.insertedRows || [],
            updatedRows: item.updatedRows || []
        }
    });
}

function inferColumnsFromContent(content) {
    if (!content || content.length === 0) return [];
    const firstRow = content[0];
    return firstRow.map((_, index) => `Column${index + 1}`);
}

/**
* Extract chat history functionality
* Extract last chatStairs chat messages
* @param {Array} chat - Chat history array
* @param {number} chatStairs - Number of chat messages to extract
* @param {boolean} ignoreUserSent - Whether to ignore user-sent messages
* @param {number|null} tokenLimit - Maximum token limit; null means unlimited, takes precedence over chatStairs
* @returns {string} Extracted chat history string
*/
async function getRecentChatHistory(chat, chatStairs, ignoreUserSent = false, tokenLimit = 0) {
    let filteredChat = chat;

    // Handle ignoring user-sent messages
    if (ignoreUserSent && chat.length > 0) {
        filteredChat = chat.filter(c => c.is_user === false);
    }

    // Valid record notification
    if (filteredChat.length < chatStairs && tokenLimit === 0) {
        EDITOR.success(`Current valid records: ${filteredChat.length}, less than configured ${chatStairs}`);
    }

    const collected = [];
    let totalTokens = 0;

    // Traverse from newest record backwards
    for (let i = filteredChat.length - 1; i >= 0; i--) {
        // Format message and clean tags
        const currentStr = `${filteredChat[i].name}: ${filteredChat[i].mes}`
            .replace(/<tableEdit>[\s\S]*?<\/tableEdit>/g, '');

        // Calculate tokens
        const tokens = await estimateTokenCount(currentStr);

        // If it's the first message and token count exceeds limit, add this message directly
        if (i === filteredChat.length - 1 && tokenLimit !== 0 && tokens > tokenLimit) {
            totalTokens = tokens;
            EDITOR.success(`Most recent chat record has ${tokens} tokens, exceeding configured limit of ${tokenLimit}; will use this chat record directly`);
            console.log(`Most recent chat record has ${tokens} tokens, exceeding configured limit of ${tokenLimit}; will use this chat record directly`);
            collected.push(currentStr);
            break;
        }

        // Token limit check
        if (tokenLimit !== 0 && (totalTokens + tokens) > tokenLimit) {
            EDITOR.success(`Chat records sent this time contain approximately ${totalTokens} tokens, totaling ${collected.length} messages`);
            console.log(`Chat records sent this time contain approximately ${totalTokens} tokens, totaling ${collected.length} messages`);
            break;
        }

        // Update counters
        totalTokens += tokens;
        collected.push(currentStr);

        // When tokenLimit is 0, check chat record count limit
        if (tokenLimit === 0 && collected.length >= chatStairs) {
            break;
        }
    }

    // Arrange chronologically and join
    const chatHistory = collected.reverse().join('\n');
    return chatHistory;
}

/**
 * Fix table format
 * @param {string} inputText - Input text
 * @returns {string} Fixed text
 * */
function fixTableFormat(inputText) {
    try {
        return safeParse(inputText);
    } catch (error) {
        console.error("Fix failed:", error);
        const popup = new EDITOR.Popup(`Script cannot parse returned data; may be due to jailbreak strength or formatting issues. Here's the returned data:<div>${inputText}</div>`, EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "OK" });
        popup.show();
        throw new Error('Cannot parse table data');
    }
}

window.fixTableFormat = fixTableFormat; // Expose globally

/**
 * Modify reorganization template
 */
export async function modifyRebuildTemplate() {
    const selectedTemplate = USER.tableBaseSetting.lastSelectedTemplate;
    const sheetConfig = {
        formTitle: "Edit Table Summarization Template",
        formDescription: "Set prompt structure for summarization: $0=current table data, $1=context chat history, $2=table template[header] data, $3=user-entered additional prompt",
        fields: [
            { label: 'Template name:', type: 'label', text: selectedTemplate },
            { label: 'System prompt', type: 'textarea', rows: 6, dataKey: 'system_prompt', description: '(Enter jailbreak, or enter complete prompt JSON structure; if structure entered, organization rules will be overridden)' },
            { label: 'Summarization rules', type: 'textarea', rows: 6, dataKey: 'user_prompt_begin', description: '(Instruct AI how to reorganize)' },
        ],
    }
    let initialData = null
    if (selectedTemplate === 'rebuild_base')
        return EDITOR.warning('Default template cannot be modified; please create a new template');
    else
        initialData = USER.tableBaseSetting.rebuild_message_template_list[selectedTemplate]
    const formInstance = new Form(sheetConfig, initialData);
    const popup = new EDITOR.Popup(formInstance.renderForm(), EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Save", allowVerticalScrolling: true, cancelButton: "Cancel" });
    await popup.show();
    if (popup.result) {
        const result = formInstance.result();
        USER.tableBaseSetting.rebuild_message_template_list = {
            ...USER.tableBaseSetting.rebuild_message_template_list,
            [selectedTemplate]: {
                ...result,
                name: selectedTemplate,
            }
        }
        EDITOR.success(`Modified template "${selectedTemplate}" successfully`);
    }
}
/*         

/**
 * Create new reorganization template
 */
export async function newRebuildTemplate() {
    const sheetConfig = {
        formTitle: "Create New Table Summarization Template",
        formDescription: "Set prompt structure for table summarization: $0=current table data, $1=context chat history, $2=table template[header] data, $3=user-entered additional prompt",
        fields: [
            { label: 'Template name', type: 'text', dataKey: 'name' },
            { label: 'System prompt', type: 'textarea', rows: 6, dataKey: 'system_prompt', description: '(Enter jailbreak, or enter complete prompt JSON structure; if structure entered, organization rules will be overridden)' },
            { label: 'Organization rules', type: 'textarea', rows: 6, dataKey: 'user_prompt_begin', description: '(Instruct AI how to reorganize)' },
        ],
    }
    const initialData = {
        name: "New Table Summarization Template",
        system_prompt: USER.tableBaseSetting.rebuild_default_system_message_template,
        user_prompt_begin: USER.tableBaseSetting.rebuild_default_message_template,
    };
    const formInstance = new Form(sheetConfig, initialData);
    const popup = new EDITOR.Popup(formInstance.renderForm(), EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Save", allowVerticalScrolling: true, cancelButton: "Cancel" });
    await popup.show();
    if (popup.result) {
        const result = formInstance.result();
        const name = createUniqueName(result.name)
        result.name = name;
        USER.tableBaseSetting.rebuild_message_template_list = {
            ...USER.tableBaseSetting.rebuild_message_template_list,
            [name]: result
        }
        USER.tableBaseSetting.lastSelectedTemplate = name;
        refreshRebuildTemplate()
        EDITOR.success(`Created template "${name}" successfully`);
    }
}

/**
 * Create unique name
 * @param {string} baseName - Base name
 */
function createUniqueName(baseName) {
    let name = baseName;
    let counter = 1;
    while (USER.tableBaseSetting.rebuild_message_template_list[name]) {
        name = `${baseName} (${counter})`;
        counter++;
    }
    return name;
}

/**
 * Delete reorganization template
 */
export async function deleteRebuildTemplate() {
    const selectedTemplate = USER.tableBaseSetting.lastSelectedTemplate;
    if (selectedTemplate === 'rebuild_base') {
        return EDITOR.warning('Default template cannot be deleted');
    }
    const confirmation = await EDITOR.callGenericPopup('Delete this template?', EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Continue", cancelButton: "Cancel" });
    if (confirmation) {
        const newTemplates = {};
        Object.values(USER.tableBaseSetting.rebuild_message_template_list).forEach((template) => {
            if (template.name !== selectedTemplate) {
                newTemplates[template.name] = template;
            }
        });
        USER.tableBaseSetting.rebuild_message_template_list = newTemplates;
        USER.tableBaseSetting.lastSelectedTemplate = 'rebuild_base';
        refreshRebuildTemplate();
        EDITOR.success(`Deleted template "${selectedTemplate}" successfully`);
    }
}

/**
 * Export reorganization template
 */
export async function exportRebuildTemplate() {
    const selectedTemplate = USER.tableBaseSetting.lastSelectedTemplate;
    if (selectedTemplate === 'rebuild_base') {
        return EDITOR.warning('Default template cannot be exported');
    }
    const template = USER.tableBaseSetting.rebuild_message_template_list[selectedTemplate];
    if (!template) {
        return EDITOR.error(`Template "${selectedTemplate}" not found`);
    }
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    EDITOR.success(`Exported template "${selectedTemplate}" successfully`);
}

/**
 * Import reorganization template
 */
export async function importRebuildTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            EDITOR.error('No file selected');
            return;
        }
        try {
            const text = await file.text();
            const template = JSON.parse(text);
            if (!template.name || !template.system_prompt || !template.user_prompt_begin) {
                throw new Error('Invalid template format');
            }
            const name = createUniqueName(template.name);
            template.name = name;
            USER.tableBaseSetting.rebuild_message_template_list = {
                ...USER.tableBaseSetting.rebuild_message_template_list,
                [name]: template
            };
            USER.tableBaseSetting.lastSelectedTemplate = name;
            refreshRebuildTemplate();
            EDITOR.success(`Imported template "${name}" successfully`);
        } catch (error) {
            EDITOR.error(`Import failed`, error.message, error);
        } finally {
            document.body.removeChild(input);
        }
    });

    input.click();
}

/**
 * Manually trigger step-by-step table filling
 */
export async function triggerStepByStepNow() {
    console.log('[Memory Enhancement] Manually triggering step-by-step update...');
    TableTwoStepSummary("manual")
}

/**
 * Execute incremental update (can be used for normal refresh and step-by-step summarization)
 * @param {string} chatToBeUsed - Chat history to use; if empty, uses most recent chat history
 * @param {string} originTableText - Current table text representation
 * @param {Array} referencePiece - Reference piece
 * @param {boolean} useMainAPI - Whether to use main API
 * @param {boolean} silentUpdate - Whether to perform silent update without showing operation confirmation
 * @param {boolean} [isSilentMode=false] - Whether to run API calls in silent mode (without loading indicator)
 * @returns {Promise<string>} 'success', 'suspended', 'error', or empty
 */
export async function executeIncrementalUpdateFromSummary(
    chatToBeUsed = '',
    originTableText,
    finalPrompt,
    referencePiece,
    useMainAPI,
    silentUpdate = USER.tableBaseSetting.bool_silent_refresh,
    isSilentMode = false
) {
    if (!SYSTEM.lazy('executeIncrementalUpdate', 1000)) return '';

    try {
        DERIVED.any.waitingPiece = referencePiece;
        const separateReadContextLayers = Number($('#separateReadContextLayers').val());
        const contextChats = await getRecentChatHistory(USER.getContext().chat, separateReadContextLayers, true);
        const summaryChats = chatToBeUsed;

        // Get character lorebook content
        let lorebookContent = '';
        if (USER.tableBaseSetting.separateReadLorebook && window.TavernHelper) {
            try {
                const charLorebooks = await window.TavernHelper.getCharLorebooks({ type: 'all' });
                const bookNames = [];
                if (charLorebooks.primary) {
                    bookNames.push(charLorebooks.primary);
                }
                if (charLorebooks.additional && charLorebooks.additional.length > 0) {
                    bookNames.push(...charLorebooks.additional);
                }

                for (const bookName of bookNames) {
                    if (bookName) {
                        const entries = await window.TavernHelper.getLorebookEntries(bookName);
                        if (entries && entries.length > 0) {
                            lorebookContent += entries.map(entry => entry.content).join('\n');
                        }
                    }
                }
            } catch (e) {
                console.error('[Memory Enhancement] Error fetching lorebook content:', e);
            }
        }

        let systemPromptForApi;
        let userPromptForApi;

        console.log("[Memory Enhancement] Step-by-step summary: Parsing and using multi-message template string.");
        const stepByStepPromptString = USER.tableBaseSetting.step_by_step_user_prompt;
        let promptMessages;

        try {
            promptMessages = JSON5.parse(stepByStepPromptString);
            if (!Array.isArray(promptMessages) || promptMessages.length === 0) {
                throw new Error("Parsed prompt is not a valid non-empty array.");
            }
        } catch (e) {
            console.error("Error parsing step_by_step_user_prompt string:", e, "Raw string:", stepByStepPromptString);
            EDITOR.error("Step-by-step fill prompt format error, cannot parse. Please check plugin settings.", e.message, e);
            return 'error';
        }

        const replacePlaceholders = (text) => {
            if (typeof text !== 'string') return '';
            text = text.replace(/(?<!\\)\$0/g, () => originTableText);
            text = text.replace(/(?<!\\)\$1/g, () => contextChats);
            text = text.replace(/(?<!\\)\$2/g, () => summaryChats);
            text = text.replace(/(?<!\\)\$3/g, () => finalPrompt);
            text = text.replace(/(?<!\\)\$4/g, () => lorebookContent);
            return text;
        };

        // Fully process message array, replacing placeholders in each message
        const processedMessages = promptMessages.map(msg => ({
            ...msg,
            content: replacePlaceholders(msg.content)
        }));

        // Pass fully processed message array to API request handler
        systemPromptForApi = processedMessages;
        userPromptForApi = null; // In this case, userPromptForApi is no longer needed

        console.log("Step-by-step: Prompts constructed from parsed multi-message template and sent as an array.");

        // Print final data to be sent to API
        if (Array.isArray(systemPromptForApi)) {
            console.log('API-bound data (as message array):', systemPromptForApi);
            const totalContent = systemPromptForApi.map(m => m.content).join('');
            console.log('Estimated token count:', estimateTokenCount(totalContent));
        } else {
            console.log('System Prompt for API:', systemPromptForApi);
            console.log('User Prompt for API:', userPromptForApi);
            console.log('Estimated token count:', estimateTokenCount(systemPromptForApi + (userPromptForApi || '')));
        }

        let rawContent;
        if (useMainAPI) { // Using Main API
            try {
                // If it's step-by-step summary, systemPromptForApi is already the message array
                // Pass the array as the first arg and null/empty as the second for multi-message format
                // Otherwise, pass the separate system and user prompts for normal refresh
                rawContent = await handleMainAPIRequest(
                    systemPromptForApi,
                    null,
                    isSilentMode
                );
                if (rawContent === 'suspended') {
                    EDITOR.info('Operation canceled (Main API)');
                    return 'suspended';
                }
            } catch (error) {
                console.error('Main API request error:', error);
                EDITOR.error('Main API request error: ' , error.message, error);
                return 'error';
            }
        } else { // Using Custom API
            try {
                rawContent = await handleCustomAPIRequest(systemPromptForApi, userPromptForApi, true, isSilentMode);
                if (rawContent === 'suspended') {
                    EDITOR.info('Operation canceled (Custom API)');
                    return 'suspended';
                }
            } catch (error) {
                EDITOR.error('Custom API request error: ' , error.message, error);
                return 'error';
            }
        }

        if (typeof rawContent !== 'string' || !rawContent.trim()) {
            EDITOR.error('API response content is invalid or empty.');
            return 'error';
        }

        // **Core fix**: Use exactly the same getTableEditTag function as regular table filling to extract instructions
        const { matches } = getTableEditTag(rawContent);

        if (!matches || matches.length === 0) {
            EDITOR.info("AI did not return any valid <tableEdit> operation instructions; table content remains unchanged.");
            return 'success';
        }

        try {
            // Pass extracted, unmodified original instruction array to executor
            executeTableEditActions(matches, referencePiece)
        } catch (e) {
            EDITOR.error("Error executing table operation instructions: ", e.message, e);
            console.error("Original error: ", matches.join('\n'));
        }
        USER.saveChat()
        BASE.refreshContextView();
        updateSystemMessageTableStatus();
        EDITOR.success('Step-by-step table filling completed!');
        return 'success';

    } catch (error) {
        console.error('Error during incremental update execution:', error);
        EDITOR.error(`Incremental update execution failed`, error.message, error);
        console.log('[Memory Enhancement Plugin] Error context:', {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
        });
        return 'error';
    }
}
