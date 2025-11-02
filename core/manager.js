import { TTable } from "./tTableManager.js";
import applicationFunctionManager from "../services/appFuncManager.js";
// Remove reference to the old table system
import { consoleMessageToEditor } from "../scripts/settings/devConsole.js";
import { calculateStringHash, generateRandomNumber, generateRandomString, lazy, readonly, } from "../utils/utility.js";
import { defaultSettings } from "../data/pluginSetting.js";
import { Drag } from "../components/dragManager.js";
import { PopupMenu } from "../components/popupMenu.js";
import { buildSheetsByTemplates, convertOldTablesToNewSheets } from "../index.js";
import { getRelativePositionOfCurrentCode } from "../utils/codePathProcessing.js";
import { pushCodeToQueue } from "../components/_fotTest.js";
import { createProxy, createProxyWithUserSetting } from "../utils/codeProxy.js";
import { refreshTempView } from '../scripts/editor/tableTemplateEditView.js';
import { newPopupConfirm, PopupConfirm } from "../components/popupConfirm.js";
import { refreshContextView } from "../scripts/editor/chatSheetsDataView.js";
import { updateSystemMessageTableStatus } from "../scripts/renderer/tablePushToChat.js";
import {taskTiming} from "../utils/system.js";
import {updateSelectBySheetStatus} from "../scripts/editor/tableTemplateEditView.js";

let derivedData = {}

export const APP = applicationFunctionManager

/**
 * @description `USER` User Data Manager
 * @description This manager handles user settings, context, chat history, and other user-related data.
 * @description Please note that user data should only be accessed through the methods provided by this manager, not directly.
 */
export const USER = {
    getSettings: () => APP.power_user,
    getExtensionSettings: () => APP.extension_settings,
    saveSettings: () => APP.saveSettings(),
    saveChat: () => APP.saveChat(),
    getContext: () => APP.getContext(),
    isSwipe:()=>
    {
        const chats = USER.getContext().chat
        const lastChat = chats[chats.length - 1];
        const isIncludeEndIndex = (!lastChat) || lastChat.is_user === true;
        if(isIncludeEndIndex) return {isSwipe: false}
        const {deep} = USER.getChatPiece()
        return {isSwipe: true, deep}
    },
    getChatPiece: (deep = 0, direction = 'up') => {
        const chat = APP.getContext().chat;
        if (!chat || chat.length === 0 || deep >= chat.length) return  {piece: null, deep: -1};
        let index = chat.length - 1 - deep
        while (chat[index].is_user === true) {
            if(direction === 'up')index--
            else index++
            if (!chat[index]) return {piece: null, deep: -1}; // If no non-user message is found, return null
        }
        return {piece:chat[index], deep: index};
    },
    loadUserAllTemplates() {
        let templates = USER.getSettings().table_database_templates;
        if (!Array.isArray(templates)) {
            templates = [];
            USER.getSettings().table_database_templates = templates;
            USER.saveSettings();
        }
        console.log("Global templates", templates)
        return templates;
    },
    tableBaseSetting: createProxyWithUserSetting('muyoo_dataTable'),
    tableBaseDefaultSettings: { ...defaultSettings },
    IMPORTANT_USER_PRIVACY_DATA: createProxyWithUserSetting('IMPORTANT_USER_PRIVACY_DATA', true),
}


/**
 * @description `BASE` Database Base Data Manager
 * @description This manager provides read-only access to user data and template data in the database.
 * @description Note: Operations on the database should be performed via `BASE.object()` to create a `Sheet` instance.
 *               Direct editing of the database through this manager is not allowed.
 */
