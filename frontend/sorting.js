

//called when user clicks on "Filename" column head
function on_sort_by_filename(e){
    var $col      = $(e.target);
    var direction = $col.hasClass('ascending')? 'descending' : 'ascending';
    _clear_sorted()
    $col.addClass(['sorted', direction]);

    var filenames = Object.keys(global.input_files).sort()
    if(direction=='descending')
        filenames = filenames.reverse()
    
    set_new_file_order(filenames)
}

//called when user clicks on "Flags" column head
function on_sort_by_confidence(e){
    var $col      = $(e.target);
    var direction = $col.hasClass('ascending')? 'descending' : 'ascending';
    _clear_sorted()
    $col.addClass(['sorted', direction]);

    var filenames   = Object.keys(global.input_files)
    var resultlists = filenames.map(f => Object.values(global.input_files[f].results))
    var confidences = resultlists.map( rlist => rlist.map( r => get_selected_label_and_confidence(r).confidence ))
    //lowest confidence level per filename
    var worstconf  = confidences.map( x => x.reduce( (x,carry) => Math.min(x, carry), 100 ) )
        worstconf  = worstconf.map( x => isNaN(x)? 100 : x )  //NaN occurs when label was manually set
    
    //sort by the lowest confidence
    var order       = arange(worstconf.length).sort( (a,b) => (worstconf[b] - worstconf[a]) )
    filenames       = order.map(i => filenames[i]);
    if(direction=='ascending')
        filenames = filenames.reverse()

    set_new_file_order(filenames)
}


function set_new_file_order(filenames){
    var rows = filenames.map( f => $(`#filetable tr[filename="${f}"]`) );
    $('#filetable tbody').append(rows);
    global.input_files = sortObject(global.input_files, filenames);
}


function _clear_sorted(){
    $('#filetable .sorted').removeClass(['sorted', 'ascending', 'descending']);
}


