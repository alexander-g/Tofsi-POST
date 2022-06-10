

PollenTraining = class extends ObjectDetectionTraining {
    
    //dummy override: all files selected
    static get_selected_files(){
        return Object.keys(GLOBAL.files)
    }
}