export const BASE = {
    /**
     * @description `Sheet` Data Sheet Instance
     * @description This instance is used to access, modify, query, and otherwise operate on database data.
     * @description All database operations should go through this instance, not direct access.
     */
    Sheet: TTable.Sheet,
    SheetTemplate: TTable.Template,
    refreshContextView: refreshContextView,
    refreshTempView: refreshTempView,
    updateSystemMessageTableStatus: updateSystemMessageTableStatus,
    get templates() {
        return USER.loadUserAllTemplates()
    },
    contextViewRefreshing: false,
    sheetsData: new Proxy({}, {
        get(_, target) {
            switch (target) {
                case 'all':

                case 'context':
                    if (!USER.getContext().chatMetadata) {
                        USER.getContext().chatMetadata = {};
                    }
                    if (!USER.getContext().chatMetadata.sheets) {
                        USER.getContext().chatMetadata.sheets = [];
                    }
                    return USER.getContext().chatMetadata.sheets;
                case 'global':

                case 'role':

                default:
                    throw new Error(`Unknown sheetsData target: ${target}`);
            }
        },
        set(_, target, value) {
            switch (target) {
                case 'context':
                    if (!USER.getContext().chatMetadata) {
                        USER.getContext().chatMetadata = {};
                    }
                    USER.getContext().chatMetadata.sheets = value;
                    return true;
                case 'all':
                case 'global':
                case 'role':
                default:
                    throw new Error(`Cannot set sheetsData target: ${target}`);
            }
        }
    }),
    getChatSheets(process=()=> {}) {
        DERIVED.any.chatSheetMap = DERIVED.any.chatSheetMap || {}
        const sheets = []
        BASE.sheetsData.context.forEach(sheet => {
            if (!DERIVED.any.chatSheetMap[sheet.uid]) {
                const newSheet = new BASE.Sheet(sheet.uid)
                DERIVED.any.chatSheetMap[sheet.uid] = newSheet
            }
            process(DERIVED.any.chatSheetMap[sheet.uid])
            sheets.push(DERIVED.any.chatSheetMap[sheet.uid])
        })
        return sheets
    },
    getChatSheet(uid){
        const sheet = DERIVED.any.chatSheetMap[uid]
        if (!sheet) {
            if(!BASE.sheetsData.context.some(sheet => sheet.uid === uid)) return null
            const newSheet = new BASE.Sheet(uid)
            DERIVED.any.chatSheetMap[uid] = newSheet
            return newSheet
        }
        return sheet
    },
    createChatSheetByTemp(temp){
        DERIVED.any.chatSheetMap = DERIVED.any.chatSheetMap || {}
        const newSheet = new BASE.Sheet(temp);
        DERIVED.any.chatSheetMap[newSheet.uid] = newSheet
        return newSheet
    },
    createChatSheet(cols, rows){
        const newSheet = new BASE.Sheet();
        newSheet.createNewSheet(cols, rows, false);
        DERIVED.any.chatSheetMap[newSheet.uid] = newSheet
        return newSheet
    },
    createChatSheetByJson(json){
        const newSheet = new BASE.Sheet();
        newSheet.loadJson(json);
        DERIVED.any.chatSheetMap[newSheet.uid] = newSheet
        return newSheet
    },
    copyHashSheets(hashSheets) {
        const newHashSheet = {}
        for (const sheetUid in hashSheets) {
            const hashSheet = hashSheets[sheetUid];
            newHashSheet[sheetUid] = hashSheet.map(row => row.map(hash => hash));
        }
        return newHashSheet
    },
    applyJsonToChatSheets(json, type ="both") {
        const newSheets = Object.entries(json).map(([sheetUid, sheetData]) => {
            if(sheetUid === 'mate') return null
            const sheet = BASE.getChatSheet(sheetUid);
            if (sheet) {
                sheet.loadJson(sheetData)
                return sheet
            } else {
                if(type === 'data') return null
                else return BASE.createChatSheetByJson(sheetData)
            }
        }).filter(Boolean)
        if(type === 'data') return BASE.saveChatSheets()
        const oldSheets = BASE.getChatSheets().filter(sheet => !newSheets.some(newSheet => newSheet.uid === sheet.uid))
        oldSheets.forEach(sheet => sheet.enable = false)
        console.log("Applying sheet data", newSheets, oldSheets)
        const mergedSheets = [...newSheets, ...oldSheets]
        BASE.reSaveAllChatSheets(mergedSheets)
    },
    saveChatSheets(saveToPiece = true) {
        if(saveToPiece){
            const {piece} = USER.getChatPiece()
            if(!piece) return EDITOR.error("No message container found. Sheets are saved within chat history—please chat at least one round before retrying.")
            BASE.getChatSheets(sheet => sheet.save(piece, true))
        }else BASE.getChatSheets(sheet => sheet.save(undefined, true))
        USER.saveChat()
    },
    reSaveAllChatSheets(sheets) {
        BASE.sheetsData.context = []
        const {piece} = USER.getChatPiece()
        if(!piece) return EDITOR.error("No message container found. Sheets are saved within chat history—please chat at least one round before retrying.")
        sheets.forEach(sheet => {
            sheet.save(piece, true)
        })
        updateSelectBySheetStatus()
        BASE.refreshTempView(true)
        USER.saveChat()
    },
    updateSelectBySheetStatus(){
        updateSelectBySheetStatus()
    },
    getLastSheetsPiece(deep = 0, cutoff = 1000, deepStartAtLastest = true, direction = 'up') {
        console.log("Searching upward for sheet data, depth:", deep, "cutoff:", cutoff, "start from latest:", deepStartAtLastest)
        // If no sheet data from the new system is found, attempt to locate data from the old system (compatibility mode)
        const chat = APP.getContext().chat
        if (!chat || chat.length === 0 || chat.length <= deep) {
            return { deep: -1, piece: BASE.initHashSheet() }
        }
        const startIndex = deepStartAtLastest ? chat.length - deep - 1 : deep;
        for (let i = startIndex;
            direction === 'up' ? (i >= 0 && i >= startIndex - cutoff) : (i < chat.length && i < startIndex + cutoff);
            direction === 'up' ? i-- : i++) {
            if (chat[i].is_user === true) continue; // Skip user messages
            if (chat[i].hash_sheets) {
                console.log("Found sheet data while searching upward:", chat[i])
                return { deep: i, piece: chat[i] }
            }
            // If no sheet data from the new system is found, attempt to locate data from the old system (compatibility mode)
            // Note: The old Table class is no longer used
            if (chat[i].dataTable) {
                // For backward compatibility, convert old data into the new Sheet format
                console.log("Found legacy table data:", chat[i])
                convertOldTablesToNewSheets(chat[i].dataTable, chat[i])
                return { deep: i, piece: chat[i] }
            }
        }
        return { deep: -1, piece: BASE.initHashSheet() }
    },
    getReferencePiece(){
        const swipeInfo = USER.isSwipe()
        console.log("Getting reference message piece", swipeInfo)
        const {piece} = swipeInfo.isSwipe?swipeInfo.deep===-1?{piece:BASE.initHashSheet()}: BASE.getLastSheetsPiece(swipeInfo.deep-1,1000,false):BASE.getLastSheetsPiece()
        return piece
    },
    hashSheetsToSheets(hashSheets) {
        if (!hashSheets) {
            return [];
        }
        return BASE.getChatSheets((sheet)=>{
            if (hashSheets[sheet.uid]) {
                sheet.hashSheet = hashSheets[sheet.uid].map(row => row.map(hash => hash));
            }else sheet.initHashSheet()
        })
    },
    getLastestSheets(){
        const { piece, deep } = BASE.getLastSheetsPiece();
        if (!piece || !piece.hash_sheets) return
        return BASE.hashSheetsToSheets(piece.hash_sheets);
    },
    initHashSheet() {
        if (BASE.sheetsData.context.length === 0) {
            console.log("Attempting to build sheet data from templates")
            const {piece: currentPiece} = USER.getChatPiece()
            buildSheetsByTemplates(currentPiece)
            if (currentPiece?.hash_sheets) {
                // console.log('Created new sheet data from templates:', currentPiece)
                return currentPiece
            }
        }
        const hash_sheets = {}
        BASE.sheetsData.context.forEach(sheet => {
            hash_sheets[sheet.uid] = [sheet.hashSheet[0].map(hash => hash)]
        })
        return { hash_sheets }
    }
};


