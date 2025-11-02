// tableTemplateEditView.js
import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../../core/manager.js';
import { PopupMenu } from '../../components/popupMenu.js';
import { Form } from '../../components/formManager.js';
import { openSheetStyleRendererPopup } from "./sheetStyleEditor.js";
import { compareDataDiff } from "../../utils/utility.js";
import {SheetBase} from "../../core/table/base.js"
import { Cell } from '../../core/table/cell.js';

let drag = null;
let currentPopupMenu = null;
let dropdownElement = null;
const renderedTables = new Map();
let scope = 'chat'

const formConfigs = {
    sheet_origin: {
        formTitle: "Edit Table",
        formDescription: "Overall settings for a single table.",
        fields: [

        ]
    },
    column_header: {
        formTitle: "Edit Column",
        formDescription: "Set the column title and description.",
        fields: [
            { label: 'Column Title', type: 'text', dataKey: 'value' },
            { label: 'Disallow Duplicate Values', type: 'checkbox', dataKey: 'valueIsOnly' },
            {
                label: 'Data Type', type: 'select', dataKey: 'columnDataType',
                options: [
                    { value: 'text', text: 'Text' },
                    // { value: 'number', text: 'Number' },
                    // { value: 'option', text: 'Option' },
                ]
            },
            //{ label: 'Column Description', description: '', type: 'textarea', rows: 4, dataKey: 'columnNote' },
        ],
    },
    row_header: {
        formTitle: "Edit Row",
        formDescription: "Set the row title and description.",
        fields: [
            { label: 'Row Title', type: 'text', dataKey: 'value' },
            //{ label: 'Row Description', description: '(Explain this row\'s purpose to the AI)', type: 'textarea', rows: 4, dataKey: 'rowNote' },
        ],
    },
    cell: {
        formTitle: "Edit Cell",
        formDescription: "Edit the specific content of the cell.",
        fields: [
            { label: 'Cell Content', type: 'textarea', dataKey: 'value' },
            //{ label: 'Cell Description', description: '(Explain this cell\'s purpose to the AI)', type: 'textarea', rows: 4, dataKey: 'cellPrompt' },
        ],
    },
    sheetConfig: {
        formTitle: "Edit Table Properties",
        formDescription: "Set the table's scope, type, and name.",
        fields: [
            /* {
                label: 'Default Save Location', type: 'select', dataKey: 'domain',
                options: [
                    // { value: 'global', text: `<i class="fa-solid fa-earth-asia"></i> Global (This template is stored in user data)` },
                    // { value: 'role', text: `<i class="fa-solid fa-user-tag"></i> Role (This template is stored in the currently selected character)` },
                    { value: 'chat', text: `<i class="fa-solid fa-comment"></i> Chat (This template is stored in the current conversation)` },
                ],
            }, */
            {
                label: 'Type', type: 'select', dataKey: 'type',
                options: [
                    // { value: 'free', text: `<i class="fa-solid fa-table"></i> Free (AI can freely modify this table)` },
                    { value: 'dynamic', text: `<i class="fa-solid fa-arrow-down-wide-short"></i> Dynamic (AI can perform all operations except inserting columns)` },
                    // { value: 'fixed', text: `<i class="fa-solid fa-thumbtack"></i> Fixed (AI cannot delete or insert rows or columns)` },
                    // { value: 'static', text: `<i class="fa-solid fa-link"></i> Static (This table is read-only for AI)` }
                ],
            },
            { label: 'Table Name', type: 'text', dataKey: 'name' },
            { label: 'Table Description (Prompt)', type: 'textarea', rows: 6, dataKey: 'note', description: '(Serves as an overall prompt explaining this table\'s purpose to the AI)' },
            { label: 'Required', type: 'checkbox', dataKey: 'required' },
            { label: 'Trigger Send', type: 'checkbox', dataKey: 'triggerSend', },
            { label: 'Trigger Send Depth', type: 'number', dataKey: 'triggerSendDeep' },
            { label: 'Initialization Prompt', type: 'textarea', rows: 4, dataKey: 'initNode', description: '(When this table is required and empty, this prompt will be sent to urge the AI to fill it)' },
            { label: 'Insert Prompt', type: 'textarea', rows: 4, dataKey: 'insertNode', description: '' },
            { label: 'Delete Prompt', type: 'textarea', rows: 4, dataKey: 'deleteNode', description: '' },
            { label: 'Update Prompt', type: 'textarea', rows: 4, dataKey: 'updateNode', description: '' },
        ],
    },
};


