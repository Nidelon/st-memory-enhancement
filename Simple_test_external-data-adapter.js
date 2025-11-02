// Check if the plugin is loaded
console.log('Plugin version:', window.stMemoryEnhancement?.VERSION);

// Check if the adapter is initialized
console.log('Adapter status:', window.externalDataAdapter?.getState());


const xmlData = `<tableEdit> 
<!-- 
insertRow(0, {"0":"October","1":"Winter/Snowing","2":"School","3":"<user>/Youyou"}) 
deleteRow(1, 2) 
insertRow(1, {"0":"Youyou", "1":"Weight 60kg/Long black hair", "2":"Cheerful and lively", "3":"Student", "4":"Badminton", "5":"Demon Slayer", "6":"Dormitory", "7":"Sports Club President"}) 
insertRow(1, {"0":"<user>", "1":"Uniform/Short hair", "2":"Melancholic", "3":"Student", "4":"Singing", "5":"Jujutsu Kaisen", "6":"Own home", "7":"Student Council President"}) 
insertRow(2, {"0":"Youyou", "1":"Classmate", "2":"Dependent/Fond of", "3":"High"}) 
updateRow(4, 1, {"0": "Xiaohua", "1": "Ruined confession failure", "2": "October", "3": "School","4":"Angry"}) 
insertRow(4, {"0": "<user>/Youyou", "1": "Youyou confessed to <user>", "2": "2021-10-05", "3": "Classroom","4":"Touched"}) 
insertRow(5, {"0":"<user>","1":"Club competition prize","2":"Trophy","3":"First place in competition"}) 
--> 
</tableEdit>`;

const result = window.externalDataAdapter.processXmlData(xmlData);
console.log('Test result:', result);
