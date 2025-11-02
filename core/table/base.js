import {Cell} from "./cell.js";
import {filterSavingData} from "./utils.js";

const SheetDomain = {
    global: 'global',
    role: 'role',
    chat: 'chat',
}
const SheetType = {
    free: 'free',
    dynamic: 'dynamic',
    fixed: 'fixed',
    static: 'static',
}
const customStyleConfig = {
    mode: 'regex',
    basedOn: 'html',
    regex: '/(^[\\s\\S]*$)/g',
    replace: `$1`,
    replaceDivide: '',  // Used to temporarily store separated CSS code
}

export class SheetBase {
    static SheetDomain = SheetDomain;
    static SheetType = SheetType;

    constructor() {
        // Basic properties below
        this.uid = '';
        this.name = '';
        this.domain = '';
        this.type = SheetType.dynamic;
        this.enable = true;                     // Indicates whether enabled
        this.required = false;                  // Indicates whether required
        this.tochat = true;                     // Indicates whether sent to chat
        this.triggerSend = false;               // Indicates whether triggers sending to AI
        this.triggerSendDeep = 1;               // Records the depth of trigger sending

        // Persistent data below
        this.cellHistory = [];                  // cellHistory is persistently kept, append-only
        this.hashSheet = [];                    // hashSheet structure per turn, used for rendering the table

        this.config = {
            // Other properties below
            toChat: true,                       // Indicates whether sent to chat
            useCustomStyle: false,              // Indicates whether custom style is used
            triggerSendToChat: false,           // Indicates whether triggers sending to chat
            alternateTable: false,              // Indicates whether this table participates in interleaving mode and exposes original setting level
            insertTable: false,                 // Indicates whether the table needs insertion; default is false (no insertion)
            alternateLevel: 0,                  // Indicates interleaving level; 0 means no interleaving, >0 means interleaving at the same level
            skipTop: false,                     // Indicates whether to skip the table header
            selectedCustomStyleKey: '',         // Stores the selected custom style key; uses default style if selectedCustomStyleUid is empty
            customStyles: {'Custom Style': {...customStyleConfig}}, // Stores custom styles
        }

        // Temporary properties
        this.tableSheet = [];                   // Stores table data for merging and interleaving

        // Derived data below
        this.cells = new Map();                 // cells are loaded from cellHistory each time Sheet initializes
        this.data = new Proxy({}, {             // Stores user-defined table data
            get: (target, prop) => {
                return this.source.data[prop];
            },
            set: (target, prop, value) => {
                this.source.data[prop] = value;
                return true;
            },
        });
        this._cellPositionCacheDirty = true;    // Indicates whether sheetCellPosition needs recalculation
        this.positionCache = new Proxy(new Map(), {
            get: (map, uid) => {
                if (this._cellPositionCacheDirty || !map.has(uid)) {
                    map.clear();
                    this.hashSheet.forEach((row, rowIndex) => {
                        row.forEach((cellUid, colIndex) => {
                            map.set(cellUid, [rowIndex, colIndex]);
                        });
                    });
                    this._cellPositionCacheDirty = false;   // Mark as clean after update
                    console.log('Recalculating positionCache: ', map);
                }
                return map.get(uid);
            },
        });
    }
    get source() {
        return this.cells.get(this.hashSheet[0][0]);
    }

    markPositionCacheDirty() {
        this._cellPositionCacheDirty = true;
        // console.log(`Marking Sheet: ${this.name} (${this.uid}) positionCache as dirty`);
    }

    init(column = 2, row = 2) {
        this.cells = new Map();
        this.cellHistory = [];
        this.hashSheet = [];

        // Initialize hashSheet structure
        const r = Array.from({ length: row }, (_, i) => Array.from({ length: column }, (_, j) => {
            let cell = new Cell(this);
            this.cells.set(cell.uid, cell);
            this.cellHistory.push(cell);
            if (i === 0 && j === 0) {
                cell.type = Cell.CellType.sheet_origin;
            } else if (i === 0) {
                cell.type = Cell.CellType.column_header;
            } else if (j === 0) {
                cell.type = Cell.CellType.row_header;
            }
            return cell.uid;
        }));
        this.hashSheet = r;

        return this;
    };

