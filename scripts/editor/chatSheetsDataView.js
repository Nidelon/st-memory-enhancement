import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../../core/manager.js';
import { updateSystemMessageTableStatus } from "../renderer/tablePushToChat.js";
import { findNextChatWhitTableData, undoSheets } from "../../index.js";
import { rebuildSheets } from "../runtime/absoluteRefresh.js";
import { openTableHistoryPopup } from "./tableHistory.js";
import { PopupMenu } from "../../components/popupMenu.js";
import { openTableStatisticsPopup } from "./tableStatistics.js";
import { openCellHistoryPopup } from "./cellHistory.js";
import { openSheetStyleRendererPopup } from "./sheetStyleEditor.js";
import { Cell } from "../../core/table/cell.js";

let tablePopup = null
let copyTableData = null
let selectedCell = null
let editModeSelectedRows = []
let viewSheetsContainer = null
const userTableEditInfo = {
    chatIndex: null,
    editAble: false,
    tables: null,
    tableIndex: null,
    rowIndex: null,
    colIndex: null,
}

/**
 * Copy table
 * @param {*} tables All table data
 */
export async function copyTable() {
    copyTableData = JSON.stringify(getTableJson({ type: 'chatSheets', version: 1 }))
    if (!copyTableData) return
    $('#table_drawer_icon').click()

    EDITOR.confirm(`Copying table data (#${SYSTEM.generateRandomString(4)})`, 'Cancel', 'Paste into current conversation').then(async (r) => {
        if (r) {
            await pasteTable()
        }
        if ($('#table_drawer_icon').hasClass('closedIcon')) {
            $('#table_drawer_icon').click()
        }
    })
}

/**
 * Paste table
 * @param {number} mesId Message ID to paste into
 * @param {Element} viewSheetsContainer Table container DOM
 */
