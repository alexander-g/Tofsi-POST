
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
            
            $(`.table-row[filename="${filename}"] td:nth-of-type(2)`).text( this.format_results_for_table(pollenresults) )
        }

        this.set_processed(filename, clear)
    }

    static format_results_for_table(pollenresults){
        return pollenresults.labels.join(', ')         //TODO: confidence
    }
}

