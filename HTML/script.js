
global = {
  input_files : {},      //{"banana.JPG": FILE}  //FILE see below
  cancel_requested : false,

  KNOWN_POLLENSPECIES : ['Alnus', 'Betula', 'Corylus', 'Lycopodium', 'Fagus', 'Pinus', 'Secale'],
};


const FILE = {name: '',
              file: undefined,    //javascript file object
              results: {},        //RESULT see below
              processed: false,
              imagesize: [],
};

const RESULT = { prediction: {},      //{label:score}
                 custom:     '',
                 selected:    0,      //index of the selected label in prediction, if -1 then custom
                 box:         [0,0,1,1],
                 loconf:      false   //whether or not the prediction is considered low confidence
};










//updates the ui accordion table
function update_inputfiles_list(){
  var $filestable = $('#filetable');
       $filestable.find('tbody').html('');
  for(var f of Object.values(global.input_files)){
      $("#filetable-item-template").tmpl([{filename:f.name}]).appendTo($filestable.find('tbody'));
      update_per_file_results(f.name);
  }
}


function update_file_counter(){
  var $label = $("#file-counter-label")
  var count  = Object.keys(global.input_files).length;
  $label.text(`Loaded Files (${count})`)
}


//replaces the old global.input_files with a new list of files, updates ui
function set_input_files(files){
  //global.input_files = {};
  for(var f of files){
    f = rename_file(f, full_filename(f))
    global.input_files[f.name] = Object.assign({}, deepcopy(FILE), {name: f.name, file: f});
  }
  update_inputfiles_list();
  update_file_counter()
}

//called when user selects input file(s)
function on_inputfiles_select(input){
  set_input_files(input.target.files);
  input.value = ""; //reset the input
}

//called when user selects an input folder
function on_inputfolder_select(input){
  var files = [];
  for(var f of input.files)
    if(f.type.startsWith('image'))
        files.push(f);
  set_input_files(files);
  input.value = ""; //reset the input
}

//called when user selects "Clear Loaded Files" in the File menu
function on_clear_files(){
  global.input_files = {};
  update_inputfiles_list();
  reset_lowconfidence_section()
  update_file_counter()
}


//returns the label (maybe custom) that is has the corresponding checkbox set in the resultdetailsbox
function get_selected_label(x){
  return (x.selected>=0)? Object.keys(x.prediction)[x.selected] : x.custom;
}

function get_selected_label_and_confidence(x){
  if(x.selected>=0){
    return {
      label:Object.keys(x.prediction)[x.selected], 
      confidence:Object.values(x.prediction)[x.selected]
    }
  } else {
    return {label:x.custom, confidence:undefined}
  }
}

//returns all selected labels for a file, filtering ''/nonpollen
function get_selected_labels(filename, filter_nonpollen=true){
  var results = global.input_files[filename].results;
  var selectedlabels = Object.values(results).map(get_selected_label);
  if(filter_nonpollen)
    selectedlabels = selectedlabels.filter(Boolean);
  return selectedlabels;
}

//returns all selected labels for a file as html elements
function get_selected_labels_html(filename){
  var results = global.input_files[filename].results;
  var selectedlabels = []
  for(var r of Object.values(results)){
    var lc = get_selected_label_and_confidence(r)
    var is_lowconf = (lc.confidence < 0.7)             //FIXME: hardcoded threshold
    if(lc.label=='')
      if(is_lowconf)
        lc.label = 'Nonpollen'
      else
        continue;   //don't display if high conf
    
    var confidence_str = (lc.confidence!=undefined)? `(${ (lc.confidence*100).toFixed(0) }%)` : '';
    var full_str       = `${lc.label} ${confidence_str}`
    //make bold if confidence is high or manually selected
    if(!is_lowconf || lc.confidence==undefined)
      full_str = `<b>${full_str}</b>`
    selectedlabels.push(full_str)
  }
  return selectedlabels;
}

//returns a list of all label classes that have been detected or manually annotated
function get_set_of_all_labels(){
  var all_labels = [];
  for(var f of Object.values(global.input_files)){
    for(var r of Object.values(f.results)){
      all_labels = all_labels.concat(Object.keys(r.prediction));
      all_labels.push(r.custom);
    }
  }

  return Array.from(new Set(all_labels)).filter( x => { return !!$.trim(x); } );
}



