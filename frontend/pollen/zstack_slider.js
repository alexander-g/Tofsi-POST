

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

    static async on_slider_change($slider){
        const level      = $slider.slider('get value');

        const $container = $slider.closest('[filename]');
        const filename   = $container.attr('filename');
        const $img       = $container.find('img.input-image')

        const file       = GLOBAL.files[filename]
        const blob       = await load_tiff_file(file, level-1)
        set_image_src($img, blob)

        const popup_text = (level==0)? 'Fused Layers' : `Layer ${level}`;
        $slider.popup('change content', popup_text);
        $slider.popup('reposition');
        
    }
}


