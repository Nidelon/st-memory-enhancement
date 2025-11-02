import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../manager.js';
import {SheetBase} from "./base.js";
import {cellStyle} from "./utils.js";

export class SheetTemplate extends SheetBase {
    constructor(target = null) {
        super();
        this.domain = SheetBase.SheetDomain.global
        this.currentPopupMenu = null;           // Used to track the currently popped-up menu – moved to Sheet (if PopupMenu still needs to be managed within Sheet)
        this.element = null;                    // Used to store the rendered table element
        this.lastCellEventHandler = null;       // Stores the last used cellEventHandler

        this.#load(target);
    }

    /**
     * Render the table
     * @description Accepts a cellEventHandler parameter, which provides a `Cell` object as a callback argument for handling cell events
     * @description The Sheet object can be accessed via `cell.parent`, so passing the Sheet object explicitly is no longer needed
     * @description If no cellEventHandler is provided, the previously used cellEventHandler will be reused
     * @param {Function} cellEventHandler
     */
    renderSheet(cellEventHandler = this.lastCellEventHandler) {
        this.lastCellEventHandler = cellEventHandler;

        if (!this.element) {
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
        }

        // Ensure the element contains a tbody; create one if it doesn't exist
        let tbody = this.element.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            this.element.appendChild(tbody);
        }
        // Clear tbody contents
        tbody.innerHTML = '';

        // Iterate over hashSheet and render each cell
        this.hashSheet.forEach((rowUids, rowIndex) => {
            if (rowIndex > 0) return;
            const rowElement = document.createElement('tr');
            rowUids.forEach((cellUid, colIndex) => {
                const cell = this.cells.get(cellUid)
                const cellElement = cell.initCellRender(rowIndex, colIndex);
                rowElement.appendChild(cellElement);    // Call Cell's initCellRender method; rowIndex and colIndex are still required for rendering cell content
                if (cellEventHandler) {
                    cellEventHandler(cell);
                }
            });
            tbody.appendChild(rowElement); // Append rowElement to tbody
        });
        return this.element;
    }

    createNewTemplate(column = 2, row = 2, isSave = true) {
        this.init(column, row); // Initialize basic data structure
        this.uid = `template_${SYSTEM.generateRandomString(8)}`;
        this.name = `NewTemplate_${this.uid.slice(-4)}`;
        this.loadCells();
        isSave && this.save(); // Save the newly created Sheet
        return this; // Return the Sheet instance itself
    }

    /**
     * Save sheet data
     * @returns {SheetTemplate}
     */
    save(manualSave = false) {
        let templates = BASE.templates;
        if (!templates) templates = [];
        try {
            const sheetDataToSave = this.filterSavingData();
            if (templates.some(t => t.uid === sheetDataToSave.uid)) {
                templates = templates.map(t => t.uid === sheetDataToSave.uid ? sheetDataToSave : t);
            } else {
                templates.push(sheetDataToSave);
            }
            console.log("Saving template data", templates)
            USER.getSettings().table_database_templates = templates;
            if(!manualSave) USER.saveSettings();
            return this;
        } catch (e) {
            EDITOR.error(`Failed to save template`, e.message, e);
            return null;
        }
    }
    /**
     * Delete sheet data; deletion location is determined by domain
     * @returns {*}
     */
    delete() {
        let templates = BASE.templates;
        USER.getSettings().table_database_templates = templates.filter(t => t.uid !== this.uid);
        USER.saveSettings();
        return templates;
    }

    /** _______________________________________ The following functions are not intended for external use _______________________________________ */

    #load(target) {
        if (target === null) {
            // Create a new empty Sheet
            this.init();
            return this;
        }
        // Load from template library
        let targetUid = target?.uid || target;
        let targetSheetData = BASE.templates?.find(t => t.uid === targetUid);
        if (targetSheetData?.uid) {
            Object.assign(this, targetSheetData);
            this.loadCells();
            this.markPositionCacheDirty();
            return this;
        }

        throw new Error('Corresponding template not found');
        // if (target instanceof Sheet) {
        //     // Template from a Sheet instance
        //     this.uid = `template_${SYSTEM.generateRandomString(8)}`;
        //     this.name = target.name.replace('Sheet', 'Template');
        //     this.hashSheet = [target.hashSheet[0]];
        //     this.cellHistory = target.cellHistory.filter(c => this.hashSheet[0].includes(c.uid));
        //     this.loadCells();
        //     this.markPositionCacheDirty();
        //     return this;
        // } else {
        //     // Load from template library
        //     let targetUid = target?.uid || target;
        //     let targetSheetData = BASE.templates?.find(t => t.uid === targetUid);
        //     if (targetSheetData?.uid) {
        //         Object.assign(this, targetSheetData);
        //         this.loadCells();
        //         this.markPositionCacheDirty();
        //         return this;
        //     }
        //
        //     throw new Error('Corresponding template not found');
        // }
    }

}
