import { SYSTEM, USER} from "../core/manager.js";

// /**______________________Please do not upload your API key after filling it in______________________*/
// /**
//  * For testing only. Please do not upload your API key after filling it in.
//  * @type {{model_name: string, api_url: string, api_key: string, max_tokens: number, temperature: number, system_prompt: string}}
//  */
// const testConfig = {
//     api_url: "",
//     api_key: "",
//     model_name: "gemini-2.0-flash",
//     system_prompt: "You are a professional translation assistant",
//     temperature: 0.7,
//     max_tokens: 2000,
// };

export async function rollbackVersion() {
    // Show confirmation dialog
    if (confirm("Initialize version 2.0 table data? This action cannot be undone! (It will destroy all new table data in the current conversation, clear all new table templates, and simulate a rollback to the previous version. This feature is for debugging only.)")) {
        USER.tableBaseSetting.updateIndex = 3
        delete USER.getSettings().table_database_templates
        delete USER.getContext().chatMetadata.sheets

        const context_chat = USER.getContext().chat
        if (context_chat) {
            for (let piece of context_chat) {
                delete piece.hash_sheets
                delete piece.two_step_links
                delete piece.two_step_waiting
            }
        }

        USER.saveSettings()
        USER.saveChat();
        console.log("Table data cleared: ", USER.getSettings(), USER.getContext().chatMetadata, USER.getChatPiece())
        return true
    } else {
        console.log("User canceled the clear operation")
        return false
    }
}

/**______________________Please do not upload your API key after filling it in______________________*/
export function functionToBeRegistered() {
    SYSTEM.f(rollbackVersion, "Roll back to previous version")
    // SYSTEM.f(()=>{
    //     let sourceData = {}
    //     const s = BASE.sheetsData.context
    //     console.log(s, s[0])
    //     console.log(s[0].cellHistory[0])
    //     console.log(s[0].cellHistory[0].data.description)
    // }, "Print table source")
    // SYSTEM.f(()=>{
    //     EDITOR.info("Test info")
    // }, "Test info")
    // SYSTEM.f(async ()=>{
    //     EDITOR.confirm(
    //         'Execute action?',
    //         'Cancel',
    //         'Confirm'
    //     ).then((r)=>{
    //         console.log(r)
    //     })
    // }, "Test confirm")
    // // Test non-streaming API call
    // SYSTEM.f(async () => {
    //     const llmService = new LLMApiService(testConfig);
    //
    //     try {
    //         console.log("Testing API connection (non-streaming mode)...");
    //
    //         // Test connection
    //         const testResponse = await llmService.testConnection();
    //         console.log("API connection test successful (non-streaming mode)!", testResponse);
    //
    //         // Test translation
    //         console.log("Testing translation functionality (non-streaming mode)...");
    //         const testText = "This is a test sentence to check if the translation service is working properly.";
    //         const translation = await llmService.callLLM(testText);
    //
    //         console.log(`Translation test successful (non-streaming mode)! Original: ${testText}, Translation: ${translation}`);
    //     } catch (error) {
    //         console.log("API test failed (non-streaming mode):", error.message);
    //         console.error(error);
    //     }
    // }, "llmApi non-streaming");
    //
    // // Test streaming API call
    // SYSTEM.f(async () => {
    //     const llmService = new LLMApiService(testConfig);
    //
    //     try {
    //         console.log("Testing API connection (streaming mode)...");
    //
    //         // Test connection (still using non-streaming test in streaming mode)
    //         const testResponse = await llmService.testConnection();
    //         console.log("API connection test successful (streaming mode)!", testResponse);
    //
    //         // Test translation (streaming mode)
    //         console.log("Testing translation functionality (streaming mode)...");
    //         const testText = "Abstract. Most 3D Gaussian Splatting (3D-GS) based methods for urban\n" +
    //             "scenes initialize 3D Gaussians directly with 3D LiDAR points, which\n" +
    //             "not only underutilizes LiDAR data capabilities but also overlooks the\n" +
    //             "potential advantages of fusing LiDAR with camera data. In this paper,\n" +
    //             "we design a novel tightly coupled LiDAR-Camera Gaussian Splatting\n" +
    //             "(TCLC-GS) to fully leverage the combined strengths of both LiDAR\n" +
    //             "and camera sensors, enabling rapid, high-quality 3D reconstruction and\n" +
    //             "novel view RGB/depth synthesis. TCLC-GS designs a hybrid explicit\n" +
    //             "(colorized 3D mesh) and implicit (hierarchical octree feature) 3D representation\n" +
    //             "derived from LiDAR-camera data, to enrich the properties of\n" +
    //             "3D Gaussians for splatting. 3D Gaussian’s properties are not only initialized\n" +
    //             "in alignment with the 3D mesh which provides more completed 3D\n" +
    //             "shape and color information, but are also endowed with broader contextual\n" +
    //             "information through retrieved octree implicit features. During the\n" +
    //             "Gaussian Splatting optimization process, the 3D mesh offers dense depth\n" +
    //             "information as supervision, which enhances the training process by learning\n" +
    //             "of a robust geometry. Comprehensive evaluations conducted on the\n" +
    //             "Waymo Open Dataset and nuScenes Dataset validate our method’s state-of-\n" +
    //             "the-art (SOTA) performance. Utilizing a single NVIDIA RTX 3090 Ti,\n" +
    //             "our method demonstrates fast training and achieves real-time RGB and\n" +
    //             "depth rendering at 90 FPS in resolution of 1920×1280 (Waymo), and\n" +
    //             "120 FPS in resolution of 1600×900 (nuScenes) in urban scenarios.";
    //
    //         // Streaming callback function
    //         let fullResponse = "";
    //         const streamCallback = (chunk) => {
    //             fullResponse += chunk;
    //             console.log(fullResponse);
    //         };
    //
    //         console.log("Starting streaming...");
    //         const translation = await llmService.callLLM(testText, streamCallback);
    //
    //         console.log("\nStreaming completed!");
    //         console.log(`Full translation: ${translation}`);
    //     } catch (error) {
    //         console.log("API test failed (streaming mode):", error.message);
    //         console.error(error);
    //     }
    // }, "llmApi streaming");
    //
    // // Test streaming API call
    // SYSTEM.f(async () => {
    //     console.log(getRequestHeaders())
    // }, "secrets test");
}
