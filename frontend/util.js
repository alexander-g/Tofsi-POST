deepcopy = function(x){return JSON.parse(JSON.stringify(x))};
sleep    = function(ms) { return new Promise(resolve => setTimeout(resolve, ms));  } //XXX: await sleep(x)

//returns the name of a file without its ending
strip_file_extension = (filename) => filename.split('.').slice(0, -1).join('.');

function sortObjectByValue(o) {
    return Object.keys(o).sort(function(a,b){return o[b]-o[a]}).reduce((r, k) => (r[k] = o[k], r), {});
}

function sortObject(o, sorted_keys){
    return sorted_keys.reduce( (new_o, k) => (new_o[k] = o[k], new_o), {} );
}

//generate an array of numbers
function arange(x0,x1=undefined){
    var start = (x1==undefined)?  0 : x0;
    var stop  = (x1==undefined)? x0 : x1-start;
    return [...Array(stop).keys()].map(x=>x+start)
}

function upload_file_to_flask(url, file, async=false){
    var formData = new FormData();
    formData.append('files', file);
    return $.ajax({
        url: url, type: 'POST',
        data: formData,
        processData: false, cache: false,
        contentType: false, async: async,
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
            parser.fileDirectories = parser.parseFileDirectory(firstIFDByteOffset, only_first=true);
            var fileDirectory      = parser.fileDirectories[0];

            var width  = fileDirectory.ImageWidth.values[0];
            var height = fileDirectory.ImageLength.values[0];
            resolve({'width':width, 'height':height});
        };
        //reading only 1024 bytes to get the image size
        //this might be a strong assumption
        reader.readAsArrayBuffer(file.slice(0, 1024));

      });
    return promise
}


function read_imagename_from_json(jsonfile){
    const promise = new Promise((resolve, reject) => {
        var reader = new FileReader()
        reader.onload = function(ev){
            var text = ev.target.result;
            var idx  = text.indexOf('"imagePath"');
                idx  = text.indexOf(',', position=idx);
            text     = text.slice(0,idx)+'}';
            data     = JSON.parse(text)
        };
        //reading only 4kbytes to get the image name
        //this might be a strong assumption
        reader.readAsText(jsonfile.slice(0,1024*4));
    });
    return promise;
}


//using non-standard character as path separator to avoid problems
PATH_SEPARATOR = '╱'
//NOTE: ord( '⧸' ), ord('∕'), ord('⁄'), ord('╱')  =  (10744, 8725, 8260, 9585)


function full_filename(f){
    var name = f.name
    if('webkitRelativePath' in f)
		if(f.webkitRelativePath.length>0)
            name = f.webkitRelativePath
    name = name.replace(/\//g, PATH_SEPARATOR)  //replace all /
    name = name.replace(/\\/g, PATH_SEPARATOR)  //replace all \
	return name
}



function file_dirname(filename){
    var splits = filename.split(PATH_SEPARATOR);
    if(splits.length==1)
        return ''
    else{
        splits.pop(-1);
        return splits.join(PATH_SEPARATOR);
    }
}

function file_basename(filename){
    var splits = filename.split(PATH_SEPARATOR);
    return splits.pop(-1)
}


function group_filenames_by_dirname(filenames){
    var result = {}
    for(var f of filenames){
        var dirname = file_dirname(f)
        if (dirname in result)
            result[dirname].push(f);
        else
            result[dirname] = [f];
    }
    return result;
}