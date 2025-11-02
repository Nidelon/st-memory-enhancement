// tablePushToChat.js
import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../../core/manager.js';
import { parseSheetRender, loadValueSheetBySheetHashSheet } from "./sheetCustomRenderer.js";
import { replaceUserTag } from "../../utils/stringUtil.js";


/**
 * Replace custom styles with HTML-compliant styles
 * @param {string} replace - Custom style string
 * @param {string} _viewSheetsContainer - DOM element serving as the worksheet container
 * @returns {string} - Style string after replacement
 */
function divideCumstomReplace(replace, _viewSheetsContainer) {
    let viewSheetsContainer = '';
    const replaceContent = replace;

    // 1. Extract complete <style> and <script> tags
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;

    viewSheetsContainer += (replaceContent.match(styleRegex) || []).join('');
    viewSheetsContainer += (replaceContent.match(scriptRegex) || []).join('');

    // 2. Remove tags (including <style> and <script>)
    let dividedContent = replaceContent
        .replace(/<!DOCTYPE html[^>]*>/gi, '')
        .replace(/<html[^>]*>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head[^>]*>/gi, '')
        .replace(/<\/head>/gi, '')
        .replace(styleRegex, '')  // New: remove <style> tags
        .replace(scriptRegex, ''); // New: remove <script> tags

    // 3. Append styles and scripts to the container
    $(_viewSheetsContainer).append(viewSheetsContainer);
    // console.log('Separated style data inside function:', dividedContent);
    return dividedContent;
}

/**
 * Interleaved and embedded rendering
 * @param {@table} tableRole - Nested array extracted by rows with identical names
 * @param {Array} insertMark - Flags indicating whether embedding is enabled
 * @param {Array} cycleMark - Cycle markers
 * @param {Array} indexForTableRole - Indices corresponding to elements in the nested array
 * @param {Array} _sheets - Tables
 * @param {HTMLElement} _viewSheetsContainer - DOM element serving as the worksheet container
 */
function insertCustomRender(tableRole, insertMark, cycleMark, indexForTableRole, _sheets, _viewSheetsContainer) {
    let customStyle = '';
    let index = 0;
    for (let i = 0; i < tableRole.length; i++) {
        index = indexForTableRole[i]
        // console.log("Interleaved and embedded rendering table role index:" + index);
        // console.log(_sheets[index].name, "Interleaved and embedded rendering table role:" + tableRole[i]);
        _sheets[index].tableSheet = tableRole[i];
        // console.log("Interleaved and embedded rendering table role assigned to sheet:", _sheets[index].name, _sheets[index].tableSheet);
        const customContent = parseSheetRender(_sheets[index]);
        // console.log("Interleaved and embedded rendering table returns text customContentt:" + customContent);
        const placeholderPattern = `<replaceHolder${index}([^>]*)><\\/replaceHolder${index}>`;
        const placeholderRegex = new RegExp(placeholderPattern, 'g');

        if (insertMark[i] && customStyle.match(placeholderRegex)) {
            customStyle = customStyle.replace(placeholderRegex, customContent);
        } else {
            customStyle += customContent;
        }
    }
    // console.log("Interleaved and embedded final returned text customStyle:" + customStyle);
    const sheetContainer = document.createElement('div')    // DOM element serving as the worksheet container
    sheetContainer.innerHTML = replaceUserTag(customStyle) // Replace <user> tags in custom styles
    $(_viewSheetsContainer).append(sheetContainer)
}


/**
 * Render worksheet using custom styles
 * @param {@table} sheet - Worksheet data
 * @param {HTMLElement} _viewSheetsContainer - DOM element serving as the worksheet container
 */
function ordinarycustomStyleRender(sheet, _viewSheetsContainer) {
    // console.log('Ordinary table data:', sheet.tableSheet);
    const customStyle = parseSheetRender(sheet)             // Parse worksheet using parseSheetRender
    const sheetContainer = document.createElement('div')    // DOM element serving as the worksheet container
    sheetContainer.innerHTML = replaceUserTag(customStyle) // Replace <user> tags in custom styles
    $(_viewSheetsContainer).append(sheetContainer)
}

