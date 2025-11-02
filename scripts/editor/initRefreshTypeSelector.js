import {profile_prompts} from "../../data/profile_prompts.js";

/**
 * Initialize the table refresh type selector.
 * Dynamically generate dropdown options based on the profile_prompts object.
 */
export function initRefreshTypeSelector() {
    const $selector = $('#table_refresh_type_selector');
    if (!$selector.length) return;
    
    // Clear and re-add options
    $selector.empty();
    
    // Iterate over the profile_prompts object and add options
    Object.entries(profile_prompts).forEach(([key, value]) => {
        const option = $('<option></option>')
            .attr('value', key)
            .text((() => {
                switch(value.type) {
                    case 'refresh':
                        return '**Legacy** ' + (value.name || key);
                    case 'third_party':
                        return '**Third-party author** ' + (value.name || key);
                    default:
                        return value.name || key;
                }
            })());
        $selector.append(option);
    });
    
    // If no options exist, add a default fallback option
    if ($selector.children().length === 0) {
        $selector.append($('<option></option>').attr('value', 'rebuild_base').text('~~~You should not see this—something went wrong~~~~'));
    }
    
    console.log('Table refresh type selector has been updated');

    // // Check if current options match profile_prompts
    // let needsUpdate = false;
    // const currentOptions = $selector.find('option').map(function() {
    //     return {
    //         value: $(this).val(),
    //         text: $(this).text()
    //     };
    // }).get();

    // // Check if the number of options matches
    // if (currentOptions.length !== Object.keys(profile_prompts).length) {
    //     needsUpdate = true;
    // } else {
    //     // Check if each option's value and text match
    //     Object.entries(profile_prompts).forEach(([key, value]) => {
    //         const currentOption = currentOptions.find(opt => opt.value === key);
    //         if (!currentOption || 
    //             currentOption.text !== ((value.type=='refresh'? '**Legacy** ':'')+value.name|| key)) {
    //             needsUpdate = true;
    //         }
    //     });
    // }

    // // Rebuild options if mismatch detected
    // if (needsUpdate) {
    //     $selector.empty();
        
    //     // Iterate over profile_prompts and add options
    //     Object.entries(profile_prompts).forEach(([key, value]) => {
    //         const option = $('<option></option>')
    //             .attr('value', key)
    //             .text((value.type=='refresh'? '**Legacy** ':'')+value.name|| key);
    //         $selector.append(option);
    //     });
        
    //     // Add fallback if no options were added
    //     if ($selector.children().length === 0) {
    //         $selector.append($('<option></option>').attr('value', 'rebuild_base').text('~~~You should not see this—something went wrong~~~~'));
    //     }
        
    //     console.log('Table refresh type selector has been updated');
}
