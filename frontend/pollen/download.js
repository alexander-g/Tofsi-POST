
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
        var combined_csv = ''
        for(var i in filenames){
            var single_csv = this.csv_data_for_file(filenames[i], i==0)
            if(single_csv!=undefined)
                combined_csv += single_csv;
        }
        if(combined_csv.length > 0)
            zipdata['statistics.csv'] = combined_csv;
        return zipdata;
    }

    static csv_data_for_file(filename, include_header=true){
        const results = Object.values(GLOBAL.files).map( f => f.results ).filter(Boolean)
        const known_pollenspecies = this.collect_known_species_from_results(results);
        const header = [
            'Filename', 
            ...known_pollenspecies,
            'Other', 'Final',
        ]
        
        const f = GLOBAL.files[filename]
        if(!f.results)
            return;

        let csvtxt = ''
        for(const [i, labels] of Object.entries(f.results.labels)){
            const row = this.format_resultrow(labels, filename, i, known_pollenspecies);
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
        const label_probs     = results.map( r => r.labels ).flat()
        const all_labels      = label_probs.map( Object.keys ).flat()
        const unique_labels   = [...new Set(all_labels)].sort()
        return unique_labels;
    }

    static format_resultrow(labels, filename, i, known_pollenspecies){
        let row = [`${filename}-${i}`]
        for(const pollenspecies of known_pollenspecies.concat(['Other'])){
            const confidence = labels[pollenspecies];
            row = row.concat(confidence? (confidence*100).toFixed(0)+'%' : "   ");
        }
        let selectedlabel = get_selected_label(result);
            selectedlabel = selectedlabel? selectedlabel : "Nonpollen";
            row           = row.concat(selectedlabel)
        return row;
    }
}






//file format requested by nia
async function on_download_csv(){
    function format_resultrow(result, filename, i){
        var row = `${filename}-${i},`;
        for(var pollenspecies of global.KNOWN_POLLENSPECIES.concat(['Other'])){
            var confidence = result.prediction[pollenspecies];
            row += confidence? (confidence*100).toFixed(0)+'%' : "   ";
            row += ",";
        }
        var selectedlabel = get_selected_label(result);
        selectedlabel = selectedlabel? selectedlabel : "Nonpollen";
        row += selectedlabel += ';\n';
        return row;
    }

    var file_groups = group_filenames_by_dirname( Object.keys(global.input_files) )
    for(var group of Object.keys(file_groups)){
        var csvtext = '';
        for(var filename of file_groups[group]){
            var results = Object.values(global.input_files[filename].results);
            for(var i in results){
                csvtext += format_resultrow(results[i], file_basename(filename), i);
            }
        }

        //TODO: include manually corrected classes / detectors can be trained on different classes etc.
        if(!!csvtext){
            csvtext = "Filename," + global.KNOWN_POLLENSPECIES.join(',') + ",Other,Final;\n" + csvtext;
            downloadText(`detected_pollen_${group}.csv`, csvtext)
        }
        await sleep(250);
    }
    return;
}



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
