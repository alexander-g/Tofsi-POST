
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
  
function on_download_csv(){
    csvtxt = '';
    for(filename of Object.keys(global.input_files)){
        selectedlabels = get_selected_labels(filename);
        csvtxt+= [filename].concat(selectedlabels).join(', ')+';\n'
      }
  
    if(!!csvtxt)
      download('detected_pollen.csv', csvtxt)
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }  

async function on_download_labelme(){
    for(filename of Object.keys(global.input_files)){
        var f = global.input_files[filename];
        if(!f.processed)
            continue;

        var jsondata = deepcopy(labelme_template);
        jsondata.imagePath = filename;
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

        var jsonfilename = filename.split('.').slice(0, -1).join('.')+'.json'
        download(jsonfilename, JSON.stringify(jsondata, null, 2));

        //sleep for a few milliseconds because chrome does not allow more than 10 simulataneous downloads
        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

