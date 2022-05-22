

ZStackSlider = class {
    //set up z-stack layer selection slider
    static setup_slider(filename){
        const $root   = $(`[filename="${filename}"]`);

        //show and resize the layer selection slider
        const $slider = $root.find('.ui.slider');
        $slider.slider({
            min:0, max:5, 
            onChange: _ => this.on_slider_change($slider)
        });

        //a popup to display the current layer
        $slider.popup({
            position: 'left center',
            content:  'Fused Layers',
            hoverable: true,
            closable:  false,
            target:    $slider.find('.thumb'),
        });
        //cosmetic changes
        $slider.find('.track-fill').remove();
        //change event listener
        $slider.on("wheel", this.on_mousewheel);
    }

    static on_mousewheel(ev){
        ev = ev.originalEvent;
        ev.preventDefault();

        var $slider       = $(ev.target).closest('[filename]').find('.ui.slider');
        var current_value = $slider.slider('get value');
        var direction     = Math.sign(ev.deltaY);
        $slider.slider('set value', current_value+direction);

        //update popup position
        //$slider.popup('reposition');
    }

    static on_slider_change($slider){
        var level = $slider.slider('get value');

        var $container = $slider.closest('[filename]');
        var filename   = $container.attr('filename');
        var $img       = $container.find('.image-container').find('img');
        var time       = new Date().getTime()
        var new_src    = (level==0)? `/images/${filename}.jpg?_=${time}` : `/images/${filename}.layer${level-1}.jpg?_=${time}`;      //TODO: url_for_image()
        fetch(new_src).then(async function(response){
            if(response.ok){
                $img.attr('src', URL.createObjectURL(await response.blob()));
            }
        })

        var popup_text = (level==0)? 'Fused Layers' : `Layer ${level}`;
        $slider.popup('change content', popup_text);
        $slider.popup('reposition');
        
    }
}