/**
 * Render worksheet using default styles
 * @param {*} index - Worksheet index
 * @param {*} sheet - Worksheet data
 * @param {*} _viewSheetsContainer - DOM element serving as the worksheet container
 */
function defaultStyleRender(index, sheet, _viewSheetsContainer) {
    const instance = sheet
    const sheetContainer = document.createElement('div')
    const sheetTitleText = document.createElement('h3')
    sheetContainer.style.overflowX = 'none'
    sheetContainer.style.overflowY = 'auto'
    sheetTitleText.innerText = `#${index} ${sheet.name}`

    let sheetElement = null
    sheetElement = instance.renderSheet(cell => cell.element.style.cursor = 'default')
    $(sheetContainer).append(sheetElement)

    $(_viewSheetsContainer).append(sheetTitleText)
    $(_viewSheetsContainer).append(sheetContainer)
    $(_viewSheetsContainer).append(`<hr>`)
}
/** Helper function to determine whether row i and row i+1 in the sorted array belong to the same table's cyclic rows. Returns true if they do, false otherwise.
 * @param {*} cycleDivideMark  - Cycle marker
 * @param {*} indexForRowAlternate - Original table index corresponding to each row
 * @param {*} i - Row number
 * @returns - Boolean value
 */
function cycleJudge(cycleDivideMark, indexForRowAlternate, i) {
    if (i < 0) return false;
    return cycleDivideMark[indexForRowAlternate[i]] === true && cycleDivideMark[indexForRowAlternate[i + 1]] === true && indexForRowAlternate[i] === indexForRowAlternate[i + 1];
}
/** Render multiple worksheets into a specified DOM container based on their configuration (whether to use custom styles). Supports two rendering modes: custom style rendering and default style rendering. Custom styles are further divided into ordinary rendering and interleaved rendering.
 *
 * @param {*table} _sheets - Array of worksheets containing multiple worksheet data
 * @param {*} _viewSheetsContainer - DOM element serving as the worksheet container
 */