async function updateDropdownElement() {
    const templates = getSheets();
    // console.log("Dropdown templates", templates)
    if (dropdownElement === null) {
        dropdownElement = document.createElement('select');
        dropdownElement.id = 'table_template';
        dropdownElement.classList.add('select2_multi_sameline', 'select2_choice_clickable', 'select2_choice_clickable_buttonstyle');
        dropdownElement.multiple = true;
    }
    dropdownElement.innerHTML = '';
    for (const t of templates) {
        const optionElement = document.createElement('option');
        optionElement.value = t.uid;
        optionElement.textContent = t.name;
        dropdownElement.appendChild(optionElement);
    }

    return dropdownElement;
}

function getAllDropdownOptions() {
    return $(dropdownElement).find('option').toArray().map(option => option.value);
}

function updateSelect2Dropdown() {
    let selectedSheets = getSelectedSheetUids()
    if (selectedSheets === undefined) {
        selectedSheets = [];
    }
    $(dropdownElement).val(selectedSheets).trigger("change", [true])
}

function initChatScopeSelectedSheets() {
    const newSelectedSheets = BASE.sheetsData.context.map(sheet => sheet.enable ? sheet.uid : null).filter(Boolean)
    USER.getContext().chatMetadata.selected_sheets = newSelectedSheets
    return newSelectedSheets
}

function updateSelectedSheetUids() {
    if (scope === 'chat') {
        USER.saveChat()
        console.log("Triggered here")
        BASE.refreshContextView()
    }
    else USER.saveSettings();
    updateDragTables();
}

function initializeSelect2Dropdown(dropdownElement) {
    $(dropdownElement).select2({
        closeOnSelect: false,
        templateResult: function (data) {
            if (!data.id) {
                return data.text;
            }
            var $wrapper = $('<span class="select2-option" style="width: 100%"></span>');
            var $checkbox = $('<input type="checkbox" class="select2-option-checkbox"/>');
            $checkbox.prop('checked', data.selected);
            $wrapper.append(data.text);
            return $wrapper;
        },
        templateSelection: function (data) {
            return data.text;
        },
        escapeMarkup: function (markup) {
            return markup;
        }
    });

    updateSelect2Dropdown()

    $(dropdownElement).on('change', function (e, silent) {
        //if(silent || scope === 'chat') return
        console.log("Selected",silent,$(this).val())
        if (silent) return
        setSelectedSheetUids($(this).val())
        updateSelectedSheetUids()
    });

    // Create association between parent checkbox and dropdown
    const firstOptionText = $(dropdownElement).find('option:first-child').text();
    const tableMultipleSelectionDropdown = $('<span class="select2-option" style="width: 100%"></span>');
    const checkboxForParent = $('<input type="checkbox" class="select2-option-checkbox"/>');
    tableMultipleSelectionDropdown.append(checkboxForParent);
    tableMultipleSelectionDropdown.append(firstOptionText);
    $('#parentFileBox')?.append(tableMultipleSelectionDropdown);

    const select2MultipleSelection = $(dropdownElement).next('.select2-container--default');
    if (select2MultipleSelection.length) {
        select2MultipleSelection.css('width', '100%');
    }
}

function updateSheetStatusBySelect() {
    const selectedSheetsUid = getSelectedSheetUids()
    const templates = getSheets()
    templates.forEach(temp => {
        if (selectedSheetsUid.includes(temp.uid)) temp.enable = true
        else temp.enable = false
        temp.save && temp.save(undefined, true)
    })
}

