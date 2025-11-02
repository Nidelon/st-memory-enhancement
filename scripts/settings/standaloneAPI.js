// standaloneAPI.js
import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../../core/manager.js';
import LLMApiService from "../../services/llmApi.js";
import {PopupConfirm} from "../../components/popupConfirm.js";

let loadingToast = null;
let currentApiKeyIndex = 0; // Used to track the index of the currently used API Key


/**
 * Encrypt
 * @param {*} rawKey - Raw key
 * @param {*} deviceId - Device ID
 * @returns {string} Encrypted string
 */
export function encryptXor(rawKey, deviceId) {
    // Handle multiple comma-separated API Keys
    const keys = rawKey.split(',').map(k => k.trim()).filter(k => k.trim().length > 0);
    const uniqueKeys = [...new Set(keys)];
    const uniqueKeyString = uniqueKeys.join(',');

    // If duplicate keys exist, return deduplicated count and encrypted key
    if (keys.length !== uniqueKeys.length) {
        return {
            encrypted: Array.from(uniqueKeyString).map((c, i) =>
                c.charCodeAt(0) ^ deviceId.charCodeAt(i % deviceId.length)
            ).map(c => c.toString(16).padStart(2, '0')).join(''),
            duplicatesRemoved: keys.length - uniqueKeys.length
        };
    }

    // Return encrypted result directly if no duplicates
    return Array.from(uniqueKeyString).map((c, i) =>
        c.charCodeAt(0) ^ deviceId.charCodeAt(i % deviceId.length)
    ).map(c => c.toString(16).padStart(2, '0')).join('');
}

export function processApiKey(rawKey, deviceId) {
    try {
        const keys = rawKey.split(',').map(k => k.trim()).filter(k => k.trim().length > 0);
        const invalidKeysCount = rawKey.split(',').length - keys.length; // Count invalid keys
        const encryptedResult = encryptXor(rawKey, deviceId);
        const totalKeys = rawKey.split(',').length;
        const remainingKeys = totalKeys - (encryptedResult.duplicatesRemoved || 0); // Number of keys after removing invalid and duplicates

        let message = `API Key updated, total of ${remainingKeys} keys`;
        if(totalKeys - remainingKeys > 0 || invalidKeysCount > 0){
            const removedParts = [];
            if (totalKeys - remainingKeys > 0) removedParts.push(`${totalKeys - remainingKeys} duplicate keys`);
            if (invalidKeysCount > 0) removedParts.push(`${invalidKeysCount} empty values`);
            message += ` (removed ${removedParts.join(', ')})`;
        }
        return {
            encryptedResult,
            encrypted: encryptedResult.encrypted,
            duplicatesRemoved: encryptedResult.duplicatesRemoved,
            invalidKeysCount: invalidKeysCount,
            remainingKeys: remainingKeys,
            totalKeys: totalKeys,
            message: message,
        }
    } catch (error) {
        console.error('API Key processing failed:', error);
        throw error;
    }
}


/**
 * Decrypt API KEY
 * @returns {Promise<string|null>} Decrypted API key
 */
export async function getDecryptedApiKey() { // Export this function
    try {
        const encrypted = USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_key;
        const deviceId = localStorage.getItem('st_device_id');
        if (!encrypted || !deviceId) return null;

        return await decryptXor(encrypted, deviceId);
    } catch (error) {
        console.error('API Key decryption failed:', error);
        return null;
    }
}

/**
 * Decrypt
 * @param {string} encrypted - Encrypted string
 * @param {string} deviceId - Device ID
 * @returns {string|null} Decrypted string, or null if decryption fails
 */
