import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../manager.js';
import { SheetBase } from "./base.js";
import { cellStyle, filterSavingData } from "./utils.js";
import { Cell } from "./cell.js";
/**
 * Sheet class for managing table data
 * @description The Sheet class manages table data, including the table's name, domain, type, cell data, etc.
 * @description The Sheet class also provides operations on tables, such as creation, saving, deletion, rendering, etc.
 */
export class Sheet extends SheetBase {
    constructor(target = null) {
        super(target);

        this.currentPopupMenu = null;           // Used to track the currently open popup menu – moved to Sheet (if PopupMenu is still managed within Sheet)
        this.element = null;                    // Used to store the rendered table element
        this.lastCellEventHandler = null;       // Stores the last used cellEventHandler
        this.template = null;                   // Used to store the template
        this.#load(target);
    }

    /**
     * Render the sheet
     * @description Accepts a cellEventHandler parameter, providing a `Cell` object as the callback argument for handling cell events
     * @description The Sheet object can be accessed via `cell.parent`, so passing the Sheet object explicitly is no longer needed
     * @description If no cellEventHandler parameter is provided, the previously used cellEventHandler will be reused
     * @param {Function} cellEventHandler
     * @param targetHashSheet
     */
    renderSheet(cellEventHandler = this.lastCellEventHandler, targetHashSheet = this.hashSheet, lastCellsHashSheet = null) {
        this.lastCellEventHandler = cellEventHandler;

        // Precompute a copy of the data needed for rendering to avoid modifying the actual this.hashSheet
        const currentHashSheet = Array.isArray(targetHashSheet) ? targetHashSheet : (this.hashSheet || []);
        // Perform a shallow local copy only for arrays; do not call BASE.copyHashSheets (it operates on hash_sheets map objects, not 2D arrays)
        let renderHashSheet = Array.isArray(currentHashSheet)
            ? currentHashSheet.map(r => (Array.isArray(r) ? r.slice() : []))
            : [];

        // Integrate cell highlighting logic (from chatSheetsDataView.cellHighlight)
        // 1) Get the previous round's hash_sheets (prefer using the parameter; if none and rendering context exists, auto-calculate)
        let prevHashSheetsMap = lastCellsHashSheet;
        if (prevHashSheetsMap === null && typeof DERIVED?.any?.renderDeep === 'number' && DERIVED.any.renderDeep !== 0) {
            try {
                prevHashSheetsMap = BASE.getLastSheetsPiece(DERIVED.any.renderDeep - 1, 3, false)?.piece?.hash_sheets;
                if (prevHashSheetsMap) prevHashSheetsMap = BASE.copyHashSheets(prevHashSheetsMap);
            } catch (_) {
                // Ignore failure to fetch; keep without highlighting
            }
        }

        const lastHashSheet = prevHashSheetsMap?.[this.uid] || [];

        // 2) Identify deleted rows (rows present in the previous round but missing now), and insert them into the render copy for highlighting (without modifying real data)
        const deleteRowFirstHashes = [];
        if (prevHashSheetsMap) {
            const currentFlat = currentHashSheet.flat();
            lastHashSheet.forEach((row, index) => {
                if (!currentFlat.includes(row?.[0])) {
                    deleteRowFirstHashes.push(row?.[0]);
                    // Insert into render copy
                    const rowCopy = row ? row.slice() : [];
                    renderHashSheet.splice(index, 0, rowCopy);
                }
            });
        }

        // DOM construction
        this.element = document.createElement('table');
        this.element.classList.add('sheet-table', 'tableDom');
        this.element.style.position = 'relative';
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';
        this.element.style.flexGrow = '0';
        this.element.style.flexShrink = '1';

        const styleElement = document.createElement('style');
        styleElement.textContent = cellStyle;
        this.element.appendChild(styleElement);

        const tbody = document.createElement('tbody');
        this.element.appendChild(tbody);
        // Clear tbody contents
        tbody.innerHTML = '';

        // Iterate over the render copy of hashSheet and render each cell
        renderHashSheet.forEach((rowUids, rowIndex) => {
            const rowElement = document.createElement('tr');
            rowUids.forEach((cellUid, colIndex) => {
                let cell = this.cells.get(cellUid);
                if (!cell) {
                    console.warn(`Cell not found: ${cellUid}`);
                    cell = new Cell(this); // If corresponding cell isn't found, create a new Cell instance
                    cell.uid = cellUid; // Set uid
                    cell.data = { value: '' }; // Initialize data
                    this.cells.set(cellUid, cell); // Add newly created cell to cells
                }
                const cellElement = cell.initCellRender(rowIndex, colIndex);
                rowElement.appendChild(cellElement);    // Call Cell's initCellRender method, still requiring rowIndex, colIndex for rendering cell content
                if (cellEventHandler) {
                    cellEventHandler(cell);
                }
            });
            tbody.appendChild(rowElement); // Append rowElement to tbody
        });

        // If no previous round data exists, skip highlighting and return immediately
        if (!prevHashSheetsMap) return this.element;

        // If both current and previous sheets have only headers (or are empty), return directly (skip keep-all processing)
        if ((currentHashSheet.length < 2) && (lastHashSheet.length < 2)) {
            renderHashSheet[0].forEach((hash) => {
                const sheetCell = this.cells.get(hash);
                const cellElement = sheetCell?.element;
                cellElement.classList.add('keep-all-item');
            });
            return this.element; // Skip further logic when table content is empty, improving robustness
        }

        const lastHashSheetFlat = lastHashSheet.flat();

        // 3) Tag each cell with a change type (based on the render copy)
        const changeSheet = renderHashSheet.map((row) => {
            const isNewRow = !lastHashSheetFlat.includes(row?.[0]);
            const isDeletedRow = deleteRowFirstHashes.includes(row?.[0]);
            return row.map((hash) => {
                if (isNewRow) return { hash, type: 'newRow' };
                if (isDeletedRow) return { hash, type: 'deletedRow' };
                if (!lastHashSheetFlat.includes(hash)) return { hash, type: 'update' };
                return { hash, type: 'keep' };
            });
        });

        // 4) Apply CSS classes based on change types
        let isKeepAllSheet = true;
        let isKeepAllCol = Array.from({ length: changeSheet[0].length }, (_, i) => i < 2 ? false : true);
        changeSheet.forEach((row, rowIndex) => {
            if (rowIndex === 0) return;
            let isKeepAllRow = true;
            row.forEach((cell, colIndex) => {
                const sheetCell = this.cells.get(cell.hash);
                const cellElement = sheetCell?.element;
                if (!cellElement) return;

                if (cell.type === 'newRow') {
                    cellElement.classList.add('insert-item');
                    isKeepAllRow = false;
                    isKeepAllCol[colIndex] = false;
                } else if (cell.type === 'update') {
                    cellElement.classList.add('update-item');
                    isKeepAllRow = false;
                    isKeepAllCol[colIndex] = false;
                } else if (cell.type === 'deletedRow') {
                    cellElement.classList.add('delete-item');
                    isKeepAllRow = false;
                } else {
                    cellElement.classList.add('keep-item');
                }
            });
            if (isKeepAllRow) {
                row.forEach((cell) => {
                    const sheetCell = this.cells.get(cell.hash);
                    const cellElement = sheetCell?.element;
                    cellElement.classList.add('keep-all-item');
                });
            } else {
                isKeepAllSheet = false;
            }
        });
        if (isKeepAllSheet) {
            renderHashSheet[0].forEach((hash) => {
                const sheetCell = this.cells.get(hash);
                const cellElement = sheetCell?.element;
                cellElement.classList.add('keep-all-item');
            });
        } else {
            renderHashSheet.forEach((row) => {
                row.filter((_, i) => isKeepAllCol[i]).forEach((hash) => {
                    const sheetCell = this.cells.get(hash);
                    const cellElement = sheetCell?.element;
                    cellElement.classList.add('keep-all-item');
                });
            });
        }

        return this.element;
    }