export function updateSelectBySheetStatus() {
    const templates = getSheets()
    const selectedSheetsUid = templates.filter(temp => temp.enable).map(temp => temp.uid)
    setSelectedSheetUids(selectedSheetsUid)
}

let table_editor_container = null


function bindSheetSetting(sheet, index) {
    const titleBar = document.createElement('div');
    titleBar.className = 'table-title-bar';
    titleBar.style.display = 'flex';
    titleBar.style.alignItems = 'center';
    titleBar.style.minWidth = '500px';
    titleBar.style.gap = '5px';
    titleBar.style.color = 'var(--SmartThemeEmColor)';
    titleBar.style.fontSize = '0.8rem';
    titleBar.style.fontWeight = 'normal';

    // Table basic settings button
    const settingButton = $(`<i class="menu_button menu_button_icon fa-solid fa-wrench" style="cursor: pointer; height: 28px; width: 28px;" title="Edit Table Properties"></i>`);
    settingButton.on('click', async () => {
        const initialData = {
            domain: sheet.domain,
            type: sheet.type,
            name: sheet.name,
            note: sheet.data.note,
            initNode: sheet.data.initNode,
            insertNode: sheet.data.insertNode,
            deleteNode: sheet.data.deleteNode,
            updateNode: sheet.data.updateNode,
            required: sheet.required,
            triggerSend: sheet.triggerSend,
            triggerSendDeep: sheet.triggerSendDeep
        };
        const formInstance = new Form(formConfigs.sheetConfig, initialData);
        const popup = new EDITOR.Popup(formInstance.renderForm(), EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Save", allowVerticalScrolling: true, cancelButton: "Cancel" });

        await popup.show();
        if (popup.result) {
            const diffData = compareDataDiff(formInstance.result(), initialData)
            console.log(diffData)
            let needRerender = false
            // Update the sheet with the data differences
            Object.keys(diffData).forEach(key => {
                console.log(key)
                if (['domain', 'type', 'name', 'required', 'triggerSend'].includes(key) && diffData[key] != null) {
                    console.log("Successfully compared and will update " + key)
                    sheet[key] = diffData[key];
                    if (key === 'name') needRerender = true
                } else if (['note', 'initNode', 'insertNode', 'deleteNode', 'updateNode'].includes(key) && diffData[key] != null) {
                    sheet.data[key] = diffData[key];
                } else if (['triggerSendDeep'].includes(key) && diffData[key] != null) {
                    console.log("Successfully compared and will update " + key)
                    sheet[key] = Math.max(0, Math.floor(diffData[key]));
                }
            })
            sheet.save()
            if (needRerender) refreshTempView()
        }
    });

    // Custom table style button
    const styleButton = $(`<i class="menu_button menu_button_icon fa-solid fa-wand-magic-sparkles" style="cursor: pointer; height: 28px; width: 28px;" title="Edit Table Display Style"></i>`);
    styleButton.on('click', async () => {
        await openSheetStyleRendererPopup(sheet);
    })
    const nameSpan = $(`<span style="margin-left: 0px;">#${index} ${sheet.name ? sheet.name : 'Unnamed Table'}</span>`);

    // New: Checkbox for sending to context
    const sendToContextCheckbox = $(`
        <label class="checkbox_label" style="margin-left: 10px; font-weight: normal; color: var(--text_primary);">
            <input type="checkbox" class="send_to_context_switch" ${sheet.sendToContext !== false ? 'checked' : ''} />
            <span data-i18n="Send to context">Send to context</span>
        </label>
    `);

    sendToContextCheckbox.find('.send_to_context_switch').on('change', function() {
        sheet.sendToContext = $(this).prop('checked');
        sheet.save();
        console.log(`Table "${sheet.name}" sendToContext status updated to: ${sheet.sendToContext}`);
    });

    titleBar.appendChild(settingButton[0]);
    // titleBar.appendChild(originButton[0]);
    titleBar.appendChild(styleButton[0]);
    titleBar.appendChild(nameSpan[0]);
    titleBar.appendChild(sendToContextCheckbox[0]);

    return titleBar;
}

async function templateCellDataEdit(cell) {
    const initialData = { ...cell.data };
    const formInstance = new Form(formConfigs[cell.type], initialData);

    formInstance.on('editRenderStyleEvent', (formData) => {
        alert('Editing table style feature is not yet implemented' + JSON.stringify(formData));
    });


    const popup = new EDITOR.Popup(formInstance.renderForm(), EDITOR.POPUP_TYPE.CONFIRM, { large: true, allowVerticalScrolling: true }, { okButton: "Save Changes", cancelButton: "Cancel" });

    await popup.show();
    if (popup.result) {
        const diffData = compareDataDiff(formInstance.result(), initialData)
        console.log(diffData)
        Object.keys(diffData).forEach(key => {
            cell.data[key] = diffData[key];
        })
        const pos = cell.position
        cell.parent.save()
        cell.renderCell()
        // cell.parent.updateRender()
        refreshTempView(true);
        if (scope === 'chat') BASE.refreshContextView()
    }
}

function handleAction(cell, action) {
    console.log("Starting action execution")
    cell.newAction(action)
    console.log("Action executed, now refreshing")
    refreshTempView();
    // If in chat scope, refresh the table
    if (scope === 'chat') BASE.refreshContextView()
}


function bindCellClickEvent(cell) {
    cell.on('click', async (event) => {
        event.stopPropagation();
        if (cell.parent.currentPopupMenu) {
            cell.parent.currentPopupMenu.destroy();
            cell.parent.currentPopupMenu = null;
        }
        cell.parent.currentPopupMenu = new PopupMenu();

        const [rowIndex, colIndex] = cell.position;
        const sheetType = cell.parent.type;

        if (rowIndex === 0 && colIndex === 0) {
            cell.parent.currentPopupMenu.add('<i class="fa fa-arrow-right"></i> Insert Column Right', (e) => { handleAction(cell, Cell.CellAction.insertRightColumn) });
            if (sheetType === SheetBase.SheetType.free || sheetType === SheetBase.SheetType.static) {
                cell.parent.currentPopupMenu.add('<i class="fa fa-arrow-down"></i> Insert Row Down', (e) => { handleAction(cell, Cell.CellAction.insertDownRow) });
            }
        } else if (rowIndex === 0) {
            cell.parent.currentPopupMenu.add('<i class="fa fa-i-cursor"></i> Edit This Column', async (e) => { await templateCellDataEdit(cell) });
            cell.parent.currentPopupMenu.add('<i class="fa fa-arrow-left"></i> Insert Column Left', (e) => { handleAction(cell, Cell.CellAction.insertLeftColumn) });
            cell.parent.currentPopupMenu.add('<i class="fa fa-arrow-right"></i> Insert Column Right', (e) => { handleAction(cell, Cell.CellAction.insertRightColumn) });
            cell.parent.currentPopupMenu.add('<i class="fa fa-trash-alt"></i> Delete Column', (e) => { handleAction(cell, Cell.CellAction.deleteSelfColumn) });
        } else if (colIndex === 0) {
            // if (sheetType === cell.parent.SheetType.dynamic) {
            //     cell.element.delete();
            //     return;
            // }

            cell.parent.currentPopupMenu.add('<i class="fa fa-i-cursor"></i> Edit This Row', async (e) => { await templateCellDataEdit(cell) });
            if (sheetType === SheetBase.SheetType.free || sheetType === SheetBase.SheetType.static) {
                cell.parent.currentPopupMenu.add('<i class="fa fa-arrow-up"></i> Insert Row Up', (e) => { handleAction(cell, Cell.CellAction.insertUpRow) });
                cell.parent.currentPopupMenu.add('<i class="fa fa-arrow-down"></i> Insert Row Down', (e) => { handleAction(cell, Cell.CellAction.insertDownRow) });
                cell.parent.currentPopupMenu.add('<i class="fa fa-trash-alt"></i> Delete Row', (e) => { handleAction(cell, Cell.CellAction.deleteSelfRow) });
            }
        } else {
            if (sheetType === SheetBase.SheetType.static) {
                cell.parent.currentPopupMenu.add('<i class="fa fa-i-cursor"></i> Edit This Cell', async (e) => { await templateCellDataEdit(cell) });
            } else {
                return;
            }
        }

        const element = event.target
        // Backup current cell style to restore when menu closes
        const style = element.style.cssText;
        const rect = element.getBoundingClientRect();
        const dragSpaceRect = drag.dragSpace.getBoundingClientRect();
        let popupX = rect.left - dragSpaceRect.left;
        let popupY = rect.top - dragSpaceRect.top;
        popupX /= drag.scale;
        popupY /= drag.scale;
        popupY += rect.height / drag.scale + 3;

        element.style.backgroundColor = 'var(--SmartThemeUserMesBlurTintColor)';
        element.style.color = 'var(--SmartThemeQuoteColor)';
        element.style.outline = '1px solid var(--SmartThemeQuoteColor)';
        element.style.zIndex = '999';

        drag.add('menu', cell.parent.currentPopupMenu.renderMenu());
        cell.parent.currentPopupMenu.show(popupX, popupY).then(() => {
            element.style.cssText = style;
        });
    });
}

function getSelectedSheetUids() {
    return scope === 'chat' ? USER.getContext().chatMetadata.selected_sheets ?? initChatScopeSelectedSheets() : USER.getSettings().table_selected_sheets ?? []
}

function setSelectedSheetUids(selectedSheets) {
    if (scope === 'chat') {
        USER.getContext().chatMetadata.selected_sheets = selectedSheets;
    } else {
        USER.getSettings().table_selected_sheets = selectedSheets;
    }
    updateSheetStatusBySelect()
}

function getSheets() {
    return scope === 'chat' ? BASE.getChatSheets() : BASE.templates
}


async function updateDragTables() {
    if (!drag) return;

    const selectedSheetUids = getSelectedSheetUids()
    const container = $(drag.render).find('#tableContainer');
    table_editor_container.querySelector('#contentContainer').style.outlineColor = scope === 'chat' ? '#cf6e64' : '#41b681';

    if (currentPopupMenu) {
        currentPopupMenu.destroy();
        currentPopupMenu = null;
    }

    container.empty();
    console.log("What is dragSpace?", drag.dragSpace)

    selectedSheetUids.forEach((uid, index) => {

        let sheetDataExists;
        if (scope === 'chat') {
            // Check if uid exists in BASE.sheetsData.context
            sheetDataExists = BASE.sheetsData.context?.some(sheetData => sheetData.uid === uid);
        } else {
            // Check if uid exists in BASE.templates
            sheetDataExists = BASE.templates?.some(templateData => templateData.uid === uid);
        }
        // If data doesn't exist, log warning and skip this uid
        if (!sheetDataExists) {
            console.warn(`Table data with UID ${uid} not found in updateDragTables (scope: ${scope}). Skipping this table.`);
            return;
        }

        let sheet = scope === 'chat'
            ? BASE.getChatSheet(uid)
            : new BASE.SheetTemplate(uid);
        sheet.currentPopupMenu = currentPopupMenu;

        // if (!sheet || !sheet.hashSheet) {
        //     console.warn(`Failed to load template or template data is empty, UID: ${uid}`);
        //     return
        // }

        const tableElement = sheet.renderSheet(bindCellClickEvent, sheet.hashSheet.slice(0, 1), NaN);
        tableElement.style.marginLeft = '5px'
        renderedTables.set(uid, tableElement);
        container.append(tableElement);

        // After adding the table, add an hr element
        const hr = document.createElement('hr');
        tableElement.appendChild(hr);

        const captionElement = document.createElement('caption');
        captionElement.appendChild(bindSheetSetting(sheet, index));
        if (tableElement.querySelector('caption')) {
            tableElement.querySelector('caption').replaceWith(captionElement);
        } else {
            tableElement.insertBefore(captionElement, tableElement.firstChild);
        }
    })

}

export function updateTableContainerPosition() {
    const windowHeight = window.innerHeight;
    const contentContainer = table_editor_container.querySelector('#contentContainer');
    // console.log("contentContainer", contentContainer)
    const sendFormHeight = document.querySelector('#send_form')?.getBoundingClientRect().height || 0;
    const rect = contentContainer.getBoundingClientRect();
    // console.log("contentContainer position changed", rect, windowHeight, sendFormHeight)
    contentContainer.style.position = 'flex';
    contentContainer.style.bottom = '0';
    contentContainer.style.left = '0';
    contentContainer.style.width = '100%';
    contentContainer.style.height = `calc(${windowHeight}px - ${rect.top}px - ${sendFormHeight}px)`;
}

export async function refreshTempView(ignoreGlobal = false) {
    if (ignoreGlobal && scope === 'global') return
    console.log("Refreshing table template view")
    await updateDropdownElement()
    initializeSelect2Dropdown(dropdownElement);
    await updateDragTables();
}

async function initTableEdit(mesId) {
    table_editor_container = $(await SYSTEM.getTemplate('sheetTemplateEditor')).get(0);
    const tableEditTips = table_editor_container.querySelector('#tableEditTips');
    const tableContainer = table_editor_container.querySelector('#tableContainer');
    const contentContainer = table_editor_container.querySelector('#contentContainer');
    const scopeSelect = table_editor_container.querySelector('#structure_setting_scope');

    dropdownElement = await updateDropdownElement()
    $(tableEditTips).after(dropdownElement)
    initializeSelect2Dropdown(dropdownElement);

    $(contentContainer).empty()
    drag = new EDITOR.Drag();
    const draggable = drag.render
    contentContainer.append(draggable);
    drag.add('tableContainer', tableContainer);

    // Add event listeners
    contentContainer.addEventListener('mouseenter', updateTableContainerPosition);
    contentContainer.addEventListener('focus', updateTableContainerPosition);

    $(scopeSelect).val(scope).on('change', async function () {
        scope = $(this).val();
        console.log("Switched to", scope)
        await refreshTempView()
    })

    $(document).on('click', '#add_table_template_button', async function () {
        console.log("Triggered")
        let newTemplateUid = null
        let newTemplate = null
        if (scope === 'chat') {
            newTemplate = BASE.createChatSheet(2, 1)
            newTemplateUid = newTemplate.uid
            newTemplate.save()
        } else {
            newTemplate = new BASE.SheetTemplate().createNewTemplate();
            newTemplateUid = newTemplate.uid
        }

        let currentSelectedValues = getSelectedSheetUids()
        setSelectedSheetUids([...currentSelectedValues, newTemplateUid])
        if (scope === 'chat') USER.saveChat()
        else USER.saveSettings();
        await updateDropdownElement();
        //updateDragTables();
        console.log("Test", [...currentSelectedValues, newTemplateUid])
        $(dropdownElement).val([...currentSelectedValues, newTemplateUid]).trigger("change", [true]);
        updateSelectedSheetUids()
    });
    $(document).on('click', '#import_table_template_button', function () {

    })
    $(document).on('click', '#export_table_template_button', function () {

    })
    // $(document).on('click', '#sort_table_template_button', function () {
    //
    // })

    // $(document).on('click', '#table_template_history_button', function () {
    //
    // })
    // $(document).on('click', '#destroy_table_template_button', async function () {
    //     const r = scope ==='chat'? BASE.destroyAllContextSheets() : BASE.destroyAllTemplates()
    //     if (r) {
    //         await updateDropdownElement();
    //         $(dropdownElement).val([]).trigger('change');
    //         updateDragTables();
    //     }
    // });

    updateDragTables();

    return table_editor_container;
}

export async function getEditView(mesId = -1) {
    // If already initialized, return cached container to avoid recreation
    if (table_editor_container) {
        // Update dropdown and tables without recreating the entire container
        await refreshTempView(false);
        return table_editor_container;
    }
    return await initTableEdit(mesId);
}
