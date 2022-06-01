
PollenDownload = class extends BaseDownload {
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

    //Download All -> Download Annotations
    static on_download_json(event){
        let zipdata = {}
        for(const [filename, f] of Object.entries(GLOBAL.files)){
            if(!f.results)
                continue;

            const jsonfile         = this.build_annotation_jsonfile(filename, f.results)
            zipdata[jsonfile.name] = jsonfile
        }
        if(Object.keys(zipdata).length > 0)
            download_zip('annotations.zip', zipdata)
    }

    static build_annotation_jsonfile(filename, results){
        let jsondata = deepcopy(LABELME_TEMPLATE);
        jsondata.imagePath = filename

        for(const [i,box] of Object.entries(results.boxes)){
            const label      = results.labels[i].trim() || "Nonpollen";
            //if(label.trim()=="")
            //    continue;
            let jsonshape    = deepcopy(LABELME_SHAPE_TEMPLATE);
            jsonshape.label  = label;
            jsonshape.points = [ [box[0], box[1]], [box[2], box[3]] ];
            jsondata.shapes.push(jsonshape);
        }

        const jsonfilename = filename.split('.').slice(0, -1).join('.')+'.json'
        const blob         = new Blob([JSON.stringify(jsondata, null, 2)], {type : 'application/json'})
        const jsonfile     = new File([blob], jsonfilename)
        return jsonfile
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


const LABELME_TEMPLATE = {
    //version: "3.16.2",
    flags: {},
    shapes: [    ],
    lineColor: [ 0, 255, 0, 128 ],
    fillColor: [255,  0, 0, 128 ],
    imagePath: "",
    imageData: null
}

const LABELME_SHAPE_TEMPLATE = {
    label: "???",
    line_color: null,
    fill_color: null,
    points: [ [ 2297.6377952755906, 2039.3700787401574 ],
              [ 3204.7244094488187, 2317.3228346456694 ] ],
    shape_type: "rectangle",
    flags: {}
}

