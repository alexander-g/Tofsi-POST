


//callback for image load event
//sets up z-stack layer selection slider
function on_image_load_setup_slider(event){
    var $image   = $(event.target);
    var $content = $image.closest('[filename]');
    //show and resize the layer selection slider
    var $slider   = $content.find('.ui.slider');
    $slider.slider({
               min:0, max:5, 
               onChange: function(){on_slider_change($slider);}
            });

    //a popup to display the current layer
    $slider.popup({
      position: 'right center',
      content:  'Fused Layers',
      hoverable: true,
      closable:  false,
      target:    $slider.find('.thumb'),
    });
    //cosmetic changes
    $slider.find('.track-fill').remove();
    //change event listener
    $slider.on("wheel", on_mousewheel);
    //$image.on("wheel", on_mousewheel); //gives errors
}


function on_mousewheel(ev){
    ev = ev.originalEvent;
    ev.preventDefault();

    var $slider       = $(ev.target).closest('[filename]').find('.ui.slider');
    var current_value = $slider.slider('get value');
    var direction     = Math.sign(ev.deltaY);
    $slider.slider('set value', current_value+direction);

    //update popup position
    $slider.popup('reposition');
}


function on_slider_change($slider){
    var level = $slider.slider('get value');

    var $container = $slider.closest('[filename]');
    var filename   = $container.attr('filename');
    var $img       = $container.find('.image-container').find('img');
    var time       = new Date().getTime()
    var new_src    = (level==0)? `/images/${filename}.jpg?_=${time}` : `/images/${filename}.layer${level-1}.jpg?_=${time}`;
    $img.attr('src', new_src);

    var popup_text = (level==0)? 'Fused Layers' : `Layer ${level}`;
    $slider.popup('change content', popup_text);
}
