import {EDITOR, USER} from '../core/manager.js';
// @ts-ignore
let ChatCompletionService = undefined;
try {
    // Dynamic import to handle cases where the module does not exist
    const module = await import('/scripts/custom-request.js');
    ChatCompletionService = module.ChatCompletionService;
} catch (e) {
    console.warn("Failed to detect /scripts/custom-request.js or ChatCompletionService was not properly exported. Proxy-related features will be disabled.", e);
}
export class LLMApiService {
    constructor(config = {}) {
        this.config = {
            api_url: config.api_url || "https://api.openai.com/v1",
            api_key: config.api_key || "",
            model_name: config.model_name || "gpt-3.5-turbo",
            system_prompt: config.system_prompt || "You are a helpful assistant.",
            temperature: config.temperature || 1.0,
            max_tokens: config.max_tokens || 63000, // Changed default value from 20000 to 63000
            stream: config.stream || false
        };
    }

    async callLLM(prompt, streamCallback = null) {
        if (!prompt) {
            throw new Error("Input content cannot be empty");
        }

        if (!this.config.api_url || !this.config.api_key || !this.config.model_name) {
            throw new Error("API configuration is incomplete");
        }

        let messages;
        if (Array.isArray(prompt)) {
            // If prompt is an array, use it directly as messages
            messages = prompt;
        } else if (typeof prompt === 'string') {
            // If prompt is a string, keep the original logic
            if (prompt.trim().length < 2) throw new Error("Input text is too short");
            messages = [
                { role: 'system', content: this.config.system_prompt },
                { role: 'user', content: prompt }
            ];
        } else {
            throw new Error("Invalid input type; only strings or message arrays are accepted");
        }

        this.config.stream = streamCallback !== null;

        // If a proxy address is configured, use SillyTavern's internal routing
        if (USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address) {
            console.log("Proxy configuration detected; using SillyTavern internal routing");
            if (typeof ChatCompletionService === 'undefined' || !ChatCompletionService?.processRequest) {
                const errorMessage = "Your tavern version is outdated and cannot send custom requests. Please update your tavern version";
                EDITOR.error(errorMessage);
                throw new Error(errorMessage);
            }
            try {
                const requestData = {
                    stream: this.config.stream,
                    messages: messages,
                    max_tokens: this.config.max_tokens,
                    model: this.config.model_name,
                    temperature: this.config.temperature,
                    chat_completion_source: 'openai', // Assume the proxy target is OpenAI-compatible
                    custom_url: this.config.api_url,
                    reverse_proxy: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address,
                    proxy_password: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key || null,
                };

                if (this.config.stream) {
                    if (!streamCallback || typeof streamCallback !== 'function') {
                        throw new Error("A valid streamCallback function must be provided in streaming mode");
                    }
                    const streamGenerator = await ChatCompletionService.processRequest(requestData, {}, false); // extractData = false for stream
                    let fullResponse = '';
                    for await (const chunk of streamGenerator()) {
                        if (chunk.text) {
                            fullResponse += chunk.text;
                            streamCallback(chunk.text);
                        }
                    }
                    return this.#cleanResponse(fullResponse);
                } else {
                    const responseData = await ChatCompletionService.processRequest(requestData, {}, true); // extractData = true for non-stream
                    if (!responseData || !responseData.content) {
                        throw new Error("Failed to obtain response via internal routing or response content is empty");
                    }
                    return this.#cleanResponse(responseData.content);
                }
            } catch (error) {
                console.error("Error calling LLM API via SillyTavern internal routing:", error);
                throw error;
            }
        } else {
            // No proxy configured; use the original direct fetch logic
            console.log("No proxy configuration detected; using direct fetch");
            let apiEndpoint = this.config.api_url;
            if (!apiEndpoint.endsWith("/chat/completions")) {
                apiEndpoint += "/chat/completions";
            }

            const headers = {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            };

            const data = {
                model: this.config.model_name,
                messages: messages,
                temperature: this.config.temperature,
                max_tokens: this.config.max_tokens,
                stream: this.config.stream
            };

            try {
                if (this.config.stream) {
                    if (!streamCallback || typeof streamCallback !== 'function') {
                        throw new Error("A valid streamCallback function must be provided in streaming mode");
                    }
                    return await this.#handleStreamResponse(apiEndpoint, headers, data, streamCallback);
                } else {
                    return await this.#handleRegularResponse(apiEndpoint, headers, data);
                }
            } catch (error) {
                console.error("Error calling LLM API directly:", error);
                throw error;
            }
        }
    }

    async #handleRegularResponse(apiEndpoint, headers, data) {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const responseData = await response.json();

        if (!responseData.choices || responseData.choices.length === 0 ||
            !responseData.choices[0].message || !responseData.choices[0].message.content) {
            throw new Error("API returned an invalid response structure");
        }