//refresh the ui table for one file
function update_per_file_results(filename){
  var results   = global.input_files[filename].results;
  var processed = global.input_files[filename].processed

  //display only the labels marked as selected in the main table
  var selectedlabels = [];
  if(!processed)
  {  /*do nothing*/  }
  else if(Object.keys(results).length==0)
    //show a - to indicate that no objects at all were detected
    selectedlabels = ["-"];
  else{
    //selectedlabels = get_selected_labels(filename);
    selectedlabels = get_selected_labels_html(filename);
    if(selectedlabels.length==0){
      //all detected objects are classified as nonpollen
      selectedlabels = ["-"];
    }
  }
  $(`[id="detected_${filename}"]`).html(selectedlabels.join(', '));

  //make the filename bold to indicate that the file has been processed
  $(`.ui.title[filename="${filename}"]`).find('label').css('font-weight', (processed)?'bold':'normal');
}


//remove prediction from global data and update ui
function remove_prediction(filename, index){
  delete global.input_files[filename].results[index];
  //remove all result-details boxes (one in the filelist and maybe one in low-confidence list)
  $(`.result-details[filename="${filename}"][index="${index}"]`).detach();
  //update the detected pollen in the filelist table
  update_per_file_results(filename, true);
  remove_box_overlay(filename, index);
}

//callback when the user clicks on the remove button in a result box
function on_remove_prediction(e){
  //get the filename
  var filename = $(e.target).closest('[filename]').attr('filename');
  //get the index of prediction within the file
  var index = $(e.target).closest('[index]').attr('index');

  remove_prediction(filename, index);
}


function set_custom_label(filename, index, label){
  global.input_files[filename].results[index].custom   = label;
  global.input_files[filename].results[index].selected = -1;

  update_per_file_results(filename, true);
  update_boxlabel(filename, index);
}

//callback when the user enters into the custom label input in a result box
function on_custom_label_input(e){
  //get the filename
  var filename = $(e.target).closest('[filename]').attr('filename');
  //get the index of prediction within the file
  var index = $(e.target).closest('[index]').attr('index');
  set_custom_label(filename, index, e.target.value);
  e.target.focus();
}


//new prediction, either automatically detected or manually added
function add_new_prediction(filename, prediction, box, flag, i, customlabel=undefined){
  //sort labels by probability
  var prediction = sortObjectByValue(prediction);
  var selection  = Object.keys(prediction).length>0? 0 : -1;
  var result     = {prediction:prediction, custom:'', selected:selection, box:box, loconf:flag};
  global.input_files[filename].results[i] =  result;


  if(customlabel != undefined){
    //set the custom label in the input
    set_custom_label(filename, i, customlabel);
  }

  //add box overlay
  add_box_overlay(filename, box, i);
}


function remove_all_predictions_for_file(filename){
  for(var i in global.input_files[filename].results)
    remove_prediction(filename, i);
  set_processed(filename, false);
}

//sends an image to flask and initiates automatic prediction
function process_file(filename){
  upload_file_to_flask('file_upload', global.input_files[filename].file);
  //send a processing request to python update gui with the results
  return $.get(`/process_image/${filename}`).done(function(data){
      remove_all_predictions_for_file(filename);
      for(var i in data.labels)
          //add_new_prediction(filename, data.labels[i], data.boxes[i], data.flags[i], i);
          add_new_prediction(filename, data.labels[i], data.boxes[i], false, i);
      global.input_files[filename].imagesize = data.imagesize;

      set_processed(filename);
      //delete image from flask cache
      delete_image(filename);
    });
}

//sets the global.input_files[x].processed variable and updates view accordingly
function set_processed(filename){
  global.input_files[filename].processed=true;
  //refresh gui
  update_per_file_results(filename);
}


//sends command to flask to delete an image from the temporary folder (images can be large)
function delete_image(filename){
  $.get(`/delete_image/${filename}`);
}


//creates all ui elements in an accordion item
function maybe_create_filelist_item_content(filename){
  var $contentdiv = $(`.content[filename="${filename}"]`);
  if($contentdiv[0].innerHTML.trim())
    //UI already created
    return;
  
  var file = global.input_files[filename].file;
  return upload_file_to_flask('file_upload', file, async=true).done(function(response) {
    $contentdiv.html('');
    var time    = new Date().getTime()
    var content = $("#filelist-item-content-template").tmpl([{filename:file.name, time:time}]);
    content.appendTo($contentdiv);
    content.find('img').one('load', on_image_load_setup_slider);

    //this file might already have results (from loaded json annotations)
    var results = global.input_files[filename].results;
    for(i of Object.keys(results))
      //re-add prediction to update ui
      if(results[i].selected<0)
        add_custom_box(filename, results[i].box, results[i].custom, i, already_uploaded=true);
      else
        add_new_prediction(filename, results[i].prediction, results[i].box, false, i, undefined);
  });
}

