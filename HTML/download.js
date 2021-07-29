
//downloads an element from the uri (to the user hard drive)
function downloadURI(filename, uri) {
    var element = document.createElement('a');
    element.setAttribute('href', uri);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
  
  function downloadText(filename, text){
    return downloadURI(filename, 'data:text/plain;charset=utf-8,'+encodeURIComponent(text))
  }
  
  function downloadBlob(filename, blob){
    return downloadURI(filename, URL.createObjectURL(blob));
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
    label: "Myotis bechstenii",
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
