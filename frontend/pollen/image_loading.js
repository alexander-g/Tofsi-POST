

PollenImageLoading = class extends BaseImageLoading {
    //override
    static async load_tiff_file(file, page_nr = 'fused'){
        if(page_nr == 'fused'){
            await upload_file_to_flask(file, 'file_upload')
            return $.get(`/fused_image/${file.name}`)
        } else {
            return super.load_tiff_file(file, page_nr)
        }
    }
}