async function decryptXor(encrypted, deviceId) {
    try {
        const bytes = encrypted.match(/.{1,2}/g).map(b =>
            parseInt(b, 16)
        );
        return String.fromCharCode(...bytes.map((b, i) =>
            b ^ deviceId.charCodeAt(i % deviceId.length)
        ));
    } catch(e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

async function createLoadingToast(isUseMainAPI = true, isSilent = false) {
    if (isSilent) {
        // In silent mode, do not show popup, simulate "continue in background"
        // Return false, as the "continue in background" button (cancelBtn) in PopupConfirm returns false
        return Promise.resolve(false);
    }
    loadingToast?.close()
    loadingToast = new PopupConfirm();
    return await loadingToast.show(
        isUseMainAPI
            ? 'Regenerating full table using [Main API]...'
            : 'Regenerating full table using [Custom API]...',
        'Continue in background',
        'Abort',
    )
}

/** Main API call
 * @param {string|Array<object>} systemPrompt - System prompt or array of messages
 * @param {string} [userPrompt] - User prompt (ignored if first parameter is an array)
 * @param {boolean} [isSilent=false] - Whether to run silently without showing loading indicator
 * @returns {Promise<string>} Generated response content
 */
export async function handleMainAPIRequest(systemPrompt, userPrompt, isSilent = false) {
    let finalSystemPrompt = '';
    let finalUserPrompt = '';
    let suspended = false; // Define suspended outside the blocks

    if (Array.isArray(systemPrompt)) {
        // --- Start: Processing for array input ---
        const messages = systemPrompt; // messages is defined here now

        // Loading toast logic
        createLoadingToast(true, isSilent).then((r) => {
            if (loadingToast) loadingToast.close();
            suspended = r; // Assign to the outer suspended variable
        });

        let startTime = Date.now();
        if (loadingToast) {
            loadingToast.frameUpdate(() => {
                if (loadingToast) {
                    loadingToast.text = `Regenerating full table using [Main API] (multi-message): ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
                }
            });
        }

        console.log('Multi-message array for Main API request:', messages); // Log the actual array
        // Use TavernHelper.generateRaw with the array, enabling streaming

        if(!TavernHelper) throw new Error("TavernHelper is not installed. Summary feature depends on the TavernHelper plugin. Please install and refresh.");

        const response = await TavernHelper.generateRaw({
            ordered_prompts: messages, // Pass the array directly
            should_stream: true,      // Re-enable streaming
        });
        loadingToast.close();
        return suspended ? 'suspended' : response;
        // --- End: Processing for array input ---

    } else { // Correctly placed ELSE block
        // --- Start: Original logic for non-array input ---
        finalSystemPrompt = systemPrompt;
        finalUserPrompt = userPrompt;

        createLoadingToast(true, isSilent).then((r) => {
            if (loadingToast) loadingToast.close();
            suspended = r; // Assign to the outer suspended variable
        });

        let startTime = Date.now();
        if (loadingToast) {
            loadingToast.frameUpdate(() => {
                if (loadingToast) {
                    loadingToast.text = `Regenerating full table using [Main API]: ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
                }
            });
        }

        // Use EDITOR.generateRaw for non-array input
        const response = await EDITOR.generateRaw(
            finalUserPrompt,
            '',
            false,
            false,
            finalSystemPrompt,
        );
        loadingToast.close();
        return suspended ? 'suspended' : response;
        // --- End: Original logic ---
    }
} // Correct closing brace for the function

/**
 * Handle API test request, including getting input, decrypting keys, calling test function, and returning results.
 * @param {string} apiUrl - API URL.
 * @param {string} encryptedApiKeys - Encrypted API key string.
 * @param {string} modelName - Model name.
 * @returns {Promise<Array<{keyIndex: number, success: boolean, error?: string}>>} Test results array.
 */
export async function handleApiTestRequest(apiUrl, encryptedApiKeys, modelName) {
    if (!apiUrl || !encryptedApiKeys) {
        EDITOR.error('Please fill in both API URL and API Key.');
        return []; // Return empty array on initial validation failure
    }

    const decryptedApiKeysString = await getDecryptedApiKey(); // Use imported function
    if (!decryptedApiKeysString) {
        EDITOR.error('API Key decryption failed or not set!');
        return []; // Return empty array on decryption failure
    }

    const apiKeys = decryptedApiKeysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (apiKeys.length === 0) {
        EDITOR.error('No valid API Keys found.');
        return []; // Return empty array if no valid keys found
    }
    const testAll = await EDITOR.callGenericPopup(`Detected ${apiKeys.length} API Keys.\nNote: The test method is identical to Tavern's built-in test and will send one message (very few tokens). If you're using a pay-per-call API, please monitor your usage.`, EDITOR.POPUP_TYPE.CONFIRM, '', { okButton: "Test first key", cancelButton: "Cancel" });
    let keysToTest = [];
    if (testAll === null) return []; // User canceled popup, return empty array

    if (testAll) {
        keysToTest = [apiKeys[0]];
        EDITOR.info(`Starting test for key ${keysToTest.length}...`);
    } else {
        return []; // User clicked cancel, return empty array
    }
    //！！~~~Keep multi-key testing capability, but currently only test the first key~~~！！
    try {
        // Call test function
        const results = await testApiConnection(apiUrl, keysToTest, modelName);

        // Process results and show notification messages
        if (results && results.length > 0) {
            EDITOR.clear(); // Clear previous 'Starting test for key x...' notification
            let successCount = 0;
            let failureCount = 0;
            results.forEach(result => {
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                    // Log detailed error, using original key index if available
                    console.error(`Key ${result.keyIndex !== undefined ? result.keyIndex + 1 : '?'} test failed: ${result.error}`);
                }
            });

            if (failureCount > 0) {
                EDITOR.error(`${failureCount} key(s) failed testing. Please check console for details.`);
                EDITOR.error(`API endpoint: ${apiUrl}`);
                EDITOR.error(`Error details: ${results.find(r => !r.success)?.error || 'Unknown error'}`);
            }
            if (successCount > 0) {
                EDITOR.success(`${successCount} key(s) tested successfully!`);
            }
        } else if (results) {
            // Handle case where testApiConnection might return empty array (e.g., user canceled)
        }

        return results; // Return results array
    } catch (error) {
        EDITOR.error(`Error during API testing`, error.message, error);
        console.error("API Test Error:", error);
        // Return array indicating all test keys failed in case of general error
        return keysToTest.map((_, index) => ({
            keyIndex: apiKeys.indexOf(keysToTest[index]), // Find original index if needed
            success: false,
            error: `Error during testing: ${error.message}`
        }));
    }
}

/**
 * Test API connection
 * @param {string} apiUrl - API URL
 * @param {string[]} apiKeys - Array of API keys
 * @param {string} modelName - Model name
 * @returns {Promise<Array<{keyIndex: number, success: boolean, error?: string}>>} Test results array
 */
export async function testApiConnection(apiUrl, apiKeys, modelName) {
    const results = [];
    const testPrompt = "Say 'test'"; // Test case

    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        console.log(`Testing API Key index: ${i}`);
        try {
            const llmService = new LLMApiService({
                api_url: apiUrl,
                api_key: apiKey,
                model_name: modelName || 'gpt-3.5-turbo', // Use user-configured model name
                system_prompt: 'You are a test assistant.',
                temperature: 0.1 // Use user-configured temperature
            });

            // Call API
            const response = await llmService.callLLM(testPrompt);

            if (response && typeof response === 'string') {
                console.log(`API Key index ${i} test successful. Response: ${response}`);
                results.push({ keyIndex: i, success: true });
            } else {
                throw new Error('Invalid or empty response received.');
            }
        } catch (error) {
            console.error(`API Key index ${i} test failed (raw error object):`, error); // Log the raw error object
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && typeof error.toString === 'function') {
                errorMessage = error.toString();
            }
            results.push({ keyIndex: i, success: false, error: errorMessage });
        }
    }
    return results;
}