async function renderEditableSheetsDOM(_sheets, _viewSheetsContainer) {
    let sumAlternateLevel = 0;          // Counter to track the number of tables requiring interleaving
    let levelIndexAlternate = [];       // Track level indices requiring interleaving
    let indexOriginary = [];      // Record indices of tables using ordinary custom styles
    let cycleDivideMark = [];       // Marker indicating whether a table has internal cyclic output
    console.log("Is interleaved mode enabled:" + USER.tableBaseSetting.alternate_switch)
    if (USER.tableBaseSetting.alternate_switch) {    // First check if interleaved mode is enabled, then determine if interleaving logic is needed
        for (let [index, sheet] of _sheets.entries()) {
            if (sheet.config.useCustomStyle === true) {
                _sheets[index].config.customStyles[sheet.config.selectedCustomStyleKey].replaceDivide = divideCumstomReplace(sheet.config.customStyles[sheet.config.selectedCustomStyleKey].replace, _viewSheetsContainer); // Organize CSS code to make final text more HTML-compliant
            }
            if (sheet.config.toChat === true && sheet.config.useCustomStyle === true && sheet.config.alternateTable === true && sheet.config.alternateLevel > 0) {
                sumAlternateLevel++;        // Increment counter for qualifying tables
                levelIndexAlternate.push([Number(sheet.config.alternateLevel), index]); // Add level-index pairs to array, enforce numeric type for robustness
                sheet.config.skipTop = false;  // Interleaved mode renders only table content and does not skip header rows
                cycleDivideMark[index] = sheet.config.customStyles[sheet.config.selectedCustomStyleKey].replace.includes('<cycleDivide>');
            }
            else if (sheet.config.toChat === true) {
                indexOriginary.push(index); // Add index of ordinary custom-style tables
            }
        }
    }
    if (sumAlternateLevel > 0) {
        // console.log('Interleaved mode');
        let tableAlternate = [];  // Store tables requiring interleaving
        let indexForRowAlternate = [];  // Record original table indices corresponding to rows after sorting
        // console.log('Initial level-index mapping:', levelIndexAlternate);
        levelIndexAlternate.sort((a, b) => {  // Ensure stable sorting
            if (a[0] !== b[0]) {
                return a[0] - b[0]; // Different levels: sort by level
            } else {
                return a[1] - b[1]; // Same level: sort by original index (ensures stability)
            }
        });
        // Obtain tables to sort and record original indices
        for (const [level, index] of levelIndexAlternate) {
            const sheetData = loadValueSheetBySheetHashSheet(_sheets[index]).slice(1);
            // Flatten all rows of each table into tableAlternate
            sheetData.forEach(row => {
                tableAlternate.push(row);
                indexForRowAlternate.push(index); // Record original table index
            });
        }


        // Create an array of objects containing row data, original table index, and current index
        const indexedTable = tableAlternate.map((row, currentIndex) => ({
            row,
            originalIndex: indexForRowAlternate[currentIndex],
            currentIndex
        }));

        // Sort (by role name in column 2)
        indexedTable.sort((a, b) => {
            const clean = (str) => String(str).trim().replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase();
            const roleA = clean(a.row[1]) || "";
            const roleB = clean(b.row[1]) || "";

            // Create mapping of first appearance index for each role
            const firstAppearance = new Map();
            indexedTable.forEach((item, idx) => {
                const role = clean(item.row[1]);
                if (!firstAppearance.has(role)) {
                    firstAppearance.set(role, idx);
                }
            });

            // Role-grouped sorting
            if (roleA !== roleB) {
                return firstAppearance.get(roleA) - firstAppearance.get(roleB);
            }
        });

        // Extract sorted rows and corresponding original table indices
        tableAlternate = indexedTable.map(item => item.row);
        indexForRowAlternate = indexedTable.map(item => item.originalIndex);
        let tableRole = [];     // Temporary helper array for grouping rows with identical names
        let insertMark = [];    // Flag indicating whether embedded rendering is needed
        let cycleMark = [];     // Temporary helper array for cycle markers
        let indexForTableRole = [];
        let j = 0;              // Marker variable
        // console.log("Sorted table:", tableAlternate);
        // Interleaved + merged table rendering
        for (let i = 0; i < tableAlternate.length; i++) {
            // console.log('Current row:', i, tableAlternate[i][1])
            if (i === tableAlternate.length - 1) {
                if (cycleJudge(cycleDivideMark, indexForRowAlternate, i - 1) || cycleJudge(cycleDivideMark, indexForRowAlternate, i)) {
                    tableRole[j].push(tableAlternate[i]);
                } else {
                    tableRole.push([tableAlternate[i]]);
                    indexForTableRole[j] = indexForRowAlternate[i];
                    insertMark[j] = _sheets[indexForRowAlternate[i]].config.insertTable;
                    cycleMark[j] = false;
                }
                // console.log('Final row extraction complete:', j, tableAlternate[i][1])
                // console.log('Final row extraction complete tableRole', tableRole);
                insertCustomRender(tableRole, insertMark, cycleMark, indexForTableRole, _sheets, _viewSheetsContainer)
            } else if (tableAlternate[i][1] === tableAlternate[i + 1][1]) {
                if (cycleJudge(cycleDivideMark, indexForRowAlternate, i - 1) || cycleJudge(cycleDivideMark, indexForRowAlternate, i)) {  // Mark cyclic rows into same nested array
                    if (!tableRole[j]) {   // Determine if cycle start is marked
                        tableRole[j] = [];
                        indexForTableRole[j] = indexForRowAlternate[i];
                        insertMark[j] = _sheets[indexForRowAlternate[i]].config.insertTable;
                        cycleMark[j] = true;
                        // console.log('Cycle marker start', j, i);
                        // console.log('Cycle marker start tableRole:', tableRole);
                    }
                    tableRole[j].push(tableAlternate[i]);
                    if (!cycleJudge(cycleDivideMark, indexForRowAlternate, i)) {  // Determine if cycle end is marked
                        j++;
                        // console.log('Cycle marker end', j, i);
                    }
                } else {                                                        // Non-cyclic rows go into separate nested arrays
                    tableRole.push([tableAlternate[i]]);
                    indexForTableRole[j] = indexForRowAlternate[i];
                    insertMark[j] = _sheets[indexForRowAlternate[i]].config.insertTable;
                    cycleMark[j] = false;
                    // console.log('Non-cyclic input extraction:', _sheets[indexForRowAlternate[i]].name, j, i);
                    j++;
                }

            } else {
                if (cycleJudge(cycleDivideMark, indexForRowAlternate, i - 1) || cycleJudge(cycleDivideMark, indexForRowAlternate, i)) {
                    tableRole[j].push(tableAlternate[i]);
                    if (!cycleJudge(cycleDivideMark, indexForRowAlternate, i)) {  // Determine if cycle end is marked
                        j++;
                        // console.log('Cycle marker end', j, i);
                    }
                } else {
                    tableRole.push([tableAlternate[i]]);
                    indexForTableRole[j] = indexForRowAlternate[i];
                    insertMark[j] = _sheets[indexForRowAlternate[i]].config.insertTable;
                }
                // console.log('Same-name row extraction complete:', j, tableAlternate[i][1])
                // console.log('Same-name row extraction complete tableRole', tableRole);
                insertCustomRender(tableRole, insertMark, cycleMark, indexForTableRole, _sheets, _viewSheetsContainer)
                tableRole = [];
                j = 0;
            }
        }

        // Render ordinary tables
        // console.log('Ordinary table indices:', indexOriginary, 'Ordinary table count', indexOriginary.length);
        for (let i = 0; i < indexOriginary.length; i++) {
            let sheet = _sheets[indexOriginary[i]];
            sheet.tableSheet = loadValueSheetBySheetHashSheet(sheet);
            // console.log('Ordinary rendering current ordinary table content:',sheet.tableSheet);
            if (sheet.config.toChat === false) continue; // Skip if not pushed to chat
            if (sheet.config.useCustomStyle === true) {
                // Ensure customStyles exists and selected style has replace property
                if (sheet.config.customStyles &&
                    sheet.config.selectedCustomStyleKey &&
                    sheet.config.customStyles[sheet.config.selectedCustomStyleKey]?.replace) {
                    sheet.tableSheet = loadValueSheetBySheetHashSheet(sheet);
                    ordinarycustomStyleRender(sheet, _viewSheetsContainer);
                    continue; // Skip default rendering after processing
                }
            }
            defaultStyleRender(indexOriginary[i], sheet, _viewSheetsContainer);

        }
    }
    else {
        // console.log('Entering ordinary rendering mode');
        for (let [index, sheet] of _sheets.entries()) {
            // Skip if not pushed to chat
            if (sheet.config.toChat === false) continue;

            // Check if custom styles are used and conditions are met
            if (sheet.config.useCustomStyle === true) {
                // Ensure customStyles exists and selected style has replace property
                if (sheet.config.customStyles &&
                    sheet.config.selectedCustomStyleKey &&
                    sheet.config.customStyles[sheet.config.selectedCustomStyleKey]?.replace) {

                    sheet.tableSheet = loadValueSheetBySheetHashSheet(sheet);
                    ordinarycustomStyleRender(sheet, _viewSheetsContainer);
                    continue; // Skip default rendering after processing
                }
            }

            // Default style rendering (covers cases where useCustomStyle=false or customStyles conditions aren't met)
            defaultStyleRender(index, sheet, _viewSheetsContainer);
        }
    }
}

