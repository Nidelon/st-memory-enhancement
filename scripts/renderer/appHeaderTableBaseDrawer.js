import {DERIVED, EDITOR, SYSTEM, USER} from "../../core/manager.js";
import {getChatSheetsView} from "../editor/chatSheetsDataView.js";
import {getEditView, updateTableContainerPosition} from "../editor/tableTemplateEditView.js";

// Global variable definitions (unchanged)
let tableDrawer = null;
let tableDrawerIcon = null;
let tableDrawerContent = null;
let appHeaderTableContainer = null;
let databaseButton = null;
let editorButton = null;
let settingButton = null;
let inlineDrawerHeaderContent = null;
let tableDrawerContentHeader = null;

let tableViewDom = null;
let tableEditDom = null;
let settingContainer = null;

// New: Cache jQuery objects for content containers
let databaseContentDiv = null;
let editorContentDiv = null;
let settingContentDiv = null;

const timeOut = 200;
const easing = 'easeInOutCubic';

let isEventListenersBound = false;
let currentActiveButton = null; // Track currently active button

/**
 * Update button selection states (unchanged)
 * @param {jQuery} selectedButton The currently selected button
 */
function updateButtonStates(selectedButton) {
    if (currentActiveButton && currentActiveButton.is(selectedButton)) {
        return false;
    }
    databaseButton.css('opacity', '0.5');
    editorButton.css('opacity', '0.5');
    settingButton.css('opacity', '0.5');
    selectedButton.css('opacity', '1');
    currentActiveButton = selectedButton;
    return true;
}

/**
 * Initialize the application header table drawer (called only once)
 */
export async function initAppHeaderTableDrawer() {
    if (isEventListenersBound) {
        return;
    }

    // DOM element selection (executed only once)
    tableDrawer = $('#table_database_settings_drawer');
    tableDrawerIcon = $('#table_drawer_icon');
    tableDrawerContent = $('#table_drawer_content');
    appHeaderTableContainer = $('#app_header_table_container');
    databaseButton = $('#database_button');
    editorButton = $('#editor_button');
    settingButton = $('#setting_button');
    inlineDrawerHeaderContent = $('#inline_drawer_header_content');
    tableDrawerContentHeader = $('#table_drawer_content_header');

    // DOM modification (executed only once)
    $('.fa-panorama').removeClass('fa-panorama').addClass('fa-image');
    $('.fa-user-cog').removeClass('fa-user-cog').addClass('fa-user');

    // Asynchronously fetch content (executed only once)
    if (tableViewDom === null) {
        tableViewDom = await getChatSheetsView(-1);
    }
    if (tableEditDom === null) {
        tableEditDom = $(`<div style=""></div>`);
        tableEditDom.append(await getEditView(-1));
    }
    if (settingContainer === null) {
        const header = $(`<div></div>`).append($(`<div style="margin: 10px 0;"></div>`).append(inlineDrawerHeaderContent));
        settingContainer = header.append($('.memory_enhancement_container').find('#memory_enhancement_settings_inline_drawer_content'));
    }

    // Create container divs and wrap content inside (executed only once)
    // **** Modification: Cache jQuery objects at creation time ****
    databaseContentDiv = $(`<div id="database-content" style="width: 100%; height: 100%; overflow: hidden;"></div>`).append(tableViewDom);
    editorContentDiv = $(`<div id="editor-content" style="width: 100%; height: 100%; display: none; overflow: hidden;"></div>`).append(tableEditDom);
    settingContentDiv = $(`<div id="setting-content" style="width: 100%; height: 100%; display: none; overflow: hidden;"></div>`).append(settingContainer);

    // Append all content containers into appHeaderTableContainer (executed only once)
    appHeaderTableContainer.append(databaseContentDiv);
    appHeaderTableContainer.append(editorContentDiv);
    appHeaderTableContainer.append(settingContentDiv);

    // Initialize button states (executed only once)
    updateButtonStates(databaseButton);

    $('#tableUpdateTag').click(function() {
        $('#extensions_details').trigger('click');
    });

    // **** Modification: Button click events now call the new switchContent function ****
    databaseButton.on('click', function() {
        if (updateButtonStates(databaseButton)) {
            switchContent(databaseContentDiv); // Pass cached jQuery object
        }
    });

    editorButton.on('click', function() {
        if (updateButtonStates(editorButton)) {
            switchContent(editorContentDiv); // Pass cached jQuery object
            // updateTableContainerPosition();
        }
    });

    settingButton.on('click', function() {
        if (updateButtonStates(settingButton)) {
            switchContent(settingContentDiv); // Pass cached jQuery object
        }
    });

    isEventListenersBound = true;

    // Remove legacy elements (executed only once)
    $('.memory_enhancement_container').remove();
}