//called when user clicks on a table row to open the accordion item
//uploads image to flask, creates accordion ui item
function on_accordion_open(){
  var filename = this.find('[filename]').attr('filename');
  var maybe_promise = maybe_create_filelist_item_content(filename);

  //scroll to the top of the image/table row
  var $trow = $(`tr.ui.title[filename="${filename}"]`)
  if(maybe_promise != undefined){
    maybe_promise.then( () => {
      var $img = $(`td.ui.content[filename="${filename}"] img`) 
      $img.one('load', () => $('html, body').animate({scrollTop:$trow.offset().top}, 250));
    })
  } else {
    //$('html, body').animate({scrollTop:$trow.offset().top}, 250); //needs a timeout for some reason
    setTimeout( () => { $('html, body').animate({scrollTop:$trow.offset().top}, 250);}, 1);
  }

  //preload next item
  setTimeout( () => {
    var filenames     = Object.keys(global.input_files)
    var index         = filenames.indexOf(filename);
    if(index+1 < filenames.length){
      var next_filename = filenames[index+1];
      maybe_create_filelist_item_content(next_filename);
    }
  }, 200 );
}

//called when user clicks on the "process" button of a single image
function on_process_image(e){
  var filename = $(e.target).closest('[filename]').attr('filename');
  process_file(filename);
}

//called when user clicks on the "process all" button
function process_all(){
  var $button = $('#process-all-button')

  var j=0;
  async function loop_body(){
    if(j>=Object.values(global.input_files).length || global.cancel_requested ){
      $button.html('<i class="play icon"></i>Process All Images');
      $('#cancel-processing-button').hide();
      return;
    }
    $('#cancel-processing-button').show();
    $button.html(`Processing ${j}/${Object.values(global.input_files).length}`);

    var f = Object.values(global.input_files)[j];
    if(!f.processed)
      await process_file(f.name);

    j+=1;
    setTimeout(loop_body, 1);
  }
  global.cancel_requested = false;
  setTimeout(loop_body, 1);  //using timeout to refresh the html between iterations
}

//called when user clicks on "cancel processing" button
function cancel_processing(){
  global.cancel_requested = true;
}



//callback from the plus-icon in the upper right corner of an image
function on_add_custom_box_button(e){
  $etarget = $(e.target)
  var $image_container = $etarget.closest('[filename]').find('.image-container')
  var filename         = $etarget.closest('[filename]').attr('filename');

  if(!$etarget.hasClass('active')){
    activate_custom_box_drawing_mode(filename);
  }else{
    deactivate_custom_box_drawing_mode(filename);
  }
  e.stopPropagation();
}


//called after drawing a new box
function add_custom_box(filename, box, label=undefined, index=undefined, already_uploaded=false){
  //clip
  for(var i in box) box[i] = Math.max(Math.min(1,box[i]),0)


  if(index==undefined)
    var index = 1000+Math.max(0, Math.max(...Object.keys(global.input_files[filename].results)) +1);
  add_new_prediction(filename, {}, box, false, index, label);
  update_per_file_results(filename);
  set_processed(filename);
}


//read a json annotation file and set them as predictions
function load_annotations_from_file(jsonfile, imagefilename){
  var reader = new FileReader();
  reader.onload = async function(){
    var text = reader.result;
    var data = JSON.parse(text);
    if(data.shapes.length>0){
      var imagesize = await read_imagesize_from_tiff(global.input_files[imagefilename].file);
      var height    = imagesize.height;
      var width     = imagesize.width;
    }
    for(var i in data.shapes){
      var box       = data.shapes[i].points;
          box       = [box[0][1]/height, box[0][0]/width, box[1][1]/height, box[1][0]/width];
      var label      = data.shapes[i].label;
      var result     = {prediction:{}, custom:label, selected:-1, box:box, loconf:false};
      global.input_files[imagefilename].results[i] =  result;

      var $contentdiv = $(`.content[filename="${imagefilename}"]`);
      if($contentdiv[0].innerHTML.trim()){
        //image already loaded, add box overlays
        add_custom_box(imagefilename, box, label, i, already_uploaded=true);
      }

    }
    set_processed(imagefilename);
  };
  reader.readAsText(jsonfile);
}

//called when user selects json annotation files
async function on_external_annotations_select(ev){
  for(f of ev.target.files){
    read_imagename_from_json(f);
    var basename = strip_file_extension(f.name);
    //match annotation files with input files
    for(var inputfilename of Object.keys(global.input_files)){
      if(basename == strip_file_extension(file_basename(inputfilename)) ){
        load_annotations_from_file(f, inputfilename);
      }
    }
  }
}


//
