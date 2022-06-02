//TODO: hardcoded
const KNOWN_POLLENSPECIES = ['Alnus', 'Betula', 'Carpinus', 'Corylus', 'Lycopodium', 'Fagus', 'Pinus', 'Pinus Halbe', 'Secale', 'Quercus', 'Wildgras']

PollenTraining = class extends BaseTraining {
    //override
    static refresh_table(){
        super.refresh_table()

        
        const train_det = $('#train-detector-checkbox').checkbox('is checked')
        const train_cls = $('#train-classifier-checkbox').checkbox('is checked')

        $('table#detector-classes').toggle(train_det)
        $('table#classifier-classes').toggle(train_cls)

        const callback = (_ => this.refresh_class_selection())
        $('#classes-of-interest-dropdown').dropdown({onChange: callback})
        $('#other-classes-dropdown').dropdown(      {onChange: callback})
        $('#unknown-classes-dropdown').dropdown(    {onChange: callback})
        this.refresh_class_selection()
    }

    //dummy override: all files selected
    static get_selected_files(){
        return Object.keys(GLOBAL.files)
    }

    static collect_class_counts(){
        const filenames = this.get_selected_files()
        const labels    = filenames
                          .map( f => GLOBAL.files[f].results?.labels )
                          .filter(Boolean)
                          .flat()
                          .map( l => l.trim() || 'Nonpollen' )
        let   label_set = new Set(labels)
        const known_classes = GLOBAL.App.Settings.get_properties_of_active_model()?.['known_classes'] ?? []
        known_classes.map(c => label_set.add(c))
        const uniques   = [...(label_set)].sort()
        const counts    = uniques.map( l => labels.filter( x => x==l ).length )
        return [uniques, counts]
    }

    static get_class_selection(){
        const all_classes  = this.collect_class_counts()[0]
        const coi_selected = $('#classes-of-interest-dropdown').dropdown('get value').split(',')
        const oth_selected = $('#other-classes-dropdown').dropdown('get value').split(',')
        const unk_selected = $('#unknown-classes-dropdown').dropdown('get value').split(',')
        const any_selected = [...coi_selected, ...oth_selected, ...unk_selected]
        const rejected     = all_classes.filter( s => !any_selected.includes(s.toLowerCase()) )

        return [coi_selected, oth_selected, unk_selected, rejected]
    }

    static refresh_class_count_table(){
        const [classes, counts]  = this.collect_class_counts()

        const [coi_selected, oth_selected, unk_selected, _rejected] = this.get_class_selection()
        const coi_ixs      = Object.keys(classes).filter( i => coi_selected.includes(classes[i].toLowerCase()) )
        const oth_ixs      = Object.keys(classes).filter( i => oth_selected.includes(classes[i].toLowerCase()) )
        const unk_ixs      = Object.keys(classes).filter( i => unk_selected.includes(classes[i].toLowerCase()) )

        const $table       = $('table#classifier-classes tbody')
        $table.html('')
        for(const i of coi_ixs){
            //console.log(classes[i], counts[i])
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


    static refresh_class_selection() {
        const [coi_selected, oth_selected, unk_selected, rejected] = this.get_class_selection()
        
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

        this.refresh_class_count_table()
    }


    //override
    static upload_training_data(filenames){
        //TODO: show progress
        const files           = filenames.map( k => GLOBAL.files[k] )
        const targetfiles     = files.map(
            f => GLOBAL.App.Download.build_annotation_jsonfile(f.name, f.results)
        )

        const promises = files.concat(targetfiles).map( f => upload_file_to_flask(f) )
        return Promise.all(promises).catch( this.fail_modal )
    }

    //override
    static get_training_options(){
        const [coi_selected, oth_selected, unk_selected, rejected] = this.get_class_selection()

        return {
            classes_of_interest : coi_selected,
            classes_other       : oth_selected,
            classes_unknown     : unk_selected,
            classes_nonpollen   : rejected,
            train_detector      : $('#train-detector-checkbox').checkbox('is checked'),
            train_classifier    : $('#train-classifier-checkbox').checkbox('is checked'),
            learning_rate       : Number($('#training-learning-rate')[0].value),
            epochs              : Number($('#training-number-of-epochs')[0].value),
        };
    }

}