        let translatedText = responseData.choices[0].message.content;
        return this.#cleanResponse(translatedText);
    }

    async #handleStreamResponse(apiEndpoint, headers, data, streamCallback) {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
            throw new Error("Unable to access response stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullResponse = '';
        let chunkIndex = 0; // Add chunk index for logging

        try {
            console.log('[Stream] Starting stream processing for custom API...'); // Log stream start
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[Stream] Custom API stream finished (done=true).'); // Log stream end
                    break;
                }

                const decodedChunk = decoder.decode(value, { stream: true });
                buffer += decodedChunk;
                chunkIndex++;
                console.log(`[Stream] Custom API received chunk ${chunkIndex}. Buffer length: ${buffer.length}`); // Log received chunk and buffer size

                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep potential incomplete line in buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine === '') continue;
                    console.log(`[Stream] Custom API processing line: "${trimmedLine}"`); // Log processed line

                    try {
                        if (trimmedLine.startsWith('data: ')) {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]') {
                                console.log('[Stream] Custom API received [DONE] marker.'); // Log DONE marker
                                continue; // Skip further processing for this line
                            }

                            const jsonData = JSON.parse(dataStr);
                            // Optional: Log parsed structure if needed for deep debugging
                            // console.log('[Stream] Custom API parsed JSON:', JSON.stringify(jsonData));

                            if (jsonData.choices?.[0]?.delta?.content) {
                                const content = jsonData.choices[0].delta.content;
                                fullResponse += content;
                                // console.log(`[Stream] Custom API extracted content: "${content}"`); // Log extracted content if needed
                                streamCallback(content); // Pass content to the callback
                            } else {
                                // console.log('[Stream] Custom API line parsed, but no content found in delta.');
                            }
                        } else {
                             console.log('[Stream] Custom API line does not start with "data: ". Skipping.');
                        }
                    } catch (e) {
                        console.warn("[Stream] Custom API error parsing line JSON:", e, "Line:", trimmedLine); // Log parsing errors
                    }
                }
                 // Optional: Log buffer state after processing lines
                 // console.log(`[Stream] Custom API buffer after processing lines (potential incomplete line): "${buffer}"`);
            }

            // Process any remaining data in the buffer after the loop finishes
            const finalBufferTrimmed = buffer.trim();
            if (finalBufferTrimmed) {
                console.log(`[Stream] Custom API processing final buffer content: "${finalBufferTrimmed}"`); // Log final buffer processing
                try {
                    // Attempt to handle potential JSON object directly in buffer (less common for SSE)
                    if (finalBufferTrimmed.startsWith('data: ')) {
                         const dataStr = finalBufferTrimmed.substring(6).trim();
                         if (dataStr !== '[DONE]') {
                            const jsonData = JSON.parse(dataStr);
                             // Optional: Log parsed structure if needed
                             // console.log('[Stream] Custom API parsed final buffer JSON:', JSON.stringify(jsonData));
                            if (jsonData.choices?.[0]?.delta?.content) {
                                const content = jsonData.choices[0].delta.content;
                                fullResponse += content;
                                // console.log(`[Stream] Custom API extracted final buffer content: "${content}"`);
                                streamCallback(content);
                            }
                         }
                    } else {
                         // Maybe it's a non-SSE JSON object? Or just leftover text.
                         console.warn("[Stream] Custom API final buffer content does not start with 'data: '. Attempting direct parse (if applicable) or ignoring.");
                         // Example: try parsing directly if expecting a single JSON object
                         // const jsonData = JSON.parse(buffer);
                         // ... handle jsonData ...
                    }
                } catch (e) {
                    console.warn("[Stream] Custom API error processing final buffer content:", e);
                }
            }

            console.log('[Stream] Custom API stream processing complete. Full response length:', fullResponse.length); // Log final length
            return this.#cleanResponse(fullResponse);
        } catch (streamError) {
            console.error('[Stream] Custom API error during stream reading:', streamError); // Log errors during read()
            throw streamError; // Re-throw the error
        } finally {
            console.log('[Stream] Custom API releasing stream lock.'); // Log lock release
            reader.releaseLock();
        }
    }

    #cleanResponse(text) {
        // Clean response text by removing possible prefixes or suffixes
        return text.trim();
    }

    async testConnection() {
        const testPrompt = "Say hello.";
        const messages = [
            { role: 'system', content: this.config.system_prompt },
            { role: 'user', content: testPrompt }
        ];

        // If a proxy address is configured, use SillyTavern's internal routing for testing
        if (USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address) {
            console.log("Proxy configuration detected; using SillyTavern internal routing for connection test");
            try {
                const requestData = {
                    stream: false, // Streaming not needed for connection test
                    messages: messages,
                    max_tokens: 50, // Connection test doesn't require many tokens
                    model: this.config.model_name,
                    temperature: this.config.temperature,
                    chat_completion_source: 'openai', // Assume the proxy target is OpenAI-compatible
                    custom_url: this.config.api_url,
                    reverse_proxy: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address,
                    proxy_password: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key || null,
                };
                // Use processRequest for non-streaming request test
                const responseData = await ChatCompletionService.processRequest(requestData, {}, true);
                if (!responseData || !responseData.content) {
                    throw new Error("Connection test via internal routing failed or response content is empty");
                }
                return responseData.content; // Return response content to indicate success
            } catch (error) {
                console.error("Error testing API connection via SillyTavern internal routing:", error);
                throw error;
            }
        } else {
            // No proxy configured; use original direct fetch logic for testing
            console.log("No proxy configuration detected; using direct fetch for connection test");
            let apiEndpoint = this.config.api_url;
            if (!apiEndpoint.endsWith("/chat/completions")) {
                apiEndpoint += "/chat/completions";
            }

            const headers = {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            };

            const data = {
                model: this.config.model_name,
                messages: messages,
                temperature: this.config.temperature,
                max_tokens: 50, // Connection test doesn't require many tokens
                stream: false
            };

            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API test request failed: ${response.status} - ${errorText}`);
                }

                const responseData = await response.json();
                // Validate response structure
                if (!responseData.choices || responseData.choices.length === 0 || !responseData.choices[0].message || !responseData.choices[0].message.content) {
                    throw new Error("API test returned an invalid response structure");
                }
                return responseData.choices[0].message.content; // Return response content to indicate success
            } catch (error) {
                console.error("Error testing API connection via direct fetch:", error);
                throw error;
            }
        }
    }
}

export default LLMApiService;