    /**
     * Save sheet data
     * @returns {Sheet|boolean}
     */
    save(targetPiece = USER.getChatPiece()?.piece, manualSave = false) {
        const sheetDataToSave = this.filterSavingData();
        sheetDataToSave.template = this.template?.uid;

        let sheets = BASE.sheetsData.context ?? [];
        try {
            if (sheets.some(t => t.uid === sheetDataToSave.uid)) {
                sheets = sheets.map(t => t.uid === sheetDataToSave.uid ? sheetDataToSave : t);
            } else {
                sheets.push(sheetDataToSave);
            }
            BASE.sheetsData.context = sheets;
            if (!targetPiece) {
                console.log("No message available to carry hash_sheets data; skipping save");
                return this;
            }
            if (!targetPiece.hash_sheets) targetPiece.hash_sheets = {};
            targetPiece.hash_sheets[this.uid] = this.hashSheet?.map(row => row.map(hash => hash));
            console.log('Saving sheet data', targetPiece, this.hashSheet);
            if (!manualSave) USER.saveChat();

            return this;
        } catch (e) {
            EDITOR.error(`Failed to save template`, e.message, e);
            return false;
        }
    }

    /**
     * Create a new Sheet instance
     * @returns {Sheet} - Returns the new Sheet instance
     */
    createNewSheet(column = 2, row = 2, isSave = true) {
        this.init(column, row);     // Initialize basic data structure
        this.uid = `sheet_${SYSTEM.generateRandomString(8)}`;
        this.name = `NewTable_${this.uid.slice(-4)}`;
        if (isSave) this.save();    // Save the newly created Sheet
        return this;                // Return the Sheet instance itself
    }

