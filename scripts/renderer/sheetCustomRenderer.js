import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../../core/manager.js';
let sheet = null;
let config = {};
let selectedCustomStyle = null;

function staticPipeline(target) {
    console.log("Entering static table rendering");
    let regexReplace = selectedCustomStyle.replace || '';
    if (!regexReplace || regexReplace === '') return target?.element || '<div>Table data not loaded</div>';
    if (!target) return regexReplace;

    // New: Handle {{GET::...}} macros
    regexReplace = regexReplace.replace(/{{GET::\s*([^:]+?)\s*:\s*([A-Z]+\d+)\s*}}/g, (match, tableName, cellAddress) => {
        const sheets = BASE.getChatSheets();
        const sheet = sheets.find(s => s.name === tableName);
        if (!sheet) {
            return `<span style="color: red">[GET: Table "${tableName}" not found]</span>`;
        }

        try {
            const cell = sheet.getCellFromAddress(cellAddress);
            const cellValue = cell ? cell.data.value : undefined;
            return cellValue !== undefined ? cellValue : `<span style="color: orange">[GET: Cell "${cellAddress}" not found in table "${tableName}"]</span>`;
        } catch (error) {
            console.error(`Error resolving GET macro for ${tableName}:${cellAddress}`, error);
            return `<span style="color: red">[GET: Error during processing]</span>`;
        }
    });

    // Compatibility with old ##...## syntax
    regexReplace = regexReplace.replace(/##([^:]+):([A-Z]+\d+)##/g, (match, tableName, cellAddress) => {
        const sheets = BASE.getChatSheets();
        const sheet = sheets.find(s => s.name === tableName);
        if (!sheet) {
            return `<span style="color: red">Table not found: ${tableName}</span>`;
        }
        
        const cell = sheet.getCellFromAddress(cellAddress);
        return cell ? (cell.data.value || `?`) :
            `<span style="color: red">Cell not found: ${cellAddress}</span>`;
    });

    // Original processing logic
    return regexReplace.replace(/\$(\w)(\d+)/g, (match, colLetter, rowNumber) => {
        const colIndex = colLetter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        const rowIndex = parseInt(rowNumber);
        console.log("Static render row:", rowIndex, "Static render column:", colIndex);
        const c = target.findCellByPosition(rowIndex, colIndex);
        console.log("Get cell position:", c, '\nGet cell content:', c.data.value);
        return c ? (c.data.value || `<span style="color: red">?</span>`) :
            `<span style="color: red">Cell not found</span>`;
    });
}

/** Extract data values from a sheet instance
 *
 * @param {*} instance - Sheet instance object
 * @returns - 2D array of table data
 */
export function loadValueSheetBySheetHashSheet(instance) {
    if (!instance) return;
    return instance.hashSheet.map(row => row.map(hash => {
        const cell = instance.cells.get(hash);
        return cell ? cell.data.value : '';
    }));
}

function toArray(valueSheet, skipTop) {
    return skipTop ? valueSheet.slice(1) : valueSheet; // New: determine whether to skip header row
}

// Improved compatibility to handle non-2D array cases
/**
 *
 * @param {*table} valueSheet Data-type table
 * @param {*boolean} skipTop Whether to skip the header row
 * @returns HTML-formatted text
 */
function toHtml(valueSheet, skipTop = false) {
    if (!Array.isArray(valueSheet)) {
        return "<table></table>"; // Return empty table
    }

    let html = '<table>';
    let isFirstRow = true;

    for (const row of valueSheet) {
        if (!Array.isArray(row)) {
            continue; // Skip non-array rows
        }

        // If skipTop is true and it's the first row, skip it
        if (skipTop && isFirstRow) {
            isFirstRow = false;
            continue;
        }

        html += '<tr>';
        for (const cell of row) {
            html += `<td>${cell ?? ""}</td>`; // Handle possible undefined/null
        }
        html += '</tr>';

        isFirstRow = false;
    }
    html += '</table>';
    return html;
}

/**
 *
 * @param {*table} valueSheet Data-type table
 * @param {*boolean} skipTop Whether to skip the header row
 * @returns CSV-formatted text
 */
function toCSV(valueSheet, skipTop = false) {
    return skipTop ? valueSheet.slice(1).map(row => row.join(',')).join('\n') : valueSheet.map(row => row.join(',')).join('\n');
}

function toMarkdown(valueSheet) {
    // Convert valueSheet to Markdown table
    let markdown = '| ' + valueSheet[0].join(' | ') + ' |\n';
    markdown += '| ' + valueSheet[0].map(() => '---').join(' | ') + ' |\n';
    for (let i = 1; i < valueSheet.length; i++) {
        markdown += '| ' + valueSheet[i].join(' | ') + ' |\n';
    }
    return markdown;
}

