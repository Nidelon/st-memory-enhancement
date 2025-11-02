import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../../core/manager.js';
import { executeIncrementalUpdateFromSummary } from "./absoluteRefresh.js";
import { newPopupConfirm } from '../../components/popupConfirm.js';
import { reloadCurrentChat } from "/script.js"
import {getTablePrompt,initTableData, undoSheets} from "../../index.js"

let toBeExecuted = [];

/**
 * Initialize data required for two-step summarization
 * @param chat
 * */
function InitChatForTableTwoStepSummary(chat) {
    // If currentPiece.uid is undefined, initialize it with a random string
    if (chat.uid === undefined) {
        chat.uid = SYSTEM.generateRandomString(22);
    }
    // If currentPiece.uid_that_references_table_step_update is undefined, initialize it as {}
    if (chat.two_step_links === undefined) {
        chat.two_step_links = {};
    }
    // If currentPiece.uid_that_references_table_step_update is undefined, initialize it as {}
    if (chat.two_step_waiting === undefined) {
        chat.two_step_waiting = {};
    }
}

/**
 * Get the unique identifier for the currently swiped message
 * @param chat
 * @returns {string}
 */
function getSwipeUid(chat) {
    // Initialize chat
    InitChatForTableTwoStepSummary(chat);
    // Get the unique identifier for the current swipe
    const swipeUid = `${chat.uid}_${chat.swipe_id}`;
    // Ensure necessary data structures exist for this swipe
    if (!(swipeUid in chat.two_step_links)) chat.two_step_links[swipeUid] = [];
    if (!(swipeUid in chat.two_step_waiting)) chat.two_step_waiting[swipeUid] = true;
    return swipeUid;
}

/**
 * Check whether the current chat has already been executed by a parent chat
 * @param chat
 * @param targetSwipeUid
 * @returns {*}
 */
function checkIfChatIsExecuted(chat, targetSwipeUid) {
    const chatSwipeUid = getSwipeUid(chat); // Get unique identifier for current chat
    const chatExecutedSwipes = chat.two_step_links[chatSwipeUid]; // Get list of parent chats already executed by current chat
    return chatExecutedSwipes.includes(targetSwipeUid);   // Check if current chat has already been executed by the target chat
}

/**
 * Process identifiers within messages
 * @param string
 * @returns {string}
 */
function handleMessages(string) {
    let r = string.replace(/<(tableEdit|think|thinking)>[\s\S]*?<\/\1>/g, '');

    return r;
}

function MarkChatAsWaiting(chat, swipeUid) {
    console.log(USER.getContext().chat);
    console.log('chat.two_step_links:',chat.two_step_links);
    console.log('chat.two_step_waiting:',chat.two_step_waiting);
    chat.two_step_waiting[swipeUid] = true;
}

/**
 * Execute two-step summarization
 * */
export async function TableTwoStepSummary(mode) {
    if (mode!=="manual" && (USER.tableBaseSetting.isExtensionAble === false || USER.tableBaseSetting.step_by_step === false)) return

    // Get the chat piece requiring two-step summarization
    const {piece: todoPiece} = USER.getChatPiece()

    if (todoPiece === undefined) {
        console.log('No chat segment found for table filling');
        EDITOR.error('No chat segment found for table filling. Please verify the current conversation.');
        return;
    }
    let todoChats = todoPiece.mes;

    console.log('Chat segments pending table filling:', todoChats);

    // Check if pre-execution confirmation is enabled
    const popupContentHtml = `<p>A total of ${todoChats.length} messages will be processed. Proceed with independent table filling?</p>`;
    // Removed template selection-related HTML and logic

    const popupId = 'stepwiseSummaryConfirm';
    const confirmResult = await newPopupConfirm(
        popupContentHtml,
        "Cancel",
        "Execute Table Filling",
        popupId,
        "Do not ask again", // dontRemindText: Permanently disables the popup
        "Always confirm"  // alwaysConfirmText: Confirms for the session
    );

    console.log('newPopupConfirm result for stepwise summary:', confirmResult);

    if (confirmResult === false) {
        console.log('User canceled independent table filling: ', `(${todoChats.length}) `, toBeExecuted);
        MarkChatAsWaiting(currentPiece, swipeUid);
    } else {
        // This block executes if confirmResult is true OR 'dont_remind_active'
        if (confirmResult === 'dont_remind_active') {
            console.log('Independent table-filling popup has been disabled; executing automatically.');
            EDITOR.info('Option "Always confirm" selected. Operation will run automatically in the background...'); // <--- Added background execution notice
        } else { // confirmResult === true
            console.log('User confirmed independent table filling (or selected "Always confirm" for the first time and confirmed)');
        }
        manualSummaryChat(todoChats, confirmResult);
    }
}