/**
 * Push table data to chat content for display
 * @param sheets
 */
function replaceTableToStatusTag(sheets) {
    let chatContainer
    if (USER.tableBaseSetting.table_to_chat_mode === 'context_bottom') {
        chatContainer = window.document.querySelector('#chat');
    } else if (USER.tableBaseSetting.table_to_chat_mode === 'last_message') {
        chatContainer = window.document.querySelector('.last_mes')?.querySelector('.mes_text'); // Get container of last message
    } else if (USER.tableBaseSetting.table_to_chat_mode === 'macro') {
        // Find location of {{sheetsView}} in document

    }

    // Define named event listener functions
    const touchstartHandler = function (event) {
        event.stopPropagation();
    };
    const touchmoveHandler = function (event) {
        event.stopPropagation();
    };
    const touchendHandler = function (event) {
        event.stopPropagation();
    };

    setTimeout(async () => {
        // Note race condition: previous tableStatusContainer might not have been added before setTimeout executes
        const currentTableStatusContainer = document.querySelector('#tableStatusContainer');
        if (currentTableStatusContainer) {
            // Remove previous event listeners to prevent duplication (unlikely in this scenario but safe)
            currentTableStatusContainer.removeEventListener('touchstart', touchstartHandler);
            currentTableStatusContainer.removeEventListener('touchmove', touchmoveHandler);
            currentTableStatusContainer.removeEventListener('touchend', touchendHandler);
            currentTableStatusContainer?.remove(); // Remove old tableStatusContainer
        }

        // Add new tableStatusContainer here
        const r = USER.tableBaseSetting.to_chat_container.replace(/\$0/g, `<tableStatus id="table_push_to_chat_sheets"></tableStatus>`);
        $(chatContainer).append(`<div class="wide100p" id="tableStatusContainer">${r}</div>`); // Add new tableStatusContainer
        const tableStatusContainer = chatContainer?.querySelector('#table_push_to_chat_sheets');
        renderEditableSheetsDOM(sheets, tableStatusContainer);

        // Get newly created tableStatusContainer
        const newTableStatusContainer = chatContainer?.querySelector('#tableStatusContainer');
        if (newTableStatusContainer) {
            // Add event listeners using named functions
            newTableStatusContainer.addEventListener('touchstart', touchstartHandler, { passive: false });
            newTableStatusContainer.addEventListener('touchmove', touchmoveHandler, { passive: false });
            newTableStatusContainer.addEventListener('touchend', touchendHandler, { passive: false });
        }
        // console.log('tableStatusContainer:', newTableStatusContainer);
    }, 0);
}

