
PollenDownload = class extends BaseDownload {
    //override
    static zipdata_for_file(filename){
        const f  = GLOBAL.files[filename];
        if(!f.cell_results && !f.treering_results)
            return undefined;
        
        const zipdata  = {};
        if(f.cell_results)
            zipdata[f.cell_results.cells.name] = f.cell_results.cells;
        if(f.treering_results){
            zipdata[f.treering_results.segmentation.name]   = f.treering_results.segmentation;
            zipdata[`${filename}.tree_ring_statistics.csv`] = this.treering_csv_data(filename);
        }
        if(f.association_result){
            zipdata[f.association_result.ring_map.name] = f.association_result.ring_map;
            zipdata[`${filename}.cell_statistics.csv`]  = this.cell_csv_data(filename)
        }
        return zipdata;
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




//TODO: labelme json download

const labelme_template = {
    //version: "3.16.2",
    flags: {},
    shapes: [    ],
    lineColor: [ 0, 255, 0, 128 ],
    fillColor: [255,  0, 0, 128 ],
    imagePath: "",
    imageData: null
}

const labelme_shape_template = {
    label: "???",
    line_color: null,
    fill_color: null,
    points: [ [ 2297.6377952755906, 2039.3700787401574 ],
              [ 3204.7244094488187, 2317.3228346456694 ] ],
    shape_type: "rectangle",
    flags: {}
}


function on_download_labelme(){
    var zip = new JSZip();
    var n = 0
    for(filename of Object.keys(global.input_files)){
        var f = global.input_files[filename];
        if(!f.processed)
            continue;

        var jsondata = deepcopy(labelme_template);
        jsondata.imagePath = file_basename(filename);
        height = f.imagesize.length==4? f.imagesize[1] : f.imagesize[0];
        width  = f.imagesize.length==4? f.imagesize[2] : f.imagesize[1];

        for(r of Object.values(f.results)){
            var label        = get_selected_label(r);
            if(label.trim()=="")
                continue;
            var jsonshape    = deepcopy(labelme_shape_template);
            jsonshape.label  = label;
            jsonshape.points = [ [r.box[1]*width, r.box[0]*height], [r.box[3]*width, r.box[2]*height] ];
            jsondata.shapes.push(jsonshape);
        }

        var jsonfilename = filename.replace(new RegExp(PATH_SEPARATOR, 'g'), '/').split('.').slice(0, -1).join('.')+'.json'
        zip.file(jsonfilename, new Blob([JSON.stringify(jsondata, null, 2)], {type : 'application/json'}), {binary:true});
        n++;
    }

    if(n==0)
        return;
    
    zip.generateAsync({type:"blob"}).then( blob => {
        downloadBlob(  'annotations.zip', blob  );
    } );
}