/**
 * Manually summarize chat (immediate table filling)
 * Restructured logic:
 * 1. Revert: First call the built-in `undoSheets` function to restore the table state to its previous version.
 * 2. Execute: Based on this clean restored state, invoke the standard incremental update process to request new operations from the AI and apply them.
 * @param {Array} todoChats - Chat history to be used for table filling.
 * @param {string|boolean} confirmResult - User's confirmation result.
 */
export async function manualSummaryChat(todoChats, confirmResult) {
    // Step 1: Check if an "undo" operation is needed
    // First, obtain the current chat piece to assess the table state
    const { piece: initialPiece } = USER.getChatPiece();
    if (!initialPiece) {
        EDITOR.error("Failed to retrieve current chat piece; operation aborted.");
        return;
    }

    // Only perform "undo and redo" if the table already contains data
    if (initialPiece.hash_sheets && Object.keys(initialPiece.hash_sheets).length > 0) {
        console.log('[Memory Enhancement] Immediate table filling: Detected existing table data; performing revert...');
        try {
            await undoSheets(0);
            EDITOR.success('Table reverted to previous version.');
            console.log('[Memory Enhancement] Table revert successful; preparing to fill table.');
        } catch (e) {
            EDITOR.error('Failed to revert table; operation aborted.', e.message, e);
            console.error('[Memory Enhancement] Failed calling undoSheets:', e);
            return;
        }
    } else {
        console.log('[Memory Enhancement] Immediate table filling: Empty table detected; skipping revert and proceeding directly to table filling.');
    }

    // Step 2: Proceed with table filling based on current state (possibly reverted)
    // Re-fetch the piece to ensure we're working with the latest state (either original or reverted)
    const { piece: referencePiece } = USER.getChatPiece();
    if (!referencePiece) {
        EDITOR.error("Failed to retrieve chat piece for operation; operation aborted.");
        return;
    }
    
    // Table data
    const originText = getTablePrompt(referencePiece);

    // Overall table prompt
    const finalPrompt = initTableData(); // Retrieve table-related prompts
    
    // Settings
    const useMainApiForStepByStep = USER.tableBaseSetting.step_by_step_use_main_api ?? true;
    const isSilentMode = confirmResult === 'dont_remind_active';

    const r = await executeIncrementalUpdateFromSummary(
        todoChats,
        originText,
        finalPrompt,
        referencePiece, // Pass the original piece object reference directly
        useMainApiForStepByStep, // API choice for step-by-step
        USER.tableBaseSetting.bool_silent_refresh, // isSilentUpdate
        isSilentMode // Pass silent mode flag
    );

    console.log('Result of independent table filling (incremental update):', r);
    if (r === 'success') {
        // Since modifications were made directly on the referencePiece reference, changes are auto-synced; no need to manually write back hash_sheets.
        toBeExecuted.forEach(chat => {
            const chatSwipeUid = getSwipeUid(chat);
            chat.two_step_links[chatSwipeUid].push(swipeUid);   // Mark two-step summarization as executed
        });
        toBeExecuted = [];

        // Save and refresh UI
        await USER.saveChat();
        // As requested by the user, perform a full page reload to ensure all data—including macros—is updated.
        reloadCurrentChat();
        return true;
    } else if (r === 'suspended' || r === 'error' || !r) {
        console.log('Incremental independent table filling failed or was canceled: ', `(${todoChats.length}) `, toBeExecuted);
        return false;
    }
    
}
