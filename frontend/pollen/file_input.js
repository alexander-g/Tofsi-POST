
PollenFileInput = class extends BaseFileInput{

    //override
    static match_resultfile_to_inputfile(inputfilename, resultfilename){
        var basename          = file_basename(resultfilename)
        const no_ext_filename = remove_file_extension(inputfilename)
        const candidate_names = [
            inputfilename+'.json', no_ext_filename+'.json',
        ]
        return (candidate_names.indexOf(basename) != -1)
    }
    
    //override
    static async load_result(filename, resultfiles){
        const promise = new Promise(async (resolve, reject) => {
            const reader  = new FileReader();
            reader.onload = async function(){
                const text = reader.result;
                const data = JSON.parse(text);

                let results = {labels:[], boxes:[]}
                for(const i in data.shapes){
                    results.labels.push( {[data.shapes[i].label]:1.0} )
                    results.boxes.push( data.shapes[i].points.flat() )
                }
                
                GLOBAL.App.Detection.set_results(filename, results)
                resolve()
            };
            const resultfile = resultfiles[0]
            const blob       = await(resultfile.async? resultfile.async('blob') : resultfile)
            reader.readAsText(blob);
        })
        return promise;
    }
    
}  //end PollenFileInput