async function pasteTable() {
    if (USER.getContext().chat.length === 0) {
        EDITOR.error("No message context available. Tables are stored in chat history. Please have at least one conversation round before retrying.")
        return
    }
    const confirmation = await EDITOR.callGenericPopup('Pasting will clear existing table data. Continue?', EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Continue", cancelButton: "Cancel" });
    if (confirmation) {
        if (copyTableData) {
            const tables = JSON.parse(copyTableData)
            if (!tables.mate === 'chatSheets') return EDITOR.error("Import failed: Invalid file format")
            BASE.applyJsonToChatSheets(tables)
            await renderSheetsDOM()
            EDITOR.success('Paste successful')
        } else {
            EDITOR.error("Paste failed: No table data in clipboard")
        }
    }
}

/**
 * Import table
 * @param {number} mesId Message ID to import table into
 */
async function importTable(mesId, viewSheetsContainer) {
    if (mesId === -1) {
        EDITOR.error("No message context available. Tables are stored in chat history. Please have at least one conversation round before retrying.")
        return
    }

    // 1. Create an input element of type 'file' for file selection
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    // Set accept attribute to restrict selection to JSON files for better UX
    fileInput.accept = '.json';

    // 2. Add event listener for file selection (change event)
    fileInput.addEventListener('change', function (event) {
        // Get selected files (FileList object)
        const files = event.target.files;

        // Check if any file was selected
        if (files && files.length > 0) {
            // Get the first selected file (assuming only one JSON file is selected)
            const file = files[0];

            // 3. Create FileReader object to read file contents
            const reader = new FileReader();

            // 4. Define onload event handler for FileReader
            // This fires when file reading succeeds
            reader.onload = async function (loadEvent) {
                const button = { text: 'Import template and data', result: 3 }
                const popup = new EDITOR.Popup("Select what to import", EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Import template and data", cancelButton: "Cancel" });
                const result = await popup.show()
                if (result) {
                    const tables = JSON.parse(loadEvent.target.result)
                    console.log("Import content", tables, tables.mate, !(tables.mate === 'chatSheets'))
                    if (!(tables.mate?.type === 'chatSheets')) return EDITOR.error("Import failed: Invalid file format", "Please verify you are importing table data")
                    if (result === 3)
                        BASE.applyJsonToChatSheets(tables, "data")
                    else
                        BASE.applyJsonToChatSheets(tables)
                    await renderSheetsDOM()
                    EDITOR.success('Import successful')
                }
            };
            reader.readAsText(file, 'UTF-8'); // Specify UTF-8 encoding to ensure proper character handling
        }
    });
    fileInput.click();
}

/**
 * Export table
 * @param {Array} tables All table data
 */
async function exportTable() {
    const jsonTables = getTableJson({ type: 'chatSheets', version: 1 })
    if (!jsonTables) return
    const bom = '\uFEFF';
    const blob = new Blob([bom + JSON.stringify(jsonTables)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'table_data.json'; // Default filename
    document.body.appendChild(downloadLink); // Must be added to DOM to trigger download
    downloadLink.click();
    document.body.removeChild(downloadLink); // Remove after download completes

    URL.revokeObjectURL(url); // Release URL object

    EDITOR.success('Exported');
}

/**
 * Get table JSON data
 */
function getTableJson(mate) {
    if (!DERIVED.any.renderingSheets || DERIVED.any.renderingSheets.length === 0) {
        EDITOR.warning('No table data available to export');
        return;
    }
    const sheets = DERIVED.any.renderingSheets.filter(sheet => sheet.enable)
    // const csvTables = sheets.map(sheet => "SHEET-START" + sheet.uid + "\n" + sheet.getSheetCSV(false) + "SHEET-END").join('\n')
    const jsonTables = {}
    sheets.forEach(sheet => {
        jsonTables[sheet.uid] = sheet.getJson()
    })
    jsonTables.mate = mate
    return jsonTables
}

/**
 * Clear table
 * @param {number} mesId Message ID to clear table from
 * @param {Element} viewSheetsContainer Table container DOM
 */
async function clearTable(mesId, viewSheetsContainer) {
    if (mesId === -1) return
    const confirmation = await EDITOR.callGenericPopup('This will clear all table data in the current conversation and reset history. This action cannot be undone. Continue?', EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Continue", cancelButton: "Cancel" });
    if (confirmation) {
        await USER.getContext().chat.forEach((piece => {
            if (piece.hash_sheets) {
                delete piece.hash_sheets
            }
            if (piece.dataTable) delete piece.dataTable
        }))
        setTimeout(() => {
            USER.saveSettings()
            USER.saveChat();
            refreshContextView()
            EDITOR.success("Table data cleared successfully")
            console.log("Table data cleared")
        }, 100)
    }
}

/**
 * Set table editing tips
 * @param {Element} tableEditTips Table editing tips DOM
 */
function setTableEditTips(tableEditTips) {
    /* if (!tableEditTips || tableEditTips.length === 0) {
        console.error('tableEditTips is null or empty jQuery object');
        return;
    }
    const tips = $(tableEditTips); // Ensure tableEditTips is a jQuery object
    tips.empty();
    if (USER.tableBaseSetting.isExtensionAble === false) {
        tips.append('Plugin is currently disabled. AI will not be requested to update tables.');
        tips.css("color", "rgb(211 39 39)");
    } else if (userTableEditInfo.editAble) {
        tips.append('Click cells to select editing actions. Green cells were inserted this round; blue cells were modified this round.');
        tips.css("color", "lightgreen");
    } else {
        tips.append('This is an intermediate table. To avoid confusion, it cannot be edited or pasted into. Please open the latest message\'s table for editing.');
        tips.css("color", "lightyellow");
    } */
}

async function cellDataEdit(cell) {
    const result = await EDITOR.callGenericPopup("Edit cell", EDITOR.POPUP_TYPE.INPUT, cell.data.value, { rows: 3 })
    if (result) {
        cell.editCellData({ value: result })
        refreshContextView();
        if (cell.type === Cell.CellType.column_header) BASE.refreshTempView(true)
    }
}


async function columnDataEdit(cell) {
    const columnEditor = `
<div class="column-editor">
    <div class="column-editor-header">
        <h3>Edit column data</h3>
    </div>
    <div class="column-editor-body">
        <div class="column-editor-content">
            <label for="column-editor-input">Column data:</label>
            <textarea id="column-editor-input" rows="5"></textarea>
        </div>
    </div>
</div>
`
    const columnCellDataPopup = new EDITOR.Popup(columnEditor, EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Apply changes", cancelButton: "Cancel" });
    const historyContainer = $(columnCellDataPopup.dlg)[0];

    await columnCellDataPopup.show();

    if (columnCellDataPopup.result) {
        // cell.editCellData({ value: result })
        refreshContextView();
    }
}

function batchEditMode(cell) {
    DERIVED.any.batchEditMode = true;
    DERIVED.any.batchEditModeSheet = cell.parent;
    EDITOR.confirm(`Editing rows in #${cell.parent.name}`, 'Cancel', 'Done').then((r) => {
        DERIVED.any.batchEditMode = false;
        DERIVED.any.batchEditModeSheet = null;
        renderSheetsDOM();
    })
    renderSheetsDOM();
}

// New event handler function
export function cellClickEditModeEvent(cell) {
    cell.element.style.cursor = 'pointer'
    if (cell.type === Cell.CellType.row_header) {
        cell.element.textContent = ''

        // Add three divs inside cell.element: one for sorting, one for lock button, one for delete button
        const containerDiv = $(`<div class="flex-container" style="display: flex; flex-direction: row; justify-content: space-between; width: 100%;"></div>`)
        const rightDiv = $(`<div class="flex-container" style="margin-right: 3px"></div>`)
        const indexDiv = $(`<span class="menu_button_icon interactable" style="margin: 0; padding: 0 6px; cursor: move; color: var(--SmartThemeBodyColor)">${cell.position[0]}</span>`)
        const lockDiv = $(`<div><i class="menu_button menu_button_icon interactable fa fa-lock" style="margin: 0; border: none; color: var(--SmartThemeEmColor)"></i></div>`)
        const deleteDiv = $(`<div><i class="menu_button menu_button_icon interactable fa fa-xmark redWarningBG" style="margin: 0; border: none; color: var(--SmartThemeEmColor)"></i></div>`)

        $(lockDiv).on('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (cell._pre_deletion) return

            cell.parent.hashSheet.forEach(row => {
                if (row[0] === cell.uid) {
                    row.forEach((hash) => {
                        const target = cell.parent.cells.get(hash)
                        target.locked = !target.locked
                        target.element.style.backgroundColor = target.locked ? '#00ff0022' : ''
                    })
                }
            })
        })
        $(deleteDiv).on('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            handleAction(cell, Cell.CellAction.deleteSelfRow)
            //if (cell.locked) return

            /* cell.parent.hashSheet.forEach(row => {
                if (row[0] === cell.uid) {
                    row.forEach((hash) => {
                        const target = cell.parent.cells.get(hash)
                        target._pre_deletion = !target._pre_deletion
                        target.element.style.backgroundColor = target._pre_deletion ? '#ff000044' : ''
                    })
                }
            }) */
        })

        $(rightDiv).append(deleteDiv)
        $(containerDiv).append(indexDiv).append(rightDiv)
        $(cell.element).append(containerDiv)

    } else if (cell.type === Cell.CellType.cell) {
        cell.element.style.cursor = 'text'
        cell.element.contentEditable = true
        cell.element.focus()
        cell.element.addEventListener('blur', (e) => {
            e.stopPropagation();
            e.preventDefault();
            cell.data.value = cell.element.textContent.trim()
        })
    }

    cell.on('click', async (event) => {
        event.stopPropagation();
        event.preventDefault();
    })
}

async function confirmAction(event, text = 'Proceed with this action?') {
    const confirmation = new EDITOR.Popup(text, EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Continue", cancelButton: "Cancel" });

    await confirmation.show();
    if (!confirmation.result) return { filterData: null, confirmation: false };
    event()
}

async function cellHistoryView(cell) {
    await openCellHistoryPopup(cell)
}

/**
 * Custom table style event
 * @param {*} cell
 */
async function customSheetStyle(cell) {
    await openSheetStyleRendererPopup(cell.parent)
    await refreshContextView();
}

function cellClickEvent(cell) {
    cell.element.style.cursor = 'pointer'

    cell.on('click', async (event) => {
        event.stopPropagation();
        event.preventDefault();

        // Re-fetch latest hash
        BASE.getLastestSheets()

        if (cell.parent.currentPopupMenu) {
            cell.parent.currentPopupMenu.destroy();
            cell.parent.currentPopupMenu = null;
        }
        cell.parent.currentPopupMenu = new PopupMenu();

        const menu = cell.parent.currentPopupMenu;
        const [rowIndex, colIndex] = cell.position;
        const sheetType = cell.parent.type;

        if (rowIndex === 0 && colIndex === 0) {
            menu.add('<i class="fa-solid fa-bars-staggered"></i> Batch row edit', () => batchEditMode(cell));
            menu.add('<i class="fa fa-arrow-right"></i> Insert column right', () => handleAction(cell, Cell.CellAction.insertRightColumn));
            menu.add('<i class="fa fa-arrow-down"></i> Insert row below', () => handleAction(cell, Cell.CellAction.insertDownRow));
            menu.add('<i class="fa-solid fa-wand-magic-sparkles"></i> Custom table style', async () => customSheetStyle(cell));
        } else if (colIndex === 0) {
            menu.add('<i class="fa-solid fa-bars-staggered"></i> Batch row edit', () => batchEditMode(cell));
            menu.add('<i class="fa fa-arrow-up"></i> Insert row above', () => handleAction(cell, Cell.CellAction.insertUpRow));
            menu.add('<i class="fa fa-arrow-down"></i> Insert row below', () => handleAction(cell, Cell.CellAction.insertDownRow));
            menu.add('<i class="fa fa-trash-alt"></i> Delete row', () => handleAction(cell, Cell.CellAction.deleteSelfRow), menu.ItemType.warning)
        } else if (rowIndex === 0) {
            menu.add('<i class="fa fa-i-cursor"></i> Edit column', async () => await cellDataEdit(cell));
            menu.add('<i class="fa fa-arrow-left"></i> Insert column left', () => handleAction(cell, Cell.CellAction.insertLeftColumn));
            menu.add('<i class="fa fa-arrow-right"></i> Insert column right', () => handleAction(cell, Cell.CellAction.insertRightColumn));
            menu.add('<i class="fa fa-trash-alt"></i> Delete column', () => confirmAction(() => { handleAction(cell, Cell.CellAction.deleteSelfColumn) }, 'Confirm column deletion?'), menu.ItemType.warning);
        } else {
            menu.add('<i class="fa fa-i-cursor"></i> Edit cell', async () => await cellDataEdit(cell));
            menu.add('<i class="fa-solid fa-clock-rotate-left"></i> Cell history', async () => await cellHistoryView(cell));
        }

        // Set non-functional derived operations after popup menu creation; setTimeout is required here or menu won't display properly
        setTimeout(() => {

        }, 0)

        const element = event.target

        // Backup current cell style to restore when menu closes
        const style = element.style.cssText;

        // Get cell position
        const rect = element.getBoundingClientRect();
        const tableRect = viewSheetsContainer.getBoundingClientRect();

        // Calculate menu position (relative to table container)
        const menuLeft = rect.left - tableRect.left;
        const menuTop = rect.bottom - tableRect.top;
        const menuElement = menu.renderMenu();
        $(viewSheetsContainer).append(menuElement);

        // Highlight cell
        element.style.backgroundColor = 'var(--SmartThemeUserMesBlurTintColor)';
        element.style.color = 'var(--SmartThemeQuoteColor)';
        element.style.outline = '1px solid var(--SmartThemeQuoteColor)';
        element.style.zIndex = '999';

        menu.show(menuLeft, menuTop).then(() => {
            element.style.cssText = style;
        })
        menu.frameUpdate((menu) => {
            // Reposition menu
            const rect = element.getBoundingClientRect();
            const tableRect = viewSheetsContainer.getBoundingClientRect();

            // Calculate menu position (relative to table container)
            const menuLeft = rect.left - tableRect.left;
            const menuTop = rect.bottom - tableRect.top;
            menu.popupContainer.style.left = `${menuLeft}px`;
            menu.popupContainer.style.top = `${menuTop + 3}px`;
        })
    })
    cell.on('', () => {
        console.log('Cell changed:', cell)
    })
}

function handleAction(cell, action) {
    cell.newAction(action)
    refreshContextView();
    if (cell.type === Cell.CellType.column_header) BASE.refreshTempView(true)
}

export async function renderEditableSheetsDOM(_sheets, _viewSheetsContainer, _cellClickEvent = cellClickEvent) {
    for (let [index, sheet] of _sheets.entries()) {
        if (!sheet.enable) continue
        const instance = sheet
        console.log("Rendering:", instance)
        const sheetContainer = document.createElement('div')
        const sheetTitleText = document.createElement('h3')
        sheetContainer.style.overflowX = 'none'
        sheetContainer.style.overflowY = 'auto'
        sheetTitleText.innerText = `#${index} ${sheet.name}`

        let sheetElement = null

        if (DERIVED.any.batchEditMode === true) {
            if (DERIVED.any.batchEditModeSheet?.name === instance.name) {
                sheetElement = await instance.renderSheet(cellClickEditModeEvent)
            } else {
                sheetElement = await instance.renderSheet((cell) => {
                    cell.element.style.cursor = 'default'
                })
                sheetElement.style.cursor = 'default'
                sheetElement.style.opacity = '0.5'
                sheetTitleText.style.opacity = '0.5'
            }
        } else {
            sheetElement = await instance.renderSheet(_cellClickEvent)
        }
        // Already integrated into Sheet.renderSheet internally; no need to call again here
        console.log("Rendered table:", sheetElement)
        $(sheetContainer).append(sheetElement)

        $(_viewSheetsContainer).append(sheetTitleText)
        $(_viewSheetsContainer).append(sheetContainer)
        $(_viewSheetsContainer).append(`<hr>`)
    }
}

/**
 * Undo table changes
 * @param {number} mesId Message ID to undo table from
 * @param {Element} tableContainer Table container DOM
 */
async function undoTable(mesId, tableContainer) {
    if (mesId === -1) return
    //const button = { text: 'Undo 10 rounds', result: 3 }
    const popup = new EDITOR.Popup("Undo all manual edits and reorganize data within specified rounds to restore table", EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Undo current round", cancelButton: "Cancel" });
    const result = await popup.show()
    if (result) {
        await undoSheets(0)
        EDITOR.success('Restoration successful')
    }
}


async function renderSheetsDOM(mesId = -1) {
    const task = new SYSTEM.taskTiming('renderSheetsDOM_task')
    DERIVED.any.renderingMesId = mesId
    updateSystemMessageTableStatus();
    task.log()
    const { deep: lastestDeep, piece: lastestPiece } = BASE.getLastSheetsPiece()
    const { piece, deep } = mesId === -1 ? { piece: lastestPiece, deep: lastestDeep } : { piece: USER.getContext().chat[mesId], deep: mesId }
    if (!piece || !piece.hash_sheets) return;

    if (deep === lastestDeep) DERIVED.any.isRenderLastest = true;
    else DERIVED.any.isRenderLastest = false;
    DERIVED.any.renderDeep = deep;

    const sheets = BASE.hashSheetsToSheets(piece.hash_sheets);
    sheets.forEach((sheet) => {
        sheet.hashSheet = sheet.hashSheet.filter((row) => {
            return (sheet.cells.get(row[0]).isDeleted !== true);
        })
        sheet.cells.forEach((cell) => {
            cell.isDeleted = false;
        })
    })
    console.log('renderSheetsDOM:', piece, sheets)
    DERIVED.any.renderingSheets = sheets

    task.log()
    $(viewSheetsContainer).empty()
    viewSheetsContainer.style.paddingBottom = '150px'
    renderEditableSheetsDOM(sheets, viewSheetsContainer, DERIVED.any.isRenderLastest ? undefined : () => { })
    $("#table_indicator").text(DERIVED.any.isRenderLastest ? "This is the active editable table" : `This is an old table from conversation round ${deep}, and cannot be modified`)
    task.log()
}

let initializedTableView = null
async function initTableView(mesId) {
    initializedTableView = $(await SYSTEM.getTemplate('manager')).get(0);
    viewSheetsContainer = initializedTableView.querySelector('#tableContainer');
    // setTableEditTips($(initializedTableView).find('#tableEditTips'));    // Ensure tableEditTips is found only if table_manager_container exists

    // Set editing tips
    // Click to open table statistics
    $(document).on('click', '#table_data_statistics_button', function () {
        EDITOR.tryBlock(openTableStatisticsPopup, "Failed to open table statistics")
    })
    // Click to open table history
    $(document).on('click', '#dataTable_history_button', function () {
        EDITOR.tryBlock(openTableHistoryPopup, "Failed to open table history")
    })
    // Click to clear table
    $(document).on('click', '#clear_table_button', function () {
        EDITOR.tryBlock(clearTable, "Failed to clear table", userTableEditInfo.chatIndex, viewSheetsContainer);
    })
    $(document).on('click', '#table_rebuild_button', function () {
        EDITOR.tryBlock(rebuildSheets, "Failed to rebuild table");
    })
    // Click to edit table
    $(document).on('click', '#table_edit_mode_button', function () {
        // openTableEditorPopup();
    })
    // Click to undo table
    $(document).on('click', '#table_undo', function () {
        EDITOR.tryBlock(undoTable, "Failed to restore table");
    })
    // Click to copy table
    $(document).on('click', '#copy_table_button', function () {
        EDITOR.tryBlock(copyTable, "Failed to copy table");
    })
    // Click to import table
    $(document).on('click', '#import_table_button', function () {
        EDITOR.tryBlock(importTable, "Failed to import table", userTableEditInfo.chatIndex, viewSheetsContainer);
    })
    // Click to export table
    $(document).on('click', '#export_table_button', function () {
        EDITOR.tryBlock(exportTable, "Failed to export table");
    })
    // Click previous table button
    $(document).on('click', '#table_prev_button', function () {
        const deep = DERIVED.any.renderDeep;
        const { deep: prevDeep } = BASE.getLastSheetsPiece(deep - 1, 20, false);
        if (prevDeep === -1) {
            EDITOR.error("No more table data available")
            return
        }
        renderSheetsDOM(prevDeep);
    })

    // Click next table button
    $(document).on('click', '#table_next_button', function () {
        const deep = DERIVED.any.renderDeep;
        console.log("Current depth:", deep)
        const { deep: nextDeep } = BASE.getLastSheetsPiece(deep + 1, 20, false, "down");
        if (nextDeep === -1) {
            EDITOR.error("No more table data available")
            return
        }
        renderSheetsDOM(nextDeep);
    })

    return initializedTableView;
}

export async function refreshContextView(mesId = -1) {
    if (BASE.contextViewRefreshing) return
    BASE.contextViewRefreshing = true
    await renderSheetsDOM(mesId);
    console.log("Refreshed table view")
    BASE.contextViewRefreshing = false
}

export async function getChatSheetsView(mesId = -1) {
    // If already initialized, return cached container to avoid recreation
    if (initializedTableView) {
        // Update table content without recreating entire container
        await renderSheetsDOM();
        return initializedTableView;
    }
    return await initTableView(mesId);
}
