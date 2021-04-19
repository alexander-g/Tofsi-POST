deepcopy = function(x){return JSON.parse(JSON.stringify(x))};
sleep    = function(ms) { return new Promise(resolve => setTimeout(resolve, ms));  } //XXX: await sleep(x)

//returns the name of a file without its ending
filebasename = (filename) => filename.split('.').slice(0, -1).join('.');

function sortObjectByValue(o) {
    return Object.keys(o).sort(function(a,b){return o[b]-o[a]}).reduce((r, k) => (r[k] = o[k], r), {});
}

function upload_file_to_flask(url, file){
    var formData = new FormData();
    formData.append('files', file);
    return $.ajax({
        url: url, type: 'POST',
        data: formData,
        processData: false, cache: false,
        contentType: false, async: false,
        enctype: 'multipart/form-data'
    });
}

function rename_file(file, newname){
    return new File([file], newname, {type: file.type});
}


function read_imagesize_from_tiff(file){
    const promise = new Promise((resolve, reject) => {

        var reader = new FileReader();
        reader.onload = function(ev){
            var parser          = new TIFFParser()
            parser.tiffDataView = new DataView(ev.target.result);
            parser.littleEndian = parser.isLittleEndian(parser.tiffDataView);

            var firstIFDByteOffset = parser.getBytes(4, 4);
            console.log(firstIFDByteOffset);
            parser.fileDirectories = parser.parseFileDirectory(firstIFDByteOffset);
            var fileDirectory      = parser.fileDirectories[0];
            console.log( fileDirectory );

            var width  = fileDirectory.ImageWidth.values[0];
            var height = fileDirectory.ImageLength.values[0];
            resolve({'width':width, 'height':height});
        };
        reader.readAsArrayBuffer(file);
        
      });
    return promise
}