/**
 * Open/close the application header table drawer (unchanged)
 */
export async function openAppHeaderTableDrawer(target = undefined) {
    if (!isEventListenersBound) {
        await initAppHeaderTableDrawer();
    }

    // If target is the settings button, directly open the settings drawer
    if (tableDrawerIcon.hasClass('closedIcon')) {
        // Close other drawers
        $('.openDrawer').not('#table_drawer_content').not('.pinnedOpen').addClass('resizing').each((_, el) => {
            EDITOR.slideToggle(el, {
                ...EDITOR.getSlideToggleOptions(),
                onAnimationEnd: function (el) {
                    el.closest('.drawer-content').classList.remove('resizing');
                },
            });
        });
        $('.openIcon').not('#table_drawer_icon').not('.drawerPinnedOpen').toggleClass('closedIcon openIcon');
        $('.openDrawer').not('#table_drawer_content').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');

        // Open current drawer
        tableDrawerIcon.toggleClass('closedIcon openIcon');
        tableDrawerContent.toggleClass('closedDrawer openDrawer');

        tableDrawerContent.addClass('resizing').each((_, el) => {
            EDITOR.slideToggle(el, {
                ...EDITOR.getSlideToggleOptions(),
                onAnimationEnd: function (el) {
                    el.closest('.drawer-content').classList.remove('resizing');
                },
            });
        });

        if (target) {
            // If target is settings button, directly open settings drawer
            if (target === 'database') {
                databaseButton.trigger('click');
            } else if (target === 'setting') {
                settingButton.trigger('click');
            } else if (target === 'editor') {
                editorButton.trigger('click');
            }
        }
    } else {
        // Close current drawer
        tableDrawerIcon.toggleClass('openIcon closedIcon');
        tableDrawerContent.toggleClass('openDrawer closedDrawer');

        tableDrawerContent.addClass('resizing').each((_, el) => {
            EDITOR.slideToggle(el, {
                ...EDITOR.getSlideToggleOptions(),
                onAnimationEnd: function (el) {
                    el.closest('.drawer-content').classList.remove('resizing');
                },
            });
        });
    }
}

/**
 * **** New: Generic content-switching function ****
 * @param {jQuery} targetContent jQuery object of the target content to display
 */
async function switchContent(targetContent) {
    // **** Modification: Directly use :visible pseudo-selector or maintain a variable tracking the currently visible element ****
    // Using :visible still requires querying, but is better than filtering all children
    // Alternatively, maintain a variable tracking the currently visible div to avoid DOM queries
    const currentContent = appHeaderTableContainer.children(':visible');

    // If the target content is already displayed, do nothing (updateButtonStates handles this in theory, but extra safety check added)
    if (currentContent.is(targetContent)) {
        return;
    }

    // Stop any currently running animations (to handle rapid user clicks)
    currentContent.stop(true, false); // Clear animation queue, do not jump to animation end
    targetContent.stop(true, false);  // Clear animation queue, do not jump to animation end

    if (currentContent.length > 0) {
        // **** Modification: Simplify animation chain, remove .delay().hide(0) ****
        // slideUp automatically sets display: none upon animation completion
        currentContent.slideUp({
            duration: timeOut,
            easing: easing,
            // queue: false // Consider disabling queuing if overlapping visual effects are acceptable
        });
    }

    // Use slideDown to show target content
    targetContent.slideDown({
        duration: timeOut,
        easing: easing,
        // queue: false
    });
}
