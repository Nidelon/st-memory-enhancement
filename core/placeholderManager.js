// core/placeholderManager.js
import { BASE } from './manager.js';

class PlaceholderManager {
    constructor() {
        this.placeholderRegex = /\$([A-Z]+\d+)|S\[(.+?)]\[(.+?)]/g;
    }

    /**
     * Render a template string by replacing all placeholders
     * @param {string} template - The template string containing placeholders
     * @param {object} currentSheet - The current sheet object
     * @returns {string} - The rendered string
     */
    render(template, currentSheet) {
        if (!template) return '';

        return template.replace(this.placeholderRegex, (match, singleAddress, sheetIdentifier, cellAddress) => {
            if (singleAddress) {
                // Handle cell references in the current sheet, e.g., $A1
                const { row, col } = this.parseCellAddress(singleAddress);
                const cell = currentSheet.findCellByPosition(row, col);
                return cell ? cell.data.value : '';
            } else if (sheetIdentifier && cellAddress) {
                // Handle references to other sheets, e.g., S[Sheet Name][A1] or S[0][A1]
                const targetSheet = this.findSheet(sheetIdentifier);
                if (!targetSheet) {
                    return `[Sheet "${sheetIdentifier}" not found]`;
                }

                const { row, col } = this.parseCellAddress(cellAddress);
                const cell = targetSheet.findCellByPosition(row, col);
                return cell ? cell.data.value : `[Cell "${cellAddress}" not found in sheet "${sheetIdentifier}"]`;
            }
            return match; // Fallback for no match
        });
    }

    /**
     * Find a sheet by its identifier (name or index)
     * @param {string} identifier - The sheet name or index
     * @returns {object|null} - The found sheet object, or null if not found
     */
    findSheet(identifier) {
        // Check if the identifier is a numeric index
        const sheetIndex = parseInt(identifier, 10);
        if (!isNaN(sheetIndex)) {
            const sheets = BASE.getChatSheets();
            if (sheetIndex >= 0 && sheetIndex < sheets.length) {
                return sheets[sheetIndex];
            }
        }
        
        // Otherwise, find the sheet by name
        return BASE.getSheetByName(identifier);
    }

    /**
     * Parse a cell address (e.g., "A1") into row and column indices
     * @param {string} address - The cell address
     * @returns {{row: number, col: number}} - The row and column indices
     */
    parseCellAddress(address) {
        const colStrMatch = address.match(/[A-Z]+/);
        const rowStrMatch = address.match(/\d+/);
        if (!colStrMatch || !rowStrMatch) return { row: -1, col: -1 };

        const colStr = colStrMatch[0];
        const rowStr = rowStrMatch[0];

        // "A" corresponds to index 1 in hashSheet (index 0 is row header)
        const col = colStr.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        // Row "1" corresponds to index 1 in hashSheet (index 0 is column header)
        const row = parseInt(rowStr, 10);
        
        return { row, col };
    }
}

export const placeholderManager = new PlaceholderManager();
