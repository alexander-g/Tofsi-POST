

ZStackSlider = class {
    //set up z-stack layer selection slider
    static setup_slider(filename){
        const $root   = $(`[filename="${filename}"]`);
        
        $root.find('img.input-image').one('load', async () =>{
            //show and resize the layer selection slider
            const file    = GLOBAL.files[filename]
            const n_pages = (await GLOBAL.App.ImageLoading.load_tiff_pages(file))[0].length   //XXX: not ideal: file is read twice
            const $slider = $root.find('.ui.slider');
            $slider.slider({
                min:      -1,
                max:      n_pages-1,
                start:    -1,
                onChange: _ => this.on_slider_change($slider)
            });

            //a popup to display the current layer
            /*$slider.popup({
                position: 'left center',
                content:  'Fused Layers',
                hoverable: true,
                closable:  false,
                target:    $slider.find('.thumb'),
            });*/
            //cosmetic changes
            $slider.find('.track-fill').remove();
            //change event listener
            //$slider.on("wheel", this.on_mousewheel);
            $root.find('.view-menu, .view-menu-button').on("wheel", this.on_mousewheel);
        }) 
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
        return false;
    }

    static async on_slider_change($slider){
        let   level      = $slider.slider('get value');
              level      = (level==-1)? 'fused' : level;

        const $container = $slider.closest('[filename]');
        const filename   = $container.attr('filename');
        const $img       = $container.find('img.input-image')

        const file       = GLOBAL.files[filename]
        const blob       = await GLOBAL.App.ImageLoading.load_tiff_file(file, level)
        GLOBAL.App.ImageLoading.set_image_src($img, blob)

        const header_text = `Z-Stack Layer: ${ (level=='fused')? 'Fused' : (level+1)}`;
        $container.find('.zstack-header').text(header_text)
    }
}