function toJSON(valueSheet) {
    // Convert valueSheet to JSON format
    const columns = valueSheet[0];
    const content = valueSheet.slice(1);
    const json = content.map(row => {
        const obj = {};
        for (let i = 0; i < columns.length; i++) {
            obj[columns[i]] = row[i];
        }
        return obj;
    });
    return JSON.stringify(json, null, 2);
}

/**
 * Use regex to parse table rendering styles
 * @param {Object} instance Table object
 * @param {Object} rendererConfig Rendering configuration
 * @returns {string} Rendered HTML
 */
function regexReplacePipeline(text) {
    if (!text || text === '') return text;
    if (!selectedCustomStyle) return text;

    // Get regex and replace strings from the configuration
    const regexString = selectedCustomStyle.regex || '';
    const replaceString = selectedCustomStyle.replaceDivide || '';
    // console.log("Separated replacement text:", replaceString)
    // If either regex or replace is empty, return the original text
    if (!regexString || regexString === '') return text;

    try {
        // Extract regex pattern and flags
        let regexPattern = regexString;
        let regexFlags = '';

        // Check if the regex string is in format /pattern/flags
        const regexParts = regexString.match(/^\/(.*?)\/([gimuy]*)$/);
        if (regexParts) {
            regexPattern = regexParts[1];
            regexFlags = regexParts[2];
        }

        // Create a new RegExp object
        const regex = new RegExp(regexPattern, regexFlags);

        // Process the replacement string to handle escape sequences
        let processedReplaceString = replaceString
            .replace(/\\n/g, '\n')   // Convert \n to actual newlines
            .replace(/\\t/g, '\t')   // Convert \t to actual tabs
            .replace(/\\r/g, '\r')   // Convert \r to actual carriage returns
            .replace(/\\b/g, '\b')   // Convert \b to actual backspace
            .replace(/\\f/g, '\f')   // Convert \f to actual form feed
            .replace(/\\v/g, '\v')   // Convert \v to actual vertical tab
            .replace(/\\\\/g, '\\'); // Convert \\ to actual backslash

        // Apply the regex replacement first, add loop replacement functionality wrapped in specific tags
        let result = "";
        let cycleReplace = processedReplaceString.match(/<cycleDivide>([\s\S]*?)<\/cycleDivide>/);  // Get loop replacement string

        if (cycleReplace) {
            let cycleReplaceString = cycleReplace[1]; // Without cycleDivide tags
            const cycleReplaceRegex = cycleReplace[0]; // With cycleDivide tags
            // console.log("Entering loop replacement, retrieved loop replacement string:", 'Type:', typeof cycleReplaceString, 'Content:', cycleReplaceString);
            processedReplaceString = processedReplaceString.replace(cycleReplaceRegex, "regexTemporaryString"); // Temporarily replace loop replacement string
            cycleReplaceString = text.replace(regex, cycleReplaceString); // Replace loop string code according to regex
            // console.log("String after loop replacement:", cycleReplaceString);
            result = processedReplaceString.replace("regexTemporaryString", cycleReplaceString);
        } else {
            result = text.replace(regex, processedReplaceString);
            // }
            // Now convert newlines to HTML <br> tags to ensure they display properly in HTML
            if (selectedCustomStyle.basedOn !== 'html' && selectedCustomStyle.basedOn !== 'csv') {  // Add condition: not CSV format text; currently testing shows CSV rendering errors with this code
                result = result.replace(/\n/g, '<br>');
            }
        }
        return result;

    } catch (error) {
        console.error('Error in regex replacement:', error);
        return text; // Return original text on error
    }
}

/**
 * Get the latest plot content
 * @returns {string} - Latest plot content with thinking chains removed via regex
 */
function getLastPlot() {
    const chat = USER.getContext().chat;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].mes != "" && chat[i].is_user == false) {
            const regex1 = "<thinking>[\\s\\S]*?<\/thinking>";
            const regex2 = "Temporarily disabled<tableEdit>[\\s\\S]*?<\/tableEdit>";  // Temporarily not removing tableEdit content to observe effects
            const regex = new RegExp(`${regex1}|${regex2}`, "g")
            return chat[i].mes.replace(regex, '');
        }
    }
}

