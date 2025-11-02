// Generate or obtain a device ID (extracted from user code)

function loadFontAwesome() {
    // const fontAwesomeLink = document.createElement('link');
    // fontAwesomeLink.rel = 'stylesheet';
    // fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'; // Replace with Font Awesome CDN link
    // document.head.appendChild(fontAwesomeLink);
}

export function compareDataDiff(target, source) {
    const diff = {};
    for (const key of Object.keys(target)) {
        if (target[key] !== source[key]) {
            diff[key] = target[key];
        }
    }
    return diff;
}

export function compareDataSame(target, source) {
    const same = {};
    for (const key of Object.keys(target)) {
        if (target[key] === source[key]) {
            same[key] = target[key];
        }
    }
}

export function cssColorToRgba(name, opacity = 1) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).replace(')', `, ${opacity})`);
}

/**
 * Create a read-only property
 * @param {object} obj The object on which to define the property
 * @param {string} propertyName The name of the property
 * @param {function} getter The function to retrieve the property value
 */
export function readonly(obj, propertyName, getter) {
    Object.defineProperty(obj, propertyName, {
        get: getter,
        set(value) {
            throw new Error(`${propertyName} property is read-only and cannot be assigned.`);
        }
    });
}

let step = 0;  // Ensure a different random number is absolutely generated on every call
function stepRandom(bias = step) {
    // console.log('stepRandom');
    let r = 100000 / (100000 / Math.random() + bias++);
    return r;
}

/**
 * Generate a random string
 * @description Note: This function is not suitable for security-sensitive scenarios. There is a collision risk when length is less than 12.
 * @description When length = 8, there is a 0.000023% chance (in 1,000,000 experiments) of duplication.
 * @param length
 * @param bias
 * @param characters
 * @returns {string}
 */
export function generateRandomString(length = 12, bias = step, characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(stepRandom(bias) * characters.length));
    }
    return result;
}

/**
 * Generate a random number
 * @description Note: This function is not suitable for security-sensitive scenarios. When length = 8, there is a 0.00005% chance (in 1,000,000 experiments) of duplication.
 * @param length
 * @param forceLength
 * @returns {number}
 */
export function generateRandomNumber(length = 12, forceLength = true) {
    let randomNumber;

    do {
        randomNumber = Math.floor(stepRandom() * Math.pow(10, length));

        // If forced length is required, ensure the generated number meets the requirement
        if (forceLength && randomNumber.toString().length < length) {
            randomNumber *= Math.pow(10, length - randomNumber.toString().length);
        }
    } while (forceLength && randomNumber.toString().length !== length);

    return randomNumber;
}

// Generate a unique ID for encryption purposes
export function generateUid() {
    const rid = `st-${Date.now()}-${generateRandomString(32)}`;
    console.log('Generated unique ID:', rid);
    return rid;
}

export function generateDeviceId() {
    let deviceId = localStorage.getItem('st_device_id') || generateUid();
    if (!localStorage.getItem('st_device_id')) {
        localStorage.setItem('st_device_id', deviceId);
    }
    return deviceId;
}


let antiShakeTimers = {};
/**
 * Debounce function to control execution frequency of an operation
 * @param {string} uid Unique identifier to distinguish different debounce operations
 * @param {number} interval Time interval in milliseconds; only one execution is allowed within this interval
 * @returns {boolean} Returns true if execution is allowed, otherwise false
 */
export function lazy(uid, interval = 100) {
    if (!antiShakeTimers[uid]) {
        antiShakeTimers[uid] = { lastExecutionTime: 0 };
    }
    const timer = antiShakeTimers[uid];
    const currentTime = Date.now();

    if (currentTime - timer.lastExecutionTime < interval) {
        return false; // Interval too short; debounce prevents execution
    }

    timer.lastExecutionTime = currentTime;
    return true; // Execution allowed
}


/**
 * Calculate the MD5 hash of a string using native JavaScript methods
 * @param {string} string The input string to hash
 * @returns {Promise<string>} Returns a Promise resolving to the MD5 hash as a hexadecimal string
 */
export async function calculateStringHash(string) {
    // Check if string is actually a string
    if (typeof string !== 'string') {
        throw new Error('The input value is not a string.');
    }

    // Step 1: Encode the string into a Uint8Array
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(string);

    // Step 2: Use crypto.subtle.digest to compute the hash
    // Suitable only for non-security-sensitive contexts, such as data validation.
    const hashBuffer = await crypto.subtle.digest('MD5', data);

    // Step 3: Convert the ArrayBuffer to a hexadecimal string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map(byte => byte.toString(16).padStart(2, '0')) // Convert each byte to a two-digit hexadecimal string
        .join(''); // Concatenate into a complete hexadecimal string

    return hashHex;
}
