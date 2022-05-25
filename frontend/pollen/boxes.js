

PollenBoxes = class extends BaseBoxes {
    //override
    static get_set_of_all_labels() {
        let all_labels = []
        for(const f of Object.values(GLOBAL.files)){
            all_labels = all_labels.concat(f.results.labels)
        }
        return [...(new Set(all_labels))].sort()
    }
}