function triggerValueSheet(valueSheet = [], skipTop, alternateTable) {
    if (!Array.isArray(valueSheet)) {
        return Promise.reject(new Error("valueSheet must be of type array!"));
    }
    const lastchat = getLastPlot();
    let triggerArray = [];
    let i = 0;
    // console.log("Previous chat content lastchat:", lastchat);
    // console.log("valueSheet is:", valueSheet);
    // console.log("First row of valueSheet:", valueSheet[0]);
    // console.log("triggerArray before evaluation:", triggerArray);
    if (!alternateTable && !skipTop) {
        i = 1;
    }
    // console.log("Trigger array triggerArray:", triggerArray, "\ni is:", i);
    for (i; i < valueSheet.length; i++) {
        // console.log("Trigger word is:", valueSheet[i][1], "Type is:", typeof valueSheet[i][1]);
        if (lastchat.includes(valueSheet[i][1])) {
            triggerArray.push(valueSheet[i]);
        }
    }
    return triggerArray;
}

/** Function to initialize textual data, converting table data into specified formats based on requirements.
 *
 * @param {*table} target - Single table object
 * @param {*string} selectedStyle - Format configuration object
 * @returns {*string} - Processed table text
 */
export function initializeText(target, selectedStyle) {
    let initialize = '';
    // console.log("Check what target is:" + target.config.triggerSendToChat); // For debugging, normally disabled
    let valueSheet = target.tableSheet;  // Get table data as a 2D array
    // console.log(target.name, "Initializing text table:", valueSheet);
    // New: Determine whether to trigger sendToChat
    if (target.config.triggerSendToChat) {
        // console.log(target.name + " enabled trigger push" + valueSheet);
        valueSheet = triggerValueSheet(valueSheet, target.config.skipTop, target.config.alternateTable);
        // console.log(target.name + " Is valueSheet an array after retrieval?" + Array.isArray(valueSheet) + "\nWhat is valueSheet after retrieval?" + valueSheet);
    }
    const method = selectedStyle.basedOn || 'array';
    switch (method) {
        case 'array':
            initialize = toArray(valueSheet, target.config.skipTop);
            break;
        case 'html':
            initialize = toHtml(valueSheet, target.config.skipTop);
            break;
        case 'csv':
            initialize = toCSV(valueSheet, target.config.skipTop);
            break;
        case 'markdown':
            initialize = toMarkdown(valueSheet);
            break;
        case 'json':
            initialize = toJSON(valueSheet);
            break;
        default:
            console.error('Unsupported format:', method);
    }
    // console.log('Initialized value:', method, initialize);
    return initialize;
}

/** Pipeline function for handling regex replacement processes
 *
 * @param {Object} target - Single table object
 * @param {Object} rendererConfig Rendering configuration
 * @returns {string} Rendered HTML
 */
function regexPipeline(target, selectedStyle = selectedCustomStyle) {
    const initText = initializeText(target, selectedStyle);  // Initialize text
    // console.log(target.name, "Initialized text:", initText);
    let result = selectedStyle.replace || '';
    // console.log("Length of initialized text", result.length);
    const r = result ? regexReplacePipeline(initText) : initText;  // Display initialized content if no replacement content exists; otherwise perform regex replacement
    // console.log("Result after replacement:", r)
    return r;
}

/** Function to render target elements based on different custom style modes
 *
 * @param {*table} target - Single table, the target object to render, containing the element to be rendered
 * @returns {*Html} Processed HTML string
 */
function executeRendering(target) {
    let resultHtml = target?.element || '<div>Table data not loaded</div>';
    if (config.useCustomStyle === false) {
        // resultHtml = target?.element || '<div>Table data not loaded</div>';
        throw new Error('Custom styles are not enabled. You need to exclude cases where config.useCustomStyle === false outside parseSheetRender.');
    }
    if (selectedCustomStyle.mode === 'regex') {
        resultHtml = regexPipeline(target);
    } else if (selectedCustomStyle.mode === 'simple') {
        resultHtml = staticPipeline(target);
    }
    return resultHtml;
}

/**
 * Parse table rendering styles
 * @param {Object} instance Table object
 * @param {Object} rendererConfig Rendering configuration
 * @returns {string} Rendered HTML
 */
export function parseSheetRender(instance, rendererConfig = undefined) {
    let config;
    if (rendererConfig !== undefined) {
        config = rendererConfig;
    } else {
        // Directly use instance's config
        config = instance.config || {};  // Modified here
    }

    // Add defensive programming
    if (!config.customStyles) {
        config.customStyles = {};
    }
    if (!config.selectedCustomStyleKey) {
        config.selectedCustomStyleKey = 'default'; // Use default custom style
    }

    selectedCustomStyle = config.customStyles[config.selectedCustomStyleKey] || {};

    const r = executeRendering(instance);
    return r;
}
