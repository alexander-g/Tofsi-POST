
PollenDetection = class extends BaseDetection {

    //override
    static async set_results(filename, results){
        const clear = (results == undefined)
        this.hide_dimmer(filename)

        GLOBAL.files[filename].results = undefined;
        App.Boxes.clear_box_overlays(filename)
        
        if(!clear){
            console.log(`Setting results for ${filename}:`, results)
            const pollenresults            = new PollenResults(results['labels'], results['boxes'])
            GLOBAL.files[filename].results = pollenresults
            App.Boxes.refresh_boxes(filename)
            //for(const [i, box] of Object.entries(results.boxes)){
            //    App.Boxes.add_box_overlay(filename, box, pollenresults.labels[i])
            //}
        }

        this.set_processed(filename, clear)
    }
}

