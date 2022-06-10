
PollenApp = class extends BaseApp {
    static Detection     =    PollenDetection;
    static Download      =    PollenDownload;
    static FileInput     =    PollenFileInput;
    static Boxes         =    PollenBoxes;
    static Training      =    PollenTraining;
    static Sorting       =    PollenSorting;
    static ImageLoading  =    PollenImageLoading;

    static NEGATIVE_CLASS = 'Nonpollen'
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

