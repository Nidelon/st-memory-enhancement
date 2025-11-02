import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../../core/manager.js';
import {getColumnLetter} from "../../core/table/utils.js";
// import { deleteRow, insertRow, updateRow } from "../oldTableActions.js";
// import JSON5 from '../../utils/json5.min.mjs'

const histories = `
<style>
.table-history {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 10px;
}
.table-history-content {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow-y: auto;
}
.history-tabs {
    display: flex;
    overflow-x: auto;
    z-index: 999;
}

/* Make the scrollbar of .history-tabs appear on top */
.history-tabs::-webkit-scrollbar {

}

.history-tab {
    margin-right: 15px;
    cursor: pointer;
    border-radius: 5px 5px 0 0;
    padding: 0 5px;
    color: var(--SmartThemeBodyColor);
    white-space: nowrap;
    transition: background-color 0.3s;
}
.history-tab.active {
    color: var(--SmartThemeQuoteColor);
    background-color: rgba(100, 100, 255, 0.3);
    font-weight: bold;
}
.history-sheets-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
}
.history-sheet-container {
    display: none;
    border-radius: 5px;
    height: 100%;
}
.history-sheet-container.active {
    display: flex;
    flex: 1;
    border: 1px solid rgba(255, 255, 255, 0.2);
}
.history-cell-list {
    overflow-y: auto;
    width: 100%;
    /* Prevent content jumping */
    will-change: transform;
    transform: translateZ(0);
}
.history-cell-item {
    display: flex;
    flex: 1;
    width: 100%;
    justify-content: space-between;
    margin-bottom: 5px;
    padding: 5px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}
.history-cell-position {
    font-weight: bold;
    color: var(--SmartThemeQuoteColor);
    width: 60px;
}
.history-cell-value {
    display: flex;
    flex: 1;
    width: 100%;
    padding: 0 10px;
    font-weight: normal;
    word-break: break-all;
}
.history-cell-timestamp {
    color: var(--SmartThemeEmColor);
    font-size: 0.9em;
    width: 60px;
    text-align: right;
}
.history-empty {
    font-style: italic;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding: 10px;
}
</style>
<div class="table-history">
    <h3>Table Cell History</h3>
    <div class="history-tabs">
        <!-- Dynamically generated tabs -->
    </div>
    <div class="table-history-content">
        <div class="history-sheets-content">
            <!-- Dynamically generated table history content -->
        </div>
    </div>
</div>
`

function scrollToBottom(container) {
    // Scroll to bottom after the popup is displayed
    const contentContainer = $(container).find('.table-history-content');
    contentContainer.scrollTop(contentContainer[0].scrollHeight);
}

async function updateTableHistoryData(container) {
    const { piece, deep } = BASE.getLastSheetsPiece();
    const sheetsData = BASE.getChatSheets();
    if (!piece || !piece.hash_sheets) return;

    // Get content containers
    const contentContainer = $(container).find('.table-history-content');
    const tabsContainer = $(container).find('.history-tabs');
    const sheetsContainer = $(contentContainer).find('.history-sheets-content');

    // Clear existing content
    tabsContainer.empty();
    sheetsContainer.empty();

    // Show message if no sheet data exists
    if (!sheetsData || sheetsData.length === 0) {
        sheetsContainer.append('<div class="history-empty">No history data available to display</div>');
        return;
    }

    // Count valid sheets (used to activate the first tab)
    let validSheetCount = 0;

    // Iterate over all sheets
    sheetsData.forEach((sheetData, index) => {
        if (!sheetData.cellHistory || sheetData.cellHistory.length === 0) return;

        const sheetName = sheetData.name || `Sheet${index + 1}`;
        const sheetId = `history-sheet-${index}`;
        validSheetCount++;

        // Create tab
        const tab = $(`<div class="history-tab" data-target="${sheetId}">#${index} ${sheetName}</div>`);
        if (validSheetCount === 1) {
            tab.addClass('active');
        }
        tabsContainer.append(tab);

        // Create sheet content container
        const sheetContainer = $(`<div id="${sheetId}" class="history-sheet-container ${validSheetCount === 1 ? 'active' : ''}"></div>`);
        const cellListContainer = $('<div class="history-cell-list"></div>');

        // Count valid history entries
        let validHistoryCount = 0;

        sheetData.cellHistory.forEach(cell => {
            const cellInstance = sheetData.cells.get(cell.uid);
            const [rowIndex, colIndex] = cellInstance.position;
            // console.log(rowIndex, colIndex, cellInstance);

            // Only show cells with values
            if (!cell.data || !cell.data.value) return;

            // // Skip first row and first column (original table cell)
            // if (rowIndex === 0 && colIndex === 0) return;

            // Generate position display
            const positionDisplay = () => {
                if (rowIndex === 0 && colIndex === 0) {
                    return `<span style="color: var(--SmartThemeEmColor);">Table Source</span>`;
                } else if (rowIndex === 0) {
                    return `Column <span style="color: var(--SmartThemeQuoteColor);">${colIndex}</span>`;
                } else if (colIndex === 0) {
                    return `Row <span style="color: var(--SmartThemeQuoteColor);">${rowIndex}</span>`;
                } else if (rowIndex > 0 && colIndex > 0) {
                    return `<span style="color: #4C8BF5;">${getColumnLetter(colIndex-1)}</span><span style="color: #34A853;">${rowIndex}</span>`;
                }
                return '<span style="color: #EA4335;">Legacy Data</span>';
            }

            // Create history item
            const historyItem = $('<div class="history-cell-item"></div>');
            const positionElement = $(`<div class="history-cell-position">${positionDisplay()}</div>`);
            const valueElement = $(`<div class="history-cell-value">${cell.data.value}</div>`);
            const timestampElement = $(`<div class="history-cell-timestamp">${cell.uid.slice(-4)}</div>`);

            historyItem.append(positionElement);
            historyItem.append(valueElement);
            // historyItem.append(timestampElement);

            cellListContainer.append(historyItem);
            validHistoryCount++;
        });

        // Show message if no history entries exist for this sheet
        if (validHistoryCount === 0) {
            cellListContainer.append('<div class="history-empty">This sheet has no history data</div>');
        }

        sheetContainer.append(cellListContainer);
        sheetsContainer.append(sheetContainer);
    });

    // Show message if no sheets have history data
    if (validSheetCount === 0) {
        sheetsContainer.append('<div class="history-empty">No history data available to display</div>');
    }

    // Add tab switching event
    tabsContainer.find('.history-tab').on('click', function() {
        // Remove active state from all tabs and containers
        tabsContainer.find('.history-tab').removeClass('active');
        sheetsContainer.find('.history-sheet-container').removeClass('active');

        // Activate current tab and container
        $(this).addClass('active');
        const targetId = $(this).data('target');
        $(`#${targetId}`).addClass('active');

        // Scroll content area to bottom
        scrollToBottom(container);
    });
}

/**
 * Open table edit history popup
 * */
export async function openTableHistoryPopup(){
    const tableHistoryPopup = new EDITOR.Popup(histories, EDITOR.POPUP_TYPE.TEXT, '', { large: true, wide: true, allowVerticalScrolling: false });
    const historyContainer = $(tableHistoryPopup.dlg)[0];

    updateTableHistoryData(historyContainer);
    tableHistoryPopup.show();
}