    /**
     * Get the prompt text for the table content. By specifying parts from ['title', 'node', 'headers', 'rows', 'editRules'], only selected portions are returned.
     * @returns Table content prompt text
     */
    getTableText(index, customParts = ['title', 'node', 'headers', 'rows', 'editRules']) {
        console.log('Getting table content prompt text', this);
        if (this.triggerSend && this.triggerSendDeep < 1) return ''; // If trigger depth = 0, do not send—can be used as an overview table
        const title = `* ${index}:${this.name}\n`;
        const node = this.source.data.note && this.source.data.note !== '' ? '【Note】' + this.source.data.note + '\n' : '';
        const headers = "rowIndex," + this.getCellsByRowIndex(0).slice(1).map((cell, index) => index + ':' + cell.data.value).join(',') + '\n';
        let rows = this.getSheetCSV();
        const editRules = this.#getTableEditRules() + '\n';
        // New trigger-based table content sending: extract role names from chat history


        if (rows && this.triggerSend) {
            const chats = USER.getContext().chat;
            console.log("Entering trigger-send mode, testing chat retrieval", chats);
            // Extract all 'content' values from chat history
            const chat_content = getLatestChatHistory(chats, this.triggerSendDeep);
            console.log('Retrieved chat content: ', chat_content);
            console.log("Chat content type:", typeof (chat_content));
            const rowsArray = rows.split('\n').filter(line => {
                line = line.trim();
                if (!line) return false;
                const parts = line.split(',');
                const str1 = parts?.[1] ?? ""; // String1 corresponds to index 1
                return chat_content.includes(str1);
            });
            rows = rowsArray.join('\n');
        }
        let result = '';
        console.log('Testing table content prompt retrieval', customParts, result, this);
        if (customParts.includes('title')) {
            result += title;
        }
        if (customParts.includes('node')) {
            result += node;
        }
        if (customParts.includes('headers')) {
            result += '【Table Content】\n' + headers;
        }
        if (customParts.includes('rows')) {
            result += rows;
        }
        if (customParts.includes('editRules')) {
            result += editRules;
        }
        return result;
    }