/**
 * @description `Editor` Editor Controller
 * @description This controller manages editor state, events, settings, including mouse position,
 *              focused panel, hovered panel, active panel, etc.
 * @description Editor-specific data should remain independent from other data.
 *              Modifying editor data should not affect derived or user data, and vice versa.
 */
export const EDITOR = {
    Drag: Drag,
    PopupMenu: PopupMenu,
    Popup: APP.Popup,
    callGenericPopup: APP.callGenericPopup,
    POPUP_TYPE: APP.POPUP_TYPE,
    generateRaw: APP.generateRaw,
    getSlideToggleOptions: APP.getSlideToggleOptions,
    slideToggle: APP.slideToggle,
    confirm: newPopupConfirm,
    tryBlock: (cb, errorMsg, ...args) => {
        try {
            return cb(...args);
        } catch (e) {
            EDITOR.error(errorMsg ?? 'Failed to execute code block', e.message, e);
            return null;
        }
    },
    info: (message, detail = '', timeout = 500) => consoleMessageToEditor.info(message, detail, timeout),
    success: (message, detail = '', timeout = 500) => consoleMessageToEditor.success(message, detail, timeout),
    warning: (message, detail = '', timeout = 2000) => consoleMessageToEditor.warning(message, detail, timeout),
    error: (message, detail = '', error, timeout = 2000) => consoleMessageToEditor.error(message, detail, error, timeout),
    clear: () => consoleMessageToEditor.clear(),
    logAll: () => {
        SYSTEM.codePathLog({
            'user_table_database_setting': USER.getSettings().muyoo_dataTable,
            'user_tableBase_templates': USER.getSettings().table_database_templates,
            'context': USER.getContext(),
            'context_chatMetadata_sheets': USER.getContext().chatMetadata?.sheets,
            'context_sheets_data': BASE.sheetsData.context,
            'chat_last_piece': USER.getChatPiece()?.piece,
            'chat_last_sheet': BASE.getLastSheetsPiece()?.piece.hash_sheets,
            'chat_last_old_table': BASE.getLastSheetsPiece()?.piece.dataTable,
        }, 3);
    },
}


