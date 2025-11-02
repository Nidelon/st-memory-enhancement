// _fotTest.js
import { BASE, DERIVED, EDITOR, SYSTEM, USER } from '../core/manager.js';

const TESTING = true;

let codeQueue = [];
/**
 * Adds code to the test queue.
 * @param {Function} code Test function
 * @param {string} [functionName] Function name, optional
 */
export function pushCodeToQueue(code, functionName) {
    codeQueue.push({ func: code, name: functionName });
    if (testTestSidebarEnabled && testSidebarContainer) { // Fixed variable name
        appendTestFunctionButton(testSidebarContainer, codeQueue[codeQueue.length - 1], codeQueue.length - 1);
    }
}

export function initTest() {
    if (!TESTING || !USER.tableBaseSetting.tableDebugModeAble) return;
    if (!testTestSidebarEnabled) openTestSidebar();
}

let testTestSidebarEnabled = false; // Keep original variable name
let testSidebarContainer = null;
let isDragging = false;
let offsetX, offsetY;

function openTestSidebar() {
    testTestSidebarEnabled = true;
    testSidebarContainer = createSidebarContainer();
    testSidebarContainer.appendChild(createToolBar());
    loadAndAppendTestContent(testSidebarContainer);

    addDragListeners();
    window.addEventListener('resize', handleWindowResize);
    document.body.appendChild(testSidebarContainer);

    adjustSidebarPositionWithinBounds();
}