    /**
     * Get the table's content data (for backward compatibility with older versions)
     * @returns {string[][]} - Returns the table's content data
     */
    getContent(withHead = false) {
        if (!withHead && this.isEmpty()) return [];
        const content = this.hashSheet.map((row) =>
            row.map((cellUid) => {
                const cell = this.cells.get(cellUid);
                if (!cell) return "";
                return cell.data.value;
            })
        );

        // Remove the first element of each row
        const trimmedContent = content.map(row => row.slice(1));
        if (!withHead) return trimmedContent.slice(1);
        return content;
    }

    getJson() {
        const sheetDataToSave = this.filterSavingData(["uid", "name", "domain", "type", "enable", "required", "tochat", "triggerSend", "triggerSendDeep", "config", "sourceData", "content"]);
        delete sheetDataToSave.cellHistory;
        delete sheetDataToSave.hashSheet;
        sheetDataToSave.sourceData = this.source.data;
        sheetDataToSave.content = this.getContent(true);
        return sheetDataToSave;
    }

    getReadableJson() {
        return {
            tableName: this.name,
            tableUid: this.uid,
            columns: this.getHeader(),
            content: this.getContent()
        };
    }
    /** _______________________________________ Functions below are not intended for external calls _______________________________________ */

    #load(target) {
        if (target == null) {
            return this;
        }
        if (typeof target === 'string') {
            let targetSheetData = BASE.sheetsData.context?.find(t => t.uid === target);
            if (targetSheetData?.uid) {
                this.loadJson(targetSheetData);
                return this;
            }
            throw new Error('Template not found');
        }
        if (typeof target === 'object') {
            if (target.domain === SheetBase.SheetDomain.global) {
                console.log('Converting template to sheet', target, this);
                this.loadJson(target);
                this.domain = 'chat';
                this.uid = `sheet_${SYSTEM.generateRandomString(8)}`;
                this.name = this.name.replace('Template', 'Table');
                this.template = target;
                return this;
            } else {
                this.loadJson(target);
                return this;
            }
        }
    }
    /**
     * Get the table editing rules prompt text
     * @returns
     */
    #getTableEditRules() {
        const source = this.source;
        if (this.required && this.isEmpty()) return '【Insert/Delete/Update Trigger Conditions】\nInsert: ' + source.data.initNode + '\n';
        else {
            let editRules = '【Insert/Delete/Update Trigger Conditions】\n';
            if (source.data.insertNode) editRules += ('Insert: ' + source.data.insertNode + '\n');
            if (source.data.updateNode) editRules += ('Update: ' + source.data.updateNode + '\n');
            if (source.data.deleteNode) editRules += ('Delete: ' + source.data.deleteNode + '\n');
            return editRules;
        }
    }

    /**
     * Initialize hashSheet, keeping only the header row
     */
    initHashSheet() {
        this.hashSheet = [this.hashSheet[0].map(uid => uid)];
        this.markPositionCacheDirty();
    }

    /**
     * Get a cell by its "A1"-style address
     * @param {string} address - e.g., "A1", "B2"
     * @returns {Cell|null}
     */
    getCellFromAddress(address) {
        if (typeof address !== 'string' || !/^[A-Z]+\d+$/.test(address)) {
            return null;
        }

        const colStr = address.match(/^[A-Z]+/)[0];
        const rowStr = address.match(/\d+$/)[0];

        const row = parseInt(rowStr, 10) - 1;

        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
        }
        col -= 1;

        if (row < 0 || col < 0) return null;

        const cellUid = this.hashSheet?.[row]?.[col];
        return cellUid ? this.cells.get(cellUid) : null;
    }
}

/**
 * Get chat history content up to a specified depth
 * @param {Current chat log} chat
 * @param {Scan depth} deep
 * @returns string
 */
function getLatestChatHistory(chat, deep) {
    let filteredChat = chat;

    let collected = "";
    const floors = filteredChat.length;
    // Traverse backwards from the latest record, up to the maximum allowed depth or total messages
    for (let i = 0; i < Math.min(deep, floors); i++) {
        // Format message and strip tags
        const currentStr = `${filteredChat[floors - i - 1].mes}`
            .replace(/<tableEdit>[\s\S]*?<\/tableEdit>/g, '');
        collected += currentStr;
    }
    return collected;
}
