
PollenDownload = class extends ObjectDetectionDownload {
    //override
    static zipdata_for_file(filename){
        console.error('Not implemented')
    }

    //override
    static zipdata_for_files(filenames){
        //var zipdata      = super.zipdata_for_files(filenames)
        let zipdata      = {}
        let combined_csv = ''
        for(const i in filenames){
            let single_csv = this.csv_data_for_file(filenames[i], i==0)
            if(single_csv!=undefined)
                combined_csv += single_csv;
        }
        if(combined_csv.length > 0)
            zipdata['statistics.csv'] = combined_csv;
        return zipdata;
    }

    //Download All -> Download CSV
    static on_download_csv(event){
        const filenames = Object.keys(GLOBAL.files)
        const data      = this.zipdata_for_files(filenames)
        const csv       = data['statistics.csv']
        if(!!csv)
            download_text('statistics.csv', csv)
    }

    //override
    static build_annotation_jsonfile(filename, results){
        return super.build_annotation_jsonfile(filename, results, "Nonpollen")
    }


    static csv_data_for_file(filename, include_header=true){
        const all_results = Object.values(GLOBAL.files).map( f => f.results ).filter(Boolean)
        const known_pollenspecies = this.collect_known_species_from_results(all_results);
        const header = [
            'Filename', 
            ...known_pollenspecies,
            'Other', 'Final',
        ]
        
        const f = GLOBAL.files[filename]
        if(!f.results)
            return;

        let csvtxt = ''
        if(include_header)
            csvtxt += header.join(',')+'\n'
        for(const [i, prediction] of Object.entries(f.results.predictions)){
            const label = f.results.labels[i]
            const row   = this.format_prediction(prediction, filename, i, label, known_pollenspecies);
            //sanity check
            if(header.length != row.length){
                console.error('CSV data length mismatch:', header, row)
                $('body').toast({message:'CSV data length mismatch', class:'error'})
                return;
            }
            csvtxt += row.join(',')+'\n';
        }
        return csvtxt;
    }

    static collect_known_species_from_results(results){
        const predictions     = results.map( r => r.predictions ).flat()
        const all_labels      = predictions.map( Object.keys ).flat()
        let   unique_labels   = new Set(all_labels)
              unique_labels.delete('')
              unique_labels.delete('Other')
        return [...unique_labels].sort();
    }

    static format_prediction(prediction, filename, i, selectedlabel, known_pollenspecies){
        let row = [`${filename}-${i}`]
        for(const pollenspecies of known_pollenspecies.concat(['Other'])){
            const confidence     = prediction[pollenspecies];
            const confidence_str = (confidence? (confidence*100).toFixed(0)+'%' : "")
            row.push( confidence_str.padStart(4) );
        }
        selectedlabel = selectedlabel? selectedlabel : "Nonpollen";
        row.push(selectedlabel)
        return row;
    }
}

