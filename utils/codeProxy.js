import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../core/manager.js';

/**
 * @description Helper function to recursively create a Proxy
 * @param {Object} obj - The object to be proxied
 * @returns {Object} - The created Proxy object
 */
export const createProxy = (obj) => {
    return new Proxy(obj, {
        get(target, prop) {
            return target[prop];
        },
        set(target, prop, newValue) {
            target[prop] = newValue; // Directly modify the original props object
            return true;
        },
    });
}

export const createProxyWithUserSetting = (target, allowEmpty = false) => {
    return new Proxy({}, {
        get: (_, property) => {
            // console.log(`Creating proxy object ${target}`, property)
            // Highest priority: fetch from user settings
            if (USER.getSettings()[target] && property in USER.getSettings()[target]) {
                // console.log(`Variable ${property} has been retrieved from user settings`)
                return USER.getSettings()[target][property];
            }
            // Attempt to fetch from legacy data location: USER.getExtensionSettings().muyoo_dataTable
            if (USER.getExtensionSettings()[target] && property in USER.getExtensionSettings()[target]) {
                console.log(`Variable ${property} not found in user configuration; retrieved from legacy data`)
                const value = USER.getExtensionSettings()[target][property];
                if (!USER.getSettings()[target]) {
                    USER.getSettings()[target] = {}; // Initialize if not exists
                }
                USER.getSettings()[target][property] = value;
                return value;
            }
            // If not found in legacy data either, fetch from defaultSettings
            if (USER.tableBaseDefaultSettings && property in USER.tableBaseDefaultSettings) {
                console.log(`Variable ${property} not found; retrieved from default settings`)
                return USER.tableBaseDefaultSettings[property];
            }
            // If not found in defaultSettings either, check if empty values are allowed
            if (allowEmpty) {
                return undefined;
            }
            // If not found in defaultSettings and empty values are not allowed, throw an error
            EDITOR.error(`Variable ${property} not found in default settings; please check the code`)
            return undefined;
        },
        set: (_, property, value) => {
            console.log(`Setting variable ${property} to ${value}`)
            if (!USER.getSettings()[target]) {
                USER.getSettings()[target] = {}; // Initialize if not exists
            }
            USER.getSettings()[target][property] = value;
            USER.saveSettings();
            return true;
        },
    })
}
