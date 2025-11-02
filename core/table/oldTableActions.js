import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../manager.js';

/**
 * Replace commas in a cell with forward slashes (/)
 * @param {string | number} cell
 * @returns Processed cell value
 */
function handleCellValue(cell) {
    if (typeof cell === 'string') {
        return cell.replace(/,/g, "/")
    } else if (typeof cell === 'number') {
        return cell
    }
    return ''
}

/**
 * Insert a row at the end of the table
 * @deprecated
 * @param {number} tableIndex Table index
 * @param {object} data Data to insert
 * @returns Index of the newly inserted row
 */
export function insertRow(tableIndex, data) {
    if (tableIndex == null) return EDITOR.error('insert function: tableIndex is null');
    if (data == null) return EDITOR.error('insert function: data is null');

    // Get table object, supporting both old and new systems
    const table = DERIVED.any.waitingTable[tableIndex];

    // Check if it's a Sheet object from the new system
    if (table.uid && table.hashSheet) {
        // New system: use Sheet class API
        try {
            // Get current number of rows (excluding header)
            const rowCount = table.hashSheet.length - 1;

            // Insert a new row after the last row
            const cell = table.findCellByPosition(0, 0); // Get the source cell of the table
            cell.newAction('insertDownRow'); // Insert a new row after the last row

            // Fill in data
            Object.entries(data).forEach(([key, value]) => {
                const colIndex = parseInt(key) + 1; // +1 because the first column is the row index
                if (colIndex < table.hashSheet[0].length) {
                    const cell = table.findCellByPosition(rowCount + 1, colIndex);
                    if (cell) {
                        cell.data.value = handleCellValue(value);
                    }
                }
            });

            console.log(`Insert successful: table ${tableIndex}, row ${rowCount + 1}`);
            return rowCount + 1;
        } catch (error) {
            console.error('Failed to insert row:', error);
            return -1;
        }
    } else {
        // Old system: keep original logic
        const newRowArray = new Array(table.columns.length).fill("");
        Object.entries(data).forEach(([key, value]) => {
            newRowArray[parseInt(key)] = handleCellValue(value);
        });

        const dataStr = JSON.stringify(newRowArray);
        // Check if an identical row already exists
        if (table.content.some(row => JSON.stringify(row) === dataStr)) {
            console.log(`Skipped duplicate insertion: table ${tableIndex}, data ${dataStr}`);
            return -1; // Return -1 to indicate no insertion occurred
        }
        table.content.push(newRowArray);
        const newRowIndex = table.content.length - 1;
        console.log(`Insert successful (old system): table ${tableIndex}, row ${newRowIndex}`);
        return newRowIndex;
    }
}

/**
 * Delete a row
 * @deprecated
 * @param {number} tableIndex Table index
 * @param {number} rowIndex Row index
 */
export function deleteRow(tableIndex, rowIndex) {
    if (tableIndex == null) return EDITOR.error('delete function: tableIndex is null');
    if (rowIndex == null) return EDITOR.error('delete function: rowIndex is null');

    // Get table object, supporting both old and new systems
    const table = DERIVED.any.waitingTable[tableIndex];

    // Check if it's a Sheet object from the new system
    if (table.uid && table.hashSheet) {
        // New system: use Sheet class API
        try {
            // Ensure row index is valid (accounting for header row)
            const actualRowIndex = rowIndex + 1; // +1 because the first row is the header

            // Validate row index
            if (actualRowIndex >= table.hashSheet.length || actualRowIndex <= 0) {
                console.error(`Invalid row index: ${rowIndex}`);
                return;
            }

            // Get the cell of the row to delete and trigger deletion
            const cell = table.findCellByPosition(actualRowIndex, 0);
            if (cell) {
                cell.newAction('deleteSelfRow');
                console.log(`Delete successful: table ${tableIndex}, row ${rowIndex}`);
            } else {
                console.error(`Row not found: ${rowIndex}`);
            }
        } catch (error) {
            console.error('Failed to delete row:', error);
        }
    } else {
        // Old system: keep original logic
        if (table.content && rowIndex >= 0 && rowIndex < table.content.length) {
            table.content.splice(rowIndex, 1);
            console.log(`Delete successful (old system): table ${tableIndex}, row ${rowIndex}`);
        } else {
            console.error(`Delete failed (old system): table ${tableIndex}, invalid row index ${rowIndex} or content does not exist`);
        }
    }
}

/**
 * Update data of a single row
 * @deprecated
 * @param {number} tableIndex Table index
 * @param {number} rowIndex Row index
 * @param {object} data Updated data
 */
export function updateRow(tableIndex, rowIndex, data) {
    if (tableIndex == null) return EDITOR.error('update function: tableIndex is null');
    if (rowIndex == null) return EDITOR.error('update function: rowIndex is null');
    if (data == null) return EDITOR.error('update function: data is null');

    // Get table object, supporting both old and new systems
    const table = DERIVED.any.waitingTable[tableIndex];

    // Check if it's a Sheet object from the new system
    if (table.uid && table.hashSheet) {
        // New system: use Sheet class API
        try {
            // Ensure row index is valid (accounting for header row)
            const actualRowIndex = rowIndex + 1; // +1 because the first row is the header

            // Validate row index
            if (actualRowIndex >= table.hashSheet.length || actualRowIndex <= 0) {
                console.error(`Invalid row index: ${rowIndex}`);
                return;
            }

            // Update row data
            Object.entries(data).forEach(([key, value]) => {
                const colIndex = parseInt(key) + 1; // +1 because the first column is the row index
                if (colIndex < table.hashSheet[0].length) {
                    const cell = table.findCellByPosition(actualRowIndex, colIndex);
                    if (cell) {
                        cell.data.value = handleCellValue(value);
                    }
                }
            });

            // Save changes
            table.save();
            console.log(`Update successful: table ${tableIndex}, row ${rowIndex}`);
        } catch (error) {
            console.error('Failed to update row:', error);
        }
    } else {
        // Old system: keep original logic
        if (table.content && table.content[rowIndex]) {
            Object.entries(data).forEach(([key, value]) => {
                table.content[rowIndex][parseInt(key)] = handleCellValue(value);
            });
            console.log(`Update successful (old system): table ${tableIndex}, row ${rowIndex}`);
        } else {
            console.error(`Update failed (old system): table ${tableIndex}, row ${rowIndex} does not exist or content does not exist`);
        }
    }
}
