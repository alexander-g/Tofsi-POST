

PollenBoxes = class extends BaseBoxes {

    //override
    static get_set_of_all_labels() {
        let all_labels = []
        for(const f of Object.values(GLOBAL.files)){
            all_labels = all_labels.concat(f.results.labels)
        }
        let uniques = new Set(all_labels)
            uniques.delete('')
            uniques.delete(GLOBAL.App.NEGATIVE_CLASS)
        return [GLOBAL.App.NEGATIVE_CLASS].concat([...uniques].sort())
    }
}
