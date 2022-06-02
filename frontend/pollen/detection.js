
PollenDetection = class extends BaseDetection {

    //override
    static async set_results(filename, results){
        const clear = (results == undefined)
        this.hide_dimmer(filename)

        GLOBAL.files[filename].results = undefined;
        GLOBAL.App.Boxes.clear_box_overlays(filename)
        
        if(!clear){
            console.log(`Setting results for ${filename}:`, results)
            const pollenresults            = new PollenResults(results['labels'], results['boxes'])
            GLOBAL.files[filename].results = pollenresults
            GLOBAL.App.Boxes.refresh_boxes(filename)
            
            $(`.table-row[filename="${filename}"] td:nth-of-type(2)`).html( this.format_results_for_table(pollenresults) )
        }

        this.set_processed(filename, clear)
    }

    static format_results_for_table(pollenresults){
        const hiconf_threshold = 0.7                                                                                                //FIXME hardcoded threshold
        const n     = pollenresults.labels.length;
        let   texts = []
        for (let i = 0; i < n; i++) {
            let   label      = pollenresults.labels[i];
            const confidence = Object.values(pollenresults.predictions[i])[0]
            if(!label || (label.toLowerCase()=='nonpollen')){
                if(confidence > hiconf_threshold)
                    //filter high-confidence non-pollen
                    continue;
                else
                    label = 'Nonpollen'
            }
            
            let   text       = `${label}(${(confidence*100).toFixed(0)}%)`
            if(confidence > hiconf_threshold)
                  text       = `<b>${text}</b>`
            texts = texts.concat(text)
        }
        const full_text = texts.join(', ') || '-'
        return full_text
    }
}