/**
 * @description `DerivedData` Derived Data Manager
 * @description This manager handles runtime-derived data, including intermediate user data, system data, library data, etc.
 * @description Note: Sensitive data must NOT be stored or relayed through this derived data manager.
 */
export const DERIVED = {
    get any() {
        return createProxy(derivedData);
    },
    // Remove reference to the old Table class; use the new Sheet and SheetTemplate classes instead
};


/**
 * @description `SYSTEM` System Controller
 * @description This controller manages system-level data, events, settings, including component loading,
 *              file I/O, code path logging, etc.
 */
export const SYSTEM = {
    getTemplate: (name) => {
        console.log('getTemplate', name);
        return APP.renderExtensionTemplateAsync('third-party/st-memory-enhancement/assets/templates', name);
    },

    codePathLog: function (context = '', deep = 2) {
        const r = getRelativePositionOfCurrentCode(deep);
        const rs = `${r.codeFileRelativePathWithRoot}[${r.codePositionInFile}] `;
        console.log(`%c${rs}${r.codeAbsolutePath}`, 'color: red', context);
    },
    lazy: lazy,
    generateRandomString: generateRandomString,
    generateRandomNumber: generateRandomNumber,
    calculateStringHash: calculateStringHash,

    // readFile: fileManager.readFile,
    // writeFile: fileManager.writeFile,

    taskTiming: taskTiming,
    f: (f, name) => pushCodeToQueue(f, name),
};
