/**
 * External Data Adapter Test Script v2.0.0
 * Rewritten based on user-successful test code
 */

(function() {
    'use strict';

    class ExternalDataTester {
        constructor() {
            this.testResults = [];
        }

        printSeparator(char = '=', length = 80) {
            console.log(char.repeat(length));
        }

        printTitle(title) {
            this.printSeparator();
            console.log('  ' + title);
            this.printSeparator();
        }

        recordResult(testName, success, message, data = null) {
            const result = { testName, success, message, data, timestamp: new Date().toISOString() };
            this.testResults.push(result);
            console.log((success ? '✅ ' : '❌ ') + testName + ': ' + message);
            if (data) console.log('   Data:', data);
        }

        checkAdapter() {
            this.printTitle('Check Adapter Status');
            if (typeof window.stMemoryEnhancement !== 'undefined') {
                console.log('Plugin Version:', window.stMemoryEnhancement.VERSION);
            }
            if (typeof window.externalDataAdapter === 'undefined') {
                this.recordResult('Adapter Check', false, 'Adapter not loaded');
                console.log('\n💡 Tips:');
                console.log('   1. Ensure the plugin is properly loaded');
                console.log('   2. Ensure external-data-adapter.js has been imported');
                return false;
            }
            const state = window.externalDataAdapter.getState();
            if (!state.initialized) {
                this.recordResult('Adapter Check', false, 'Adapter not initialized', state);
                return false;
            }
            this.recordResult('Adapter Check', true, 'Adapter ready', state);
            return true;
        }

        async testFullData() {
            this.printTitle('Test Full Data (User-Successful Test Data)');
            const xmlData = `<tableEdit> 
<!-- 
insertRow(0, {"0":"October","1":"Winter/Snowing","2":"School","3":"<user>/Youyou"}) 
deleteRow(1, 2) 
insertRow(1, {"0":"Youyou", "1":"Weight 60kg/Long black hair", "2":"Cheerful and lively", "3":"Student", "4":"Badminton", "5":"Demon Slayer", "6":"Dormitory", "7":"Sports Club President"}) 
insertRow(1, {"0":"<user>", "1":"Uniform/Short hair", "2":"Melancholic", "3":"Student", "4":"Singing", "5":"Jujutsu Kaisen", "6":"Own home", "7":"Student Council President"}) 
insertRow(2, {"0":"Youyou", "1":"Classmate", "2":"Dependent/Fond of", "3":"Tall"}) 
updateRow(4, 1, {"0": "Xiaohua", "1": "Ruined confession failure", "2": "October", "3": "School","4":"Angry"}) 
insertRow(4, {"0": "<user>/Youyou", "1": "Youyou confessed to <user>", "2": "2021-10-05", "3": "Classroom","4":"Touched"}) 
insertRow(5, {"0":"<user>","1":"Club competition prize","2":"Trophy","3":"First place in competition"}) 
--> 
</tableEdit>`;
            try {
                console.log('Sending full test data...');
                const result = await window.externalDataAdapter.processXmlData(xmlData);
                this.recordResult('Full Data Processing', result.success, result.message || 'Processing successful', result);
                if (result.success) {
                    console.log('\n💡 Please verify:');
                    console.log('   1. Whether the frontend table has been updated');
                    console.log('   2. Whether data persists after page refresh');
                }
                return result.success;
            } catch (error) {
                this.recordResult('Full Data Processing', false, 'Exception: ' + error.message, error);
                console.error('Error details:', error);
                return false;
            }
        }

        async testXmlData() {
            this.printTitle('Test XML Format Data');
            const xmlData = `<tableEdit><!-- insertRow(0, {"0":"Test Character", "1":"Test Description", "2":"Test Attribute"}) --></tableEdit>`;
            try {
                console.log('Sending XML data...');
                const result = await window.externalDataAdapter.processXmlData(xmlData);
                this.recordResult('XML Data Processing', result.success, result.message || 'Processing successful', result);
                return result.success;
            } catch (error) {
                this.recordResult('XML Data Processing', false, 'Exception: ' + error.message, error);
                return false;
            }
        }

        async testJsonData() {
            this.printTitle('Test JSON Format Data');
            const jsonData = { type: 'insert', tableIndex: 0, data: {"0": "JSON Test Character", "1": "JSON Test Description", "2": "JSON Test Attribute"} };
            try {
                console.log('Sending JSON data...');
                const result = await window.externalDataAdapter.processJsonData(jsonData);
                this.recordResult('JSON Data Processing', result.success, result.message || 'Processing successful', result);
                return result.success;
            } catch (error) {
                this.recordResult('JSON Data Processing', false, 'Exception: ' + error.message, error);
                return false;
            }
        }

        async runAllTests() {
            this.printTitle('External Data Adapter Testing Started');
            console.log('Test Time:', new Date().toLocaleString());
            console.log('');
            this.testResults = [];
            if (!this.checkAdapter()) {
                console.log('\n❌ Adapter check failed, testing aborted');
                return;
            }
            console.log('');
            await this.testXmlData();
            console.log('');
            await this.testJsonData();
            console.log('');
            await this.testFullData();
            console.log('');
            this.printTestSummary();
        }

        printTestSummary() {
            this.printTitle('Test Summary');
            const total = this.testResults.length;
            const passed = this.testResults.filter(r => r.success).length;
            const failed = total - passed;
            console.log('Total Tests: ' + total);
            console.log('✅ Passed: ' + passed);
            console.log('❌ Failed: ' + failed);
            console.log('Pass Rate: ' + ((passed / total) * 100).toFixed(2) + '%');
            if (failed === 0) {
                console.log('\n🎉 All tests passed!');
            } else {
                console.log('\n⚠️ Some tests failed, please review details above');
            }
            this.printSeparator();
        }

        getResults() {
            return this.testResults;
        }
    }

    window.externalDataTester = new ExternalDataTester();
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              External Data Adapter Test Script Loaded (v2.0.0)             ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Usage:');
    console.log('  1. Run all tests: externalDataTester.runAllTests()');
    console.log('  2. Check adapter: externalDataTester.checkAdapter()');
    console.log('  3. Test XML: externalDataTester.testXmlData()');
    console.log('  4. Test JSON: externalDataTester.testJsonData()');
    console.log('  5. Test full data: externalDataTester.testFullData()');
    console.log('  6. View results: externalDataTester.getResults()');
    console.log('');
    console.log('Note: All test functions are asynchronous and require await');
})();