    rebuildHashSheetByValueSheet(valueSheet) {
        const cols = valueSheet[0].length
        const rows = valueSheet.length
        const usedCellUids = []; // Tracks used cell UIDs
        const newHashSheet = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => {
            const value = valueSheet[i][j] || '';
            const cellType = this.getCellTypeByPosition(i, j);
            // Reuse existing cell with same value if available, excluding already used cells
            const oldCell = this.findCellByValue(valueSheet[i][j] || '', cellType, usedCellUids)
            if (oldCell) {
                usedCellUids.push(oldCell.uid); // Mark as used
                return oldCell.uid; // Reuse existing cell
            }
            const cell = new Cell(this);
            this.cells.set(cell.uid, cell);
            this.cellHistory.push(cell);
            cell.data.value = valueSheet[i][j] || ''; // Set cell value
            if (i === 0 && j === 0) {
                cell.type = Cell.CellType.sheet_origin;
            } else if (i === 0) {
                cell.type = Cell.CellType.column_header;
            } else if (j === 0) {
                cell.type = Cell.CellType.row_header;
            }
            usedCellUids.push(cell.uid); // Mark newly created cell as used
            return cell.uid;
        }));
        this.hashSheet = newHashSheet
        return this
    }

    loadJson(json) {
        Object.assign(this, JSON.parse(JSON.stringify(json)));
        if(this.cellHistory.length > 0) this.loadCells()
        if(this.content) this.rebuildHashSheetByValueSheet(this.content)
        if(this.sourceData) this.source.data = this.sourceData

        this.markPositionCacheDirty();
    }

    getCellTypeByPosition(rowIndex, colIndex) {
        if (rowIndex === 0 && colIndex === 0) {
            return Cell.CellType.sheet_origin;
        }
        if (rowIndex === 0) {
            return Cell.CellType.column_header;
        }
        if (colIndex === 0) {
            return Cell.CellType.row_header;
        }
        return Cell.CellType.cell;
    }

    loadCells() {
        // Load Cell objects from cellHistory
        try {
            this.cells = new Map(); // Initialize cells Map
            this.cellHistory?.forEach(c => { // Load Cell objects from cellHistory
                const cell = new Cell(this);
                Object.assign(cell, c);
                this.cells.set(cell.uid, cell);
            });
        } catch (e) {
            console.error(`Load failed: ${e}`);
            return false;
        }

        // Reassign cell types
        try {
            if (this.hashSheet && this.hashSheet.length > 0) {
                this.hashSheet.forEach((rowUids, rowIndex) => {
                    rowUids.forEach((cellUid, colIndex) => {
                        let cell = this.cells.get(cellUid);
                        if (!cell) {
                            cell = new Cell(this);
                            cell.uid = cellUid;
                            cell.data.value = 'Empty Data'
                            this.cells.set(cell.uid, cell);
                        }
                        if (rowIndex === 0 && colIndex === 0) {
                            cell.type = Cell.CellType.sheet_origin;
                        } else if (rowIndex === 0) {
                            cell.type = Cell.CellType.column_header;
                        } else if (colIndex === 0) {
                            cell.type = Cell.CellType.row_header;
                        } else {
                            cell.type = Cell.CellType.cell;
                        }
                    });
                });
            }
        } catch (e) {
            console.error(`Load failed: ${e}`);
            return false;
        }
    }

    findCellByValue(value, cellType = null, excludeUids = []) {
        const cell = this.cellHistory.find(cell => 
            cell.data.value === value && 
            (cellType === null || cell.type === cellType) &&
            !excludeUids.includes(cell.uid)
        );
        if (!cell) {
            return null;
        }
        return cell;
    }

    findCellByPosition(rowIndex, colIndex) {
        if (rowIndex < 0 || colIndex < 0 || rowIndex >= this.hashSheet.length || colIndex >= this.hashSheet[0].length) {
            console.warn('Invalid row/column index');
            return null;
        }
        const hash = this.hashSheet[rowIndex][colIndex]
        const target = this.cells.get(hash) || null;
        if (!target) {
            const cell = new Cell(this);
            cell.data.value = 'Empty Data';
            cell.type = colIndex === 0 ? Cell.CellType.row_header : rowIndex === 0 ? Cell.CellType.column_header : Cell.CellType.cell;
            cell.uid = hash;
            this.cells.set(cell.uid, cell);
            return cell;
        }
        console.log('Found cell',target);
        return target;
    }
    /**
     * Get all cells in a row by row index
     * @param {number} rowIndex
     * @returns cell[]
     */
    getCellsByRowIndex(rowIndex) {
        if (rowIndex < 0 || rowIndex >= this.hashSheet.length) {
            console.warn('Invalid row index');
            return null;
        }
        return this.hashSheet[rowIndex].map(uid => this.cells.get(uid));
    }
    /**
     * Get table content in CSV format
     * @returns
     */
    getSheetCSV( removeHeader = true, key = 'value') {
        if (this.isEmpty()) return '（This table is currently empty）\n'
        console.log("Testing map retrieval", this.cells)
        const content = this.hashSheet.slice(removeHeader?1:0).map((row, index) => row.map(cellUid => {
            const cell = this.cells.get(cellUid)
            if (!cell) return ""
            return cell.type === Cell.CellType.row_header ? index : cell.data[key]
        }).join(',')).join('\n');
        return content + "\n";
    }
    /**
     * Check if table is empty
     * @returns {boolean} whether empty
     */
    isEmpty() {
        return this.hashSheet.length <= 1;
    }

    filterSavingData(key, withHead = false) {
        return filterSavingData(this, key, withHead)
    }

    getRowCount() {
        return this.hashSheet.length;
    }

    /**
     * Get header array (backward-compatible with old data)
     * @returns {string[]} header array
     */
    getHeader() {
        const header = this.hashSheet[0].slice(1).map(cellUid => {
            const cell = this.cells.get(cellUid);
            return cell ? cell.data.value : '';
        });
        return header;
    }
}