/** Custom API call
 * @param {string|Array<object>} systemPrompt - System prompt or array of messages
 * @param {string} [userPrompt] - User prompt (ignored if first parameter is an array)
 * @param {boolean} [isStepByStepSummary=false] - Whether in step-by-step summary mode, used to control streaming
 * @param {boolean} [isSilent=false] - Whether to run silently without showing loading indicator
 * @returns {Promise<string>} Generated response content
 */
export async function handleCustomAPIRequest(systemPrompt, userPrompt, isStepByStepSummary = false, isSilent = false) {
    const USER_API_URL = USER.IMPORTANT_USER_PRIVACY_DATA.custom_api_url;
    const decryptedApiKeysString = await getDecryptedApiKey(); // Get comma-separated key string
    const USER_API_MODEL = USER.IMPORTANT_USER_PRIVACY_DATA.custom_model_name;
    // const MAX_RETRIES = USER.tableBaseSetting.custom_api_retries ?? 0; // Get retry count from settings, default to 0
    const MAX_RETRIES = 0; // Get retry count from settings, default to 0

    if (!USER_API_URL || !USER_API_MODEL) {
        EDITOR.error('Please complete custom API configuration (URL and model)');
        return;
    }

    if (!decryptedApiKeysString) {
        EDITOR.error('API key decryption failed or not set. Please check API key settings!');
        return;
    }

    const apiKeys = decryptedApiKeysString.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKeys.length === 0) {
        EDITOR.error('No valid API Keys found. Please check your input.');
        return;
    }

    let suspended = false;
    createLoadingToast(false, isSilent).then((r) => {
        if (loadingToast) loadingToast.close();
        suspended = r;
    })

    const totalKeys = apiKeys.length;
    const attempts = MAX_RETRIES === 0 ? totalKeys : Math.min(MAX_RETRIES, totalKeys);
    let lastError = null;

    for (let i = 0; i < attempts; i++) {
        if (suspended) break; // Check if user aborted operation

        const keyIndexToTry = currentApiKeyIndex % totalKeys;
        const currentApiKey = apiKeys[keyIndexToTry];
        currentApiKeyIndex++; // Move to next key for next overall request

        console.log(`Attempting API call with API key index: ${keyIndexToTry}`);
        if (loadingToast) {
            loadingToast.text = `Trying custom API Key ${keyIndexToTry + 1}/${totalKeys}...`;
        }

        try { // Outer try for the whole attempt with the current key
            const promptData = Array.isArray(systemPrompt) ? systemPrompt : userPrompt;
            let response; // Declare response variable

            // --- ALWAYS Use llmService ---
            console.log(`Custom API: Using llmService.callLLM (input type: ${Array.isArray(promptData) ? 'multi-message array' : 'single message'})`);
            if (loadingToast) {
                loadingToast.text = `Using custom API Key ${keyIndexToTry + 1}/${totalKeys} (llmService)...`;
            }

            const llmService = new LLMApiService({
                api_url: USER_API_URL,
                api_key: currentApiKey,
                model_name: USER_API_MODEL,
                // Pass empty system_prompt if promptData is array, otherwise pass the original systemPrompt string
                system_prompt: Array.isArray(promptData) ? "" : systemPrompt,
                temperature: USER.tableBaseSetting.custom_temperature,
                table_proxy_address: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address,
                table_proxy_key: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key
            });

            const streamCallback = (chunk) => {
                if (loadingToast) {
                    const modeText = isStepByStepSummary ? "(step-by-step)" : ""; // isStepByStepSummary might be useful here still
                    loadingToast.text = `Generating with Key ${keyIndexToTry + 1}${modeText}: ${chunk}`;
                }
            };

            try {
                // Pass promptData (which could be string or array) to callLLM
                response = await llmService.callLLM(promptData, streamCallback);
                console.log(`Request successful (llmService, key index: ${keyIndexToTry}):`, response);
                loadingToast?.close();
                return suspended ? 'suspended' : response; // Success, return immediately
            } catch (llmServiceError) {
                // llmService failed, log error and continue loop
                console.error(`API call failed (llmService), key index ${keyIndexToTry}:`, llmServiceError);
                lastError = llmServiceError;
                EDITOR.error(`Call with Key ${keyIndexToTry + 1} failed (llmService): ${llmServiceError.message || 'Unknown error'}`);
                // Let the loop continue to the next key
            }
            // If code reaches here, the llmService call failed for this key

        } catch (error) { // This catch should ideally not be reached due to inner try/catch
            console.error(`Unexpected error while processing key index ${keyIndexToTry}:`, error);
            lastError = error;
            EDITOR.error(`Unexpected error while processing Key ${keyIndexToTry + 1}`, error.message || 'Unknown error', error);
        }
    }

    // All attempts failed
    loadingToast?.close();
    if (suspended) {
        EDITOR.warning('Operation was aborted by user.');
        return 'suspended';
    }

    const errorMessage = `All ${attempts} attempts failed. Last error: ${lastError?.message || 'Unknown error'}`;
    EDITOR.error(errorMessage, "", lastError);
    console.error('All API call attempts failed.', lastError);
    return `Error: ${errorMessage}`; // Return a clear error string

    // // Common request configuration (Commented out original code remains unchanged)
    // const requestConfig = {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Bearer ${USER_API_KEY}`
    //     },
    //     body: JSON.stringify({
    //         model: USER_API_MODEL,
    //         messages: [
    //             { role: "system", content: systemPrompt },
    //             { role: "user", content: userPrompt }
    //         ],
    //         temperature: USER.tableBaseSetting.custom_temperature
    //     })
    // };
    //
    // // Generic request function
    // const makeRequest = async (url) => {
    //     const response = await fetch(url, requestConfig);
    //     if (!response.ok) {
    //         const errorBody = await response.text();
    //         throw { status: response.status, message: errorBody };
    //     }
    //     return response.json();
    // };
    // let firstError;
    // try {
    //     // First attempt with /chat/completions
    //     const modifiedUrl = new URL(USER_API_URL);
    //     modifiedUrl.pathname = modifiedUrl.pathname.replace(/\/$/, '') + '/chat/completions';
    //     const result = await makeRequest(modifiedUrl.href);
    //     if (result?.choices?.[0]?.message?.content) {
    //         console.log('Request successful:', result.choices[0].message.content)
    //         return result.choices[0].message.content;
    //     }
    // } catch (error) {
    //     firstError = error;
    // }
    //
    // try {
    //     // Second attempt with original URL
    //     const result = await makeRequest(USER_API_URL);
    //     return result.choices[0].message.content;
    // } catch (secondError) {
    //     const combinedError = new Error('API request failed');
    //     combinedError.details = {
    //         firstAttempt: firstError?.message || 'No error info from first attempt',
    //         secondAttempt: secondError.message
    //     };
    //     throw combinedError;
    // }
}

