


function add_box_overlay(filename, box, index){
    var label    = get_selected_label(global.input_files[filename].results[index])
    if(label.length==0)
        label = 'Nonpollen';
    var $overlay = $("#box-overlay-template").tmpl( [ {box:box, index:index, label:label} ] );
    $overlay.find('p').popup({'html':tooltip_text(filename, index)});
    var $parent  = $(`div[filename="${filename}"]`).find('.image-container');
    $parent.append($overlay);

    $overlay.hover(on_box_hover_in, on_box_hover_out);

    function stop_drag(){
        $(document).off('mousemove');
        $(document).off('mouseup');

        var H = $parent.height(), W = $parent.width();
        var y0     = Math.max(0, $overlay.position()['top']/H)
        var x0     = Math.max(0, $overlay.position()['left']/W)
        var y1     = Math.min(1, ($overlay.position()['top']  + $overlay.outerHeight())/H );
        var x1     = Math.min(1, ($overlay.position()['left'] + $overlay.outerWidth())/W );

        //global.input_files[filename].results[index].box = [x0,y0,x1,y1];  //incorrect ordering
        global.input_files[filename].results[index].box = [y0,x0,y1,x1];

        $overlay.css({
            'width' : '',
            'height': '',
            'top'   : y0*100 + '%',
            'left'  : x0*100 + '%',
            'bottom': 100 - y1*100 + '%',
            'right' : 100 - x1*100 + '%',
        })
    }
    
    $overlay.find('.move-anchor').on('mousedown', function(e){
        var click_y   = e.pageY;
        var click_x   = e.pageX;
        var overlay_y = $overlay.position()['top'];
        var overlay_x = $overlay.position()['left'];
        //make sure height/width are fixed
        $overlay.css('height', $overlay.css('height'));
        $overlay.css('width',  $overlay.css('width'));

        $(document).on('mousemove', function(e) {
            if( (e.buttons & 0x01)==0 ){
                stop_drag();
                return;
            }
            $overlay.css({
                'top':  overlay_y + (e.pageY - click_y), 
                'left': overlay_x + (e.pageX - click_x), 
              });
        }).on('mouseup', function(e) {
            stop_drag();
        });
        return false; //stop event propagation
    })

    $overlay.find('.resize-anchor').on('mousedown', function(e){
        var click_y   = e.pageY;
        var click_x   = e.pageX;
        var overlay_h = $overlay.outerHeight();
        var overlay_w = $overlay.outerWidth();

        $(document).on('mousemove', function(e) {
            if( (e.buttons & 0x01)==0 ){
                stop_drag();
                return;
            }
            $overlay.css({
                'height': overlay_h + (e.pageY - click_y), 
                'width':  overlay_w + (e.pageX - click_x), 
              });
        }).on('mouseup', function(e) {
            stop_drag();
        });
        return false; //stop event propagation
    })
}

function remove_box_overlay(filename, index){
    $overlay = $(`div[filename="${filename}"]`).find(`.box-overlay[index="${index}"]`);
    $overlay.remove();
}

//adds a callback to a result-details-box to highlight the corresponding box overlays on mouse hover
function add_box_overlay_highlight_callback($resultdetailsbox){
  var filename = $resultdetailsbox.attr('filename');
  var index    = $resultdetailsbox.attr('index');
  $resultdetailsbox.hover(
    function(){
       $(`div[filename="${filename}"]`).find(`.box-overlay[index=${index}]`).css('background-color', '#ffffff66'); },
    function(){ 
       $(`div[filename="${filename}"]`).find(`.box-overlay[index=${index}]`).css('background-color', '#ffffff00');});
}


function on_box_hover_in(ev){
    var $overlay = $(ev.target).closest('.box-overlay')
    $overlay.css('background-color', '#ffffff66');
    $overlay.find('.drag-anchor').show();
    $overlay.find('.red.close.icon').css('visibility', 'visible');
}

function on_box_hover_out(ev){
    var $overlay = $(ev.target).closest('.box-overlay')
    $overlay.css('background-color', '#ffffff00');
    $overlay.find('.drag-anchor').hide();
    $overlay.find('.red.close.icon').css('visibility', 'hidden');
}


function tooltip_text(filename, index){
    var prediction = global.input_files[filename].results[index].prediction;
    if(Object.keys(prediction).length==0)
        return ''
    var txt = '<b>Prediction:</b>';
    for(var label of Object.keys(prediction))
        txt += `<br/>${label? label:"Nonpollen"}: ${ (prediction[label]*100).toFixed(0) }%`
    return txt;
}


