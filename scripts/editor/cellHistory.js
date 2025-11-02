import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../../core/manager.js';
import { Cell } from '../../core/table/cell.js';

const histories = `
<style>
.cell-history {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 10px;
}
.cell-history-content {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow-y: auto;
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
.history-cell-action {
    display: flex;
    flex-direction: column;
    flex: 1;
    align-items: center;
    justify-content: center;
    font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace;
    font-size: 12px;
    color: #999;
    min-width: 45px;
    max-width: 45px;
}
.history-cell-timestamp {
}
</style>

<div class="cell-history">
    <h3>Cell History</h3>
<!--    <div class="history-tabs">-->
<!--        <!&ndash; Dynamically generated tabs &ndash;>-->
<!--    </div>-->
    <div class="cell-history-content">
        <div class="history-sheets-content">
            <!-- Dynamically generated cell history content -->
        </div>
    </div>
</div>
`

function scrollToBottom(container) {
    // Scroll to bottom after popup is displayed
    const contentContainer = $(container).find('.cell-history-content');
    contentContainer.scrollTop(contentContainer[0].scrollHeight);
}

async function reloadCellHistory(cell, historyCell, container) {
    const currentValue = cell.data.value;
    const targetValue = historyCell.data.value;
    let resultValue = targetValue;

    const tracebackCellHistoryPopup = new EDITOR.Popup(`
    <style>
        .cell-history-confirm {
            display: flex;
            flex-direction: column;
            justify-content: left;
        }
        .cell-history-confirm .cell-history-confirm-last {
            user-select: none;
            cursor: not-allowed;
            margin: 10px 0;
            text-align: left;
            color: var(--SmartThemeEmColor);
        }
        .cell-history-confirm .cell-history-confirm-value {
            margin-top: 10px;
            text-align: left;
            color: var(--SmartThemeBodyColor);
        }
    </style>
    <div class="cell-history">
        <h3>Confirm Cell History Reversion</h3>
        <div class="cell-history-confirm">
            <textarea class="cell-history-confirm-last" readonly>${currentValue}</textarea>
            <span>Change to:</span>
            <textarea class="cell-history-confirm-value" rows="8">${targetValue}</textarea>
        </div>
    </div>
    `, EDITOR.POPUP_TYPE.CONFIRM, '', { wide: true, allowVerticalScrolling: false, okButton: "Proceed", cancelButton: "Cancel" });

    // Listen for input events on cell-history-confirm-value
    const confirmValue = $(tracebackCellHistoryPopup.dlg).find('.cell-history-confirm-value');
    confirmValue.on('input', function () {
        resultValue = $(this).val();
    });

    await tracebackCellHistoryPopup.show();
    if (tracebackCellHistoryPopup.result) {
        cell.newAction(Cell.CellAction.editCell, { value: resultValue }, true)
        const targetCell = cell.parent.cellHistory[cell.parent.cellHistory.length - 1]
        updateCellHistoryData(container, targetCell);  // Update history
        scrollToBottom(container);
        BASE.refreshContextView();
    }
}

function updateCellHistoryData(container, cell) {
    const { piece, deep } = BASE.getLastSheetsPiece();
    const sheetsData = BASE.sheetsData.context;
    if (!piece || !piece.hash_sheets) return;

    // Get content container
    const contentContainer = $(container).find('.cell-history-content');

    const cellHistory = cell.parent.cellHistory
    const selfHistory = cellHistory.filter(c => {
        if (c.coordUid === cell.coordUid) {
            return c
        } else {
            return false
        }
    });

    // Clear existing content
    const sheetsContainer = $(contentContainer).find('.history-sheets-content');
    sheetsContainer.empty();

    // Show message if no history exists
    if (!selfHistory || selfHistory.length === 0) {
        sheetsContainer.append('<div class="history-empty">This cell has no history</div>');
        return;
    }

    // Create cell history content area
    const historyContainer = $('<div class="history-sheet-container active"></div>');
    const cellListContainer = $('<div class="history-cell-list"></div>');

    // Iterate through history records
    selfHistory.forEach((historyCell, index) => {
        // Only show history entries with values
        if (!historyCell.data || !historyCell.data.value) return;

        // Create history item
        const historyItem = $('<div class="history-cell-item"></div>');
        const valueElement = $(`<div class="history-cell-value">${historyCell.data.value}</div>`);
        const actionElement = $(`<div class="history-cell-action"></div>`);
        const timestampElement = $(`<div class="history-cell-timestamp">${historyCell.uid.slice(-4)}</div>`);
        const indexElement = $(`<div class="history-cell-index">${selfHistory.length - index}/${selfHistory.length}</div>`);
        const reloadElement = $(`<div class="history-cell-reload"><i class="menu_button menu_button_icon fa-solid fa-rotate-right"></i></div>`);

        historyItem.append(valueElement);
        historyItem.append(actionElement);
        actionElement.append(timestampElement);
        actionElement.append(indexElement);
        actionElement.append(reloadElement);

        cellListContainer.append(historyItem);

        // Bind click event
        reloadElement.on('click', async () => {
            try {
                await reloadCellHistory(cell, historyCell, container);
            } catch (error) {
                console.error('Error reloading cell history:', error);
            }
        });
    });

    historyContainer.append(cellListContainer);
    sheetsContainer.append(historyContainer);
}

/**
 * Open cell history popup
 * */
export async function openCellHistoryPopup(cell){
    const cellHistoryPopup = new EDITOR.Popup(histories, EDITOR.POPUP_TYPE.TEXT, '', { large: true, wide: true, allowVerticalScrolling: false });
    const historyContainer = $(cellHistoryPopup.dlg)[0];

    updateCellHistoryData(historyContainer, cell);

    cellHistoryPopup.show();
    scrollToBottom(historyContainer);   // Scroll to bottom
}
