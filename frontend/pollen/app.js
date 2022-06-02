
PollenApp = class extends BaseApp {
    static Detection     =    PollenDetection;
    static Download      =    PollenDownload;
    static FileInput     =    PollenFileInput;
    static Boxes         =    PollenBoxes;
    static Training      =    PollenTraining;
    static Sorting       =    PollenSorting;
    static ImageLoading  =    PollenImageLoading;
}


//override
GLOBAL.App = PollenApp


PollenResults = class {
    predictions = []                 // [{'species' : confidence}, ...]
    boxes       = []                 // [[y0,x0,y1,x1], ...]
    labels      = [];                // ['selected species', ...]

    constructor(predictions, boxes){
        this.boxes       = boxes
        this.predictions = predictions.map(sort_object_by_value)
        this.labels      = this.predictions.map(p => Object.keys(p)[0])
    }
}


function sort_object_by_value(o) {
    return Object.keys(o).sort(function(a,b){return o[b]-o[a]}).reduce((r, k) => (r[k] = o[k], r), {});
}