function register_box_draw($container, on_box_callback) {
    var $selection = $('<div>').css({"background": "transparent", 
                                     "position":   "absolute", 
                                     "border":     "1px dotted #fff"});

    $container.on('mousedown', function(e) {
        var click_y = e.pageY - $container.offset().top;
        var click_x = e.pageX - $container.offset().left;

        $selection.css({
          'top':    click_y,  'left':   click_x,
          'width':  0,        'height': 0
        });
        $selection.appendTo($container);

        function stop_drag(){
            $(document).off('mousemove');
            $(document).off('mouseup');
            $selection.remove();
            deactivate_custom_box_drawing_mode($container.closest('[filename]').attr('filename'));
        }

        //$container.on('mousemove', function(e) {
        $(document).on('mousemove', function(e) {
            if( (e.buttons & 0x01)==0 ){
                stop_drag();
                return;
            }

            var move_y = e.pageY - $container.offset().top,
                move_x = e.pageX - $container.offset().left,
                width  = Math.abs(move_x - click_x),
                height = Math.abs(move_y - click_y);

            var new_x = (move_x < click_x) ? (click_x - width)  : click_x;
            var new_y = (move_y < click_y) ? (click_y - height) : click_y;

            $selection.css({
              'width': width,  'height': height,
              'top':   new_y,  'left': new_x
            });
        }).on('mouseup', function(e) {
            var parent_box  = $container[0].getBoundingClientRect();
            var topleft     = $selection.position()
            var bottomright = [topleft.top + $selection.height(), topleft.left + $selection.width()];
            var bbox        = [topleft.top/parent_box.height,    topleft.left/parent_box.width,
                               bottomright[0]/parent_box.height, bottomright[1]/parent_box.width];
            
            stop_drag();
            on_box_callback(bbox);
        });
    });
}


function activate_custom_box_drawing_mode(filename){
    var $image_container = $(`[filename="${filename}"]`).find('.image-container')
    var $plusicon        = $(`[filename="${filename}"]`).find('.plus.icon')

    $plusicon.addClass('active');
    $plusicon.addClass('blue');
    register_box_draw($image_container, function(box){add_custom_box(filename, box, "???")});
    $image_container.find('img').css({'cursor':'crosshair'})
}

function deactivate_custom_box_drawing_mode(filename){
    var $image_container = $(`[filename="${filename}"]`).find('.image-container')
    var $plusicon        = $(`[filename="${filename}"]`).find('.plus.icon')

    $plusicon.removeClass('active');
    $plusicon.removeClass('blue');
    $image_container.off('mousedown');
    $image_container.off('mouseup');
    $image_container.find('img').css({'cursor':'default'})
}




function convert_label_into_input(e) {
    var $label = $(e.target)
    //activate dropdown
    $label.closest('.box-overlay').find('select.search').dropdown({
        allowAdditions: true, 
        hideAdditions:  false, 
        forceSelection: false, 
        selectOnKeydown: false,
        fullTextSearch:true,
        action: (t,v,el) => {  save(t); },
        onHide: ()=>{ save(); },
    });
    var $input = $label.closest('.box-overlay').find('.search.dropdown');
    $input.dropdown('setup menu', {
        //values: get_set_of_all_labels().concat(['Nonpollen']).sort().map( v => {return {name:v};} ),
        values: ['Nonpollen'].concat(get_set_of_all_labels().sort()).map( v => {return {name:v};} ),
    });
    $label.hide();
    $input.show();

    var save = function(txt=''){
        if(txt.length>0){
            //$label.text( txt );  //done in update_boxlabel via set_custom_label
            var filename = $label.closest('[filename]').attr('filename');
            var index    = $label.closest('[index]').attr('index');
            if(txt.toLowerCase()=='nonpollen')
                txt = '';
            set_custom_label(filename, index, txt);
        }
        
        $label.show();
        $input.hide();
      };
    
    $input.find('input').focus().select();
}


function update_boxlabel(filename, index){
    var label = get_selected_label(global.input_files[filename].results[index]);
    if(label=='')
        label = 'Nonpollen';
    
    $overlay = $(`[filename="${filename}"]`).find(`.box-overlay[index="${index}"]`)
    $overlay.find('p').text(label)
}