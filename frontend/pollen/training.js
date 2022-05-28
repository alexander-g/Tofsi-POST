

PollenTraining = class extends BaseTraining {
    //override
    static refresh_table(){
        super.refresh_table()

        
        const train_det = $('#train-detector-checkbox').checkbox('is checked')
        const train_cls = $('#train-classifier-checkbox').checkbox('is checked')

        $('table#detector-classes').toggle(train_det)
        $('table#classifier-classes').toggle(train_cls)
        this.on_show_class_selection()
    }

    //dummy override: all selected
    static get_selected_files(){
        return Object.keys(GLOBAL.files)
    }

    static collect_selected_classes(){
        const filenames = this.get_selected_files()
        const labels    = filenames.map( f => GLOBAL.files[f].results.labels ).flat()
        const uniques   = [...(new Set(labels))].sort()
        const counts    = uniques.map( l => labels.filter( x => x==l ).length )
        return [uniques, counts]
    }

    static refresh_classifier_classes_table(){
        const [classes, counts]  = this.collect_selected_classes()

        //TODO: code re-use
        const coi_selected = $('#classes-of-interest-dropdown').dropdown('get value').split(',')
        const oth_selected = $('#other-classes-dropdown').dropdown('get value').split(',')
        const unk_selected = $('#unknown-classes-dropdown').dropdown('get value').split(',')
        const coi_ixs      = Object.keys(classes).filter( i => coi_selected.includes(classes[i].toLowerCase()) )
        const oth_ixs      = Object.keys(classes).filter( i => oth_selected.includes(classes[i].toLowerCase()) )
        const unk_ixs      = Object.keys(classes).filter( i => unk_selected.includes(classes[i].toLowerCase()) )

        const $table       = $('table#classifier-classes tbody')
        $table.html('')
        for(const i of coi_ixs){
            console.log(classes[i], counts[i])
            $(`<tr>
                <td>${classes[i]}</td>
                <td>${counts[i] }</td>
            </tr>`).appendTo($table)
        }
        const coi_count    = coi_ixs.map( i => counts[i] ).reduce( (a,b) => a+b, 0 )
        const oth_count    = oth_ixs.map( i => counts[i] ).reduce( (a,b) => a+b, 0 )
        const unk_count    = unk_ixs.map( i => counts[i] ).reduce( (a,b) => a+b, 0 )
        const rej_count    = counts.reduce( (a,b) => a+b, 0 ) - coi_count - oth_count - unk_count;
        $('#classes-of-interest-count').text(coi_count)
        $('#other-classes-count').text(oth_count)
        $('#unknown-classes-count').text(unk_count)
        $('#rejected-classes-count').text(rej_count)

        $('#detector-positive-classes-count').text(coi_count+oth_count+unk_count)
        $('#detector-negative-classes-count').text(rej_count)
    }

    static on_show_class_selection() {
        const $modal   = $('#class-selection-modal')
        
        const callback = (_ => this.refresh_class_selection())
        $('#classes-of-interest-dropdown').dropdown({onChange:  callback})
        $('#other-classes-dropdown').dropdown({onChange: callback })
        $('#unknown-classes-dropdown').dropdown({onChange: callback })
        this.refresh_class_selection()

        $modal.modal('show')
    }

    static refresh_class_selection() {
        const classes = this.collect_selected_classes()[0]         //TODO: + species known to model but not in selected files  + not selected

        const coi_selected = $('#classes-of-interest-dropdown').dropdown('get value').split(',')
        const oth_selected = $('#other-classes-dropdown').dropdown('get value').split(',')
        const unk_selected = $('#unknown-classes-dropdown').dropdown('get value').split(',')
        const any_selected = [...coi_selected, ...oth_selected, ...unk_selected]
        const rejected     = classes.filter( s => !any_selected.includes(s.toLowerCase()) )
        
        const $coi_list     = $('#classes-of-interest-list')
        $coi_list.html('')
        rejected.map( s => $(`<div class="item">${s}</div>`).appendTo($coi_list) )

        const $oth_list     = $('#other-classes-list')
        $oth_list.html('')
        rejected.map( s => $(`<div class="item">${s}</div>`).appendTo($oth_list) )

        const $unk_list     = $('#unknown-classes-list')
        $unk_list.html('')
        rejected.map( s => $(`<div class="item">${s}</div>`).appendTo($unk_list) )


        const $rejectedlist = $('#rejected-classes-list')
        $rejectedlist.html('')
        rejected.map( s => $(`<div class="ui label">${s}</div>`).appendTo($rejectedlist) )

        this.refresh_classifier_classes_table()
    }

/*
    //override
    static upload_training_data(filenames){
        //TODO: show progress
        const model_type      = $('#training-model-type').dropdown('get value');
        //refactor
        const attrname        = {cells:'cell_results', treerings:'treering_results'}[model_type]
        const files           = filenames.map( k => GLOBAL.files[k] )
        const targetfiles     = files.map(
            f => {
                let targetf = f[attrname][model_type=='cells'? 'cells' : 'segmentation']  //FIXME: ugly
                //standardize file name
                    targetf = rename_file(targetf, `${f.name}.${model_type}.png`)
                return targetf;
            }
        )

        const promises = files.concat(targetfiles).map( f => upload_file_to_flask(f) )
        return Promise.all(promises).catch( this.fail_modal )
    }

    //override
    static get_training_options(){
        const training_type      = $('#training-model-type').dropdown('get value');
        return {training_type: training_type};
    }

    //override
    static update_model_info(){
        const model_type  = $('#training-model-type').dropdown('get value');
        if(!model_type)
            return;
        
        super.update_model_info(model_type)
    }
*/
}