/**
 * Update <tableStatus> tag content in the last System message
 */
export function updateSystemMessageTableStatus(force = false) {
    console.log("Update <tableStatus> tag content in last System message", USER.tableBaseSetting.isTableToChat)
    if (force === false) {
        if (USER.tableBaseSetting.isExtensionAble === false || USER.tableBaseSetting.isTableToChat === false) {
            window.document.querySelector('#tableStatusContainer')?.remove();
            return;
        }
    }
    // console.log("Update last System ")
    const sheets = BASE.hashSheetsToSheets(BASE.getLastSheetsPiece()?.piece.hash_sheets);

    replaceTableToStatusTag(sheets);
}
/**
 * Trigger interleaved mode
 */
export function updateAlternateTable() {

    const sheets = BASE.hashSheetsToSheets(BASE.getLastSheetsPiece()?.piece.hash_sheets);

    replaceTableToStatusTag(sheets);
}

/**
 * New code: open custom table push renderer popup
 * @returns {Promise<void>}
 */
export async function openTableRendererPopup() {
    const manager = await SYSTEM.getTemplate('customSheetStyle');
    const tableRendererPopup = new EDITOR.Popup(manager, EDITOR.POPUP_TYPE.TEXT, '', { large: true, wide: true, allowVerticalScrolling: true });
    const sheetsData = BASE.getLastSheetsPiece()?.piece.hash_sheets;
    if (!sheetsData) {
        // console.warn("openTableRendererPopup: Failed to obtain valid table object.");
        return;
    }
    const sheets = BASE.hashSheetsToSheets(sheetsData)[0];
    let sheetElements = '';
    for (let sheet of sheets) {
        if (!sheet.tochat) continue;
        if (!sheet.data.customStyle || sheet.data.customStyle === '') {
            sheetElements += sheet.renderSheet().outerHTML;
            continue;
        }
        // parseTableRender()
    }

    const $dlg = $(tableRendererPopup.dlg);
    const $htmlEditor = $dlg.find('#htmlEditor');
    const $tableRendererDisplay = $dlg.find('#tableRendererDisplay');

    // Render in real-time during editing
    console.log("openTableRendererPopup-elements.rendererDisplay exists:", !!elements.rendererDisplay);
    console.log("jQuery object length:", elements.rendererDisplay?.length || 0);
    const renderHTML = () => {
        $tableRendererDisplay.html(sheetElements);
    };

    renderHTML();
    $htmlEditor.on('input', renderHTML); // Listen for input events and render in real-time

    await tableRendererPopup.show();
}