/** Request model list
 * @returns {Promise<void>}
 */
/**
 * Format API Key for error messages
 * @param {string} key - API Key
 * @returns {string} Formatted key string
 */
function maskApiKey(key) {
    const len = key.length;
    if (len === 0) return "[Empty key]";
    if (len <= 8) {
        const visibleCount = Math.ceil(len / 2);
        return key.substring(0, visibleCount) + '...';
    } else {
        return key.substring(0, 4) + '...' + key.substring(len - 4);
    }
}

/** Request model list
 * @returns {Promise<void>}
 */
export async function updateModelList() {
    const apiUrl = $('#custom_api_url').val().trim();
    const decryptedApiKeysString = await getDecryptedApiKey(); // Use getDecryptedApiKey function to decrypt

    if (!decryptedApiKeysString) {
        EDITOR.error('API key decryption failed or not set. Please check API key settings!');
        return;
    }
    if (!apiUrl) {
        EDITOR.error('Please enter API URL');
        return;
    }

    const apiKeys = decryptedApiKeysString.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKeys.length === 0) {
        EDITOR.error('No valid API Keys found. Please check your input.');
        return;
    }

    let foundValidKey = false;
    const invalidKeysInfo = [];
    let modelCount = 0; // Used to track number of models retrieved
    const $selector = $('#model_selector');

    // Normalize URL path
    let modelsUrl;
    try {
        const normalizedUrl = new URL(apiUrl);
        normalizedUrl.pathname = normalizedUrl.pathname.replace(/\/$/, '') + '/models';
        modelsUrl = normalizedUrl.href;
    } catch (e) {
        EDITOR.error(`Invalid API URL: ${apiUrl}`, "", e);
        console.error('URL parsing failed:', e);
        return;
    }

    for (let i = 0; i < apiKeys.length; i++) {
        const currentApiKey = apiKeys[i];
        try {
            const response = await fetch(modelsUrl, {
                headers: {
                    'Authorization': `Bearer ${currentApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                let errorMsg = `Request failed: ${response.status}`;
                try {
                    const errorBody = await response.text();
                    errorMsg += ` - ${errorBody}`;
                } catch {}
                throw new Error(errorMsg);
            }

            const data = await response.json();

            // Only update dropdown on first successful retrieval
            if (!foundValidKey && data?.data?.length > 0) {
                $selector.empty(); // Clear existing options
                const customModelName = USER.IMPORTANT_USER_PRIVACY_DATA.custom_model_name;
                let hasMatchedModel = false;

                data.data.forEach(model => {
                    $selector.append($('<option>', {
                        value: model.id,
                        text: model.id
                    }));

                    // Check if any model name matches custom_model_name
                    if (model.id === customModelName) {
                        hasMatchedModel = true;
                    }
                });

                // If matching model exists, select it
                if (hasMatchedModel) {
                    $selector.val(customModelName);
                }

                foundValidKey = true;
                modelCount = data.data.length; // Record model count
                // Don't show success message here, handle it all at the end
            } else if (!foundValidKey && (!data?.data || data.data.length === 0)) {
                 // Even if request succeeded but returned no model data, treat as failure and record
                 throw new Error('Request succeeded but returned no valid model list');
            }
            // If valid key already found and list updated, subsequent keys only undergo validity check without UI update

        } catch (error) {
            console.error(`Failed to get models with Key ${i + 1}:`, error);
            invalidKeysInfo.push({ index: i + 1, key: currentApiKey, error: error.message });
        }
    }

    // Handle final results and error messages
    if (foundValidKey) {
        EDITOR.success(`Successfully retrieved ${modelCount} models and updated list (checked ${apiKeys.length} keys)`);
    } else {
        EDITOR.error('Failed to retrieve model list with any provided API Keys');
        $selector.empty(); // Ensure list is cleared when all keys are invalid
        $selector.append($('<option>', { value: '', text: 'Failed to retrieve model list' }));
    }

    if (invalidKeysInfo.length > 0) {
        const errorDetails = invalidKeysInfo.map(item =>
            `Key ${item.index} (${maskApiKey(item.key)}) invalid: ${item.error}`
        ).join('\n');
        EDITOR.error(`The following API Keys are invalid:\n${errorDetails}`);
    }
}
/**
 * Estimate token count
 * @param {string} text - Text to estimate token count for
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(text) {
    // Count Chinese characters
    let chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;

    // Count English words
    let englishWords = text.match(/\b\w+\b/g) || [];
    let englishCount = englishWords.length;

    // Estimate token count
    let estimatedTokenCount = chineseCount + Math.floor(englishCount * 1.2);
    return estimatedTokenCount;
}
/**
 * @description
 * - **Function**: Export all table data for other plugin access.
 * - **Usage**: When other plugins need to access or process table data managed by this plugin, they can use this function.
 * - **Return**: Returns an array containing all table data, where each table object includes:
 *   - `name`: Table name.
 *   - `data`: A 2D array representing complete table data (including headers and all rows).
 *
 * @returns {Array<Object<{name: string, data: Array<Array<string>>}>>}
 */
export function ext_getAllTables() {
    // Core refactoring: Keep consistent with ext_exportAllTablesAsJson to ensure data source is latest persisted state.
    
    // 1. Get latest piece
    const { piece } = BASE.getLastSheetsPiece();
    if (!piece || !piece.hash_sheets) {
        console.warn("[Memory Enhancement] ext_getAllTables: No valid table data found.");
        return [];
    }

    // 2. Create/update Sheet instances based on latest hash_sheets
    const tables = BASE.hashSheetsToSheets(piece.hash_sheets);
    if (!tables || tables.length === 0) {
        return [];
    }
    
    // 3. Build data from latest instances
    const allData = tables.map(table => {
        if (!table.enable) return null; // Skip disabled tables
        const header = table.getHeader();
        const body = table.getBody();
        const fullData = [header, ...body];

        return {
            name: table.name,
            data: fullData,
        };
    }).filter(Boolean); // Filter out null (disabled tables)

    return allData;
}

/**
 * @description
 * - **Function**: Export all tables as a JSON object, similar to 'Example Table.json' format.
 * - **Usage**: Used to export current state and data of all tables as a single JSON file.
 * - **Return**: Returns a JSON object where keys are table UIDs and values are complete table configurations and data.
 *
 * @returns {Object}
 */
export function ext_exportAllTablesAsJson() {
    // Final, most robust approach: Ensure data passed to JSON.stringify is clean.

    const { piece } = BASE.getLastSheetsPiece();
    if (!piece || !piece.hash_sheets) {
        console.warn("[Memory Enhancement] ext_exportAllTablesAsJson: No valid table data found.");
        return {};
    }

    const tables = BASE.hashSheetsToSheets(piece.hash_sheets);
    if (!tables || tables.length === 0) {
        return {};
    }

    const exportData = {};
    tables.forEach(table => {
        if (!table.enable) return; // Skip disabled tables

        try {
            const rawContent = table.getContent(true) || [];

            // Deep sanitization to ensure all cells are strings.
            // This prevents JSON.stringify anomalies caused by undefined, null, or other non-string types.
            const sanitizedContent = rawContent.map(row =>
                Array.isArray(row) ? row.map(cell =>
                    String(cell ?? '') // Convert null and undefined to empty string, force other types to string
                ) : []
            );

            exportData[table.uid] = {
                uid: table.uid,
                name: table.name,
                content: sanitizedContent
            };
        } catch (error) {
            console.error(`[Memory Enhancement] Error exporting table ${table.name} (UID: ${table.uid}):`, error);
        }
    });

    // Directly serialize the entire sanitized object.
    // If this still fails, the issue is more complex than anticipated, but this is theoretically the most standard JS approach.
    try {
        // To prevent macro parsing failures, return string directly for macro to parse itself.
        return exportData;
    } catch (e) {
        console.error("[Memory Enhancement] Final JSON serialization failed:", e);
        return {}; // Return empty object on unexpected error
    }
}