async function testingProcess() {
    if (codeQueue.length === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] No code registered; cannot execute. Please register test code using SYSTEM.f(()=>{code to test}, 'function name').`);
        return;
    }

    const startTime = performance.now();

    console.log(`%c[${new Date().toLocaleTimeString()}] START [SYSTEM.f()...`, 'color: blue; font-weight: bold');
    for (const codeObject of codeQueue) {
        const func = codeObject.func;
        const functionName = codeObject.name; // Get function name
        const startTimeI = performance.now();
        const index = codeQueue.indexOf(codeObject);
        try {
            await func();
            console.log(`%c[${new Date().toLocaleTimeString()}] ${functionName || `f[${index}]`} END (Time: ${(performance.now() - startTimeI).toFixed(2)}ms)`, 'color: green'); // Keep function name and timing output
        } catch (error) {
            console.error(`%c[${new Date().toLocaleTimeString()}] ${functionName || `f[${index}]`} ERROR:`, 'color: red; font-weight: bold', error); // Keep function name output
        }
    }

    const endTime = performance.now();
    const elapsedTime = endTime - startTime;

    console.log(`%c[${new Date().toLocaleTimeString()}] SYSTEM.f()] END (Total time: ${elapsedTime.toFixed(2)}ms)`, 'color: green; font-weight: bold');
}

function createSidebarContainer() {
    const container = document.createElement('div');
    container.id = 'test-floating-sidebar';
    Object.assign(container.style, {
        position: 'fixed',
        top: '200px',
        right: '20px',
        backgroundColor: '#c11',
        maxWidth: '100px',
        padding: '2px',
        zIndex: '999',
        borderRadius: '5px',
        cursor: 'move',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ccc',
        userSelect: 'none',
        border: '1px solid #555',
        boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.3)',
    });
    container.classList.add('popup');
    return container;
}

function createToolBar() {
    const toolBar = document.createElement('div');
    toolBar.id = 'test_tool_bar';
    Object.assign(toolBar.style, {
        display: 'flex',
        justifyContent: 'space-around',
        padding: '2px 0',
        marginBottom: '2px',
        borderBottom: '1px solid #555'
    });

    const retryButton = createToolButton('<i class="fa-solid fa-repeat"></i>', async (event) => { // Use Font Awesome icon, and add hidden text
        event.stopPropagation();
        if (confirm('This will sequentially execute all code registered in the test queue. Continue?')) {
            await reloadTestContent();
        } else {

        }
    });
    toolBar.appendChild(retryButton);

    const logButton = createToolButton('<i class="fa-solid fa-database"></i>', (event) => { // Use Font Awesome icon, and add hidden text
        event.stopPropagation();
        EDITOR.logAll();
    });
    toolBar.appendChild(logButton);

    return toolBar;
}

function createToolButton(innerHTML, onClickHandler) { // Changed parameter from 'text' to 'innerHTML'
    const button = document.createElement('button');
    button.innerHTML = innerHTML; // Use innerHTML
    Object.assign(button.style, {
        background: 'none',
        border: '2px solid #a00',
        cursor: 'pointer',
        color: '#eee',
        margin: '1px',
        padding: '2px 5px',
        fontSize: '10px',
        borderRadius: '3px',
        display: 'flex', // Allows button contents to use flex layout for icon-text alignment
        alignItems: 'center', // Vertically center
        justifyContent: 'center' // Horizontally center
    });
    // Add hover effect
    button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#a00';
    });
    button.addEventListener('mouseout', () => {
        button.style.backgroundColor = 'transparent'; // or 'none'
    });

    const icon = button.querySelector('i'); // Select icon inside button and set its style
    if (icon) {
        Object.assign(icon.style, {
            marginRight: '0px', // Spacing between icon and text
            fontSize: '12px' // Icon size
        });
    }

    button.onclick = onClickHandler;
    return button;
}

/**
 * Loads and appends test content to the container.
 * @param {HTMLElement} container Container element
 */
function loadAndAppendTestContent(container) {
    if (codeQueue.length === 0) {
        appendTestOutput(container, 'SYSTEM.f(()=>{add test code}, "function name")');
        return;
    }

    codeQueue.forEach((codeObject, index) => {
        appendTestFunctionButton(container, codeObject, index);
    });
}

/**
 * Creates and appends an execution button for a single test function to the container.
 * @param {HTMLElement} container Container element
 * @param {object} codeObject Object containing the test function and its name { func: Function, name: string }
 * @param {number} index Index of the function in the queue
 */
function appendTestFunctionButton(container, codeObject, index) {
    const functionContainer = document.createElement('div');
    functionContainer.style.marginBottom = '2px';
    functionContainer.style.display = 'flex';
    functionContainer.style.alignItems = 'center';
    functionContainer.style.borderBottom = '1px dashed #555';
    functionContainer.style.paddingBottom = '2px';
    functionContainer.style.justifyContent = 'space-between';

    const functionLabel = document.createElement('pre');
    functionLabel.innerText = codeObject.name || `f[${index}]`;
    functionLabel.style.margin = '0';
    functionLabel.style.marginRight = '5px';
    functionContainer.appendChild(functionLabel);

    const runButton = createToolButton(`<i class="fas fa-play"></i>`, async (event) => { // Add Font Awesome icon and hide text
        event.stopPropagation();
        const startTimeI = performance.now();
        const functionName = codeObject.name;
        try {
            console.log(`%c[${new Date().toLocaleTimeString()}] ${functionName || `f[${index}]`} START`, 'color: blue; font-weight: bold');
            await codeObject.func();
            // Also display "END" message in bold
            console.log(`%c[${new Date().toLocaleTimeString()}] ${functionName || `f[${index}]`} END (Time: ${(performance.now() - startTimeI).toFixed(2)}ms)`, 'color: green; font-weight: bold');
        } catch (error) {
            console.error(`%c[${new Date().toLocaleTimeString()}] ${functionName || `f[${index}]`} ERROR:`, 'color: red; font-weight: bold', error);
            console.error(error);
        }
    });
    runButton.style.padding = '2px'; // Adjust runButton padding
    runButton.style.minWidth = 'auto'; // Remove minimum width constraint to make the button fit the icon better
    functionContainer.appendChild(runButton);
    container.appendChild(functionContainer);
}

async function reloadTestContent() {
    if (!testSidebarContainer) return;

    while (testSidebarContainer.children.length > 1) {
        testSidebarContainer.removeChild(testSidebarContainer.lastChild);
    }

    await loadAndAppendTestContent(testSidebarContainer);
    await testingProcess();
}

function appendTestOutput(container, outputText) {
    const outputElement = document.createElement('pre');
    outputElement.innerText = outputText;
    outputElement.style.fontSize = '10px';
    outputElement.style.margin = '0';
    outputElement.style.padding = '2px 5px';
    outputElement.style.backgroundColor = '#222';
    outputElement.style.borderRadius = '3px';
}

function addDragListeners() {
    testSidebarContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
}

function removeDragListeners() {
    testSidebarContainer.removeEventListener('mousedown', dragStart);
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    window.removeEventListener('resize', handleWindowResize);
}

function dragStart(e) {
    isDragging = true;
    offsetX = e.clientX - testSidebarContainer.offsetLeft;
    offsetY = e.clientY - testSidebarContainer.offsetTop;
}

function dragMove(e) {
    if (!isDragging) return;
    adjustSidebarPositionWithinBounds(e.clientX - offsetX, e.clientY - offsetY);
}

function dragEnd() {
    isDragging = false;
}

function handleWindowResize() {
    adjustSidebarPositionWithinBounds();
}

function adjustSidebarPositionWithinBounds(inputX, inputY) {
    let newX = inputX !== undefined ? inputX : testSidebarContainer.offsetLeft;
    let newY = inputY !== undefined ? inputY : testSidebarContainer.offsetTop;
    let boundedX = Math.max(0, Math.min(newX, window.innerWidth - testSidebarContainer.offsetWidth));
    let boundedY = Math.max(0, Math.min(newY, window.innerHeight - testSidebarContainer.offsetHeight));

    testSidebarContainer.style.left = boundedX + 'px';
    testSidebarContainer.style.top = boundedY + 'px';
}
