
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
  $filestable = $('#filetable');
  $filestable.find('tbody').html('');
  for(f of Object.values(global.input_files)){
      $("#filetable-item-template").tmpl([{filename:f.name}]).appendTo($filestable.find('tbody'));
      update_per_file_results(f.name);
  }
}

//removes all ui items from the low-confidence section
function reset_lowconfidence_section(){
  $('#lowconfidence').find('.content').html('');
  $('#lowconfidence.accordion').accordion('close',0);
  update_number_of_lowconfidence_predictions();
}


//replaces the old global.input_files with a new list of files, updates ui
function set_input_files(files){
  global.input_files = {};
  for(f of files)
    global.input_files[f.name] = Object.assign({}, deepcopy(FILE), {name: f.name, file: f});
  update_inputfiles_list();
  reset_lowconfidence_section()
}

//called when user selects input file(s)
function on_inputfiles_select(input){
  set_input_files(input.target.files);
}

//called when user selects an input folder
function on_inputfolder_select(input){
  files = [];
  for(f of input.files)
    if(f.type.startsWith('image'))
        files.push(f);
  set_input_files(files);
}


//builds the box which contains the image patch, and label confidences
function build_result_details(filename, result, index){
  label_probabilities = result.prediction;
  resultbox = $("#result-details-template").tmpl([{filename:filename,
                                                   label:JSON.stringify(label_probabilities),
                                                   time:new Date().getTime(),
                                                   index:index}]);
  keys=Object.keys(label_probabilities);
  for(i in keys){
    lbl = keys[i];
    cbx = $("#checkbox-confidence-template").tmpl([{label: lbl? lbl : "Nonpollen",
                                                    index: i}]);
    cbx.find(".progress").progress({percent: label_probabilities[lbl]*100,
                                    showActivity: false, autoSuccess:false});
    cbx.removeClass('active');
    cbx.appendTo(resultbox.find(`table`));
  }
  //check the checkbox that is marked as selected in the result
  resultbox.find(`.checkbox[index="${result.selected}"]`).checkbox('set checked');
  resultbox.find('input[class="new-label"]').val(result.custom);

  //callback that makes sure that only one checkbox in the table is active
  resultbox.find('.checkbox').checkbox({onChange:function(){
    //find the corresponding rdbox(es), multiple because could be in low-confidence section
    $resultdetailsbox = $(`.result-details[filename="${filename}"][index="${index}"]`);
    $resultdetailsbox.find('.checkbox').checkbox('set unchecked');
    $resultdetailsbox.find('table').find('.checkbox').checkbox('set unchecked');
    checkboxindex     = $(this).parent().attr('index');
    $resultdetailsbox.find(`.checkbox[index=${checkboxindex}]`).checkbox('set checked');

    //update the global data
    global.input_files[filename].results[index].selected = checkboxindex;
    update_per_file_results(filename, true);
    console.log(filename + ":"+index + ":" + $(this).parent().attr('index'));
  }});

  add_box_overlay_highlight_callback(resultbox);

  return resultbox;
}

//returns the label (maybe custom) that is has the corresponding checkbox set in the resultdetailsbox
function get_selected_label(x){
  return (x.selected>=0)? Object.keys(x.prediction)[x.selected] : x.custom;
}

//returns all selected labels for a file, filtering ''/nonpollen
function get_selected_labels(filename){
  var results = global.input_files[filename].results;
  var selectedlabels = Object.values(results).map(get_selected_label);
  var selectedlabels = selectedlabels.filter(Boolean);
  return selectedlabels;
}

function get_set_of_all_selected_labels(){
  var all_labels = [];
  for(f in global.input_files)
    all_labels.push(...get_selected_labels(f));
  return new Set(all_labels);
}

function get_list_of_dropdown_label_suggestions(){
  var result = [];
  for(l of get_set_of_all_selected_labels())
    result.push({name:l});
  return result;
}


function update_number_of_lowconfidence_predictions(){
  var n = 0
  for(var file of Object.values(global.input_files))
    for(var result of Object.values(file.results))
      n+=result.loconf;

  $('#lowconfidence').find('.title').find('label').text(`${n} Low Confidence Predictions`)
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
    selectedlabels = get_selected_labels(filename);
    if(selectedlabels.length==0){
      //all detected objects are classified as nonpollen
      //indicated with a ?
      selectedlabels = ["?"];
    }
  }
  $(`[id="detected_${filename}"]`).html(selectedlabels.join(', '));

}


//remove prediction from global data and update ui
function remove_prediction(filename, index){
  delete global.input_files[filename].results[index];
  //remove all result-details boxes (one in the filelist and maybe one in low-confidence list)
  $(`.result-details[filename="${filename}"][index="${index}"]`).detach();
  //update the detected pollen in the filelist table
  update_per_file_results(filename, true);
  update_number_of_lowconfidence_predictions();
  remove_box_overlay(filename, index);
}

//callback when the user clicks on the remove button in a result box
function on_remove_prediction(e){
  //get the corresponding result details box
  $resultdetailbox = $(e.target).closest('.result-details')
  //get the filename
  filename = $resultdetailbox.attr('filename');
  //get the index of prediction within the file
  index = $resultdetailbox.attr('index');

  remove_prediction(filename, index);
}

//callback when user clicks on the accept button in a result box
function on_accept_prediction(e){
  $resultdetailbox = $(e.target).closest('.result-details')
  //get the filename
  filename = $resultdetailbox.attr('filename');
  //get the index of prediction within the file
  index = $resultdetailbox.attr('index');

  result   = global.input_files[filename].results[index];
  selected = result.selected;
  if(selected<0 || Object.keys(result.prediction).length==0){
    //custom label selected; remove predictions
    result.prediction = {};
  }else{
    //set the selected prediction to 1.0
    label = Object.keys(result.prediction)[selected];
    if(label==''){
      //label is nonpollen; remove
      remove_prediction(filename, index);
      return;
    }else{
      result.prediction = {};
      result.prediction[label]=1;
      result.selected=0;
    }
  }

  new_resultdetailbox = build_result_details(filename, result, index);
  $('#lowconfidence').find(`.result-details[filename="${filename}"][index="${index}"]`).detach();
  $(`.result-details[filename="${filename}"][index="${index}"]`).replaceWith(new_resultdetailbox);
  update_number_of_lowconfidence_predictions();
}

//callback, scrolls down to the row in the table that contains the file name and opens the accordion item
function on_goto_image(e){
  //this callback from "go to full image" button from the lowconf section
  $resultdetailbox = $(e.target).closest('.result-details')
  //get the filename
  filename = $resultdetailbox.attr('filename');
  //get the file row in the main table
  $trow    = $(`tr.ui.title[filename="${filename}"]`)
  $trow.click();                  //XXX: should be rather something like .accordion(open)
  $('html, body').animate({scrollTop:$trow.offset().top}, 250);
}



//callback when the user enters into the custom label input in a result box
function on_custom_label_input(e){
  //get the filename
  var filename = $(e.target).closest('[filename]').attr('filename');
  //get the index of prediction within the file
  var index = $(e.target).closest('[index]').attr('index');
  var $resultdetailbox = $(`.result-details[filename="${filename}"][index="${index}"]`);
  //update all related input fields (could be multiple)
  $resultdetailbox.find('[type="text"][class="new-label"]').val(e.target.value);
  //set the checkbox (in case it isnt yet)
  $resultdetailbox.find('.checkbox[index="-1"]').click();
  e.target.focus();
  global.input_files[filename].results[index].custom = e.target.value;
  update_per_file_results(filename, true);
}

//adds a result-details-box to the low confidence section
function add_to_lowconfidence(filename, result, i){
  var  $resultdetailsbox = build_result_details(filename, result, i);
  $resultdetailsbox.appendTo($('#lowconfidence').find('.content'));
  //make the extra goto-button visible, only in the lowconf section
  $resultdetailsbox.find('.goto-full-image').show();
  update_number_of_lowconfidence_predictions();
}

//new prediction, either automatically detected or manually added
function add_new_prediction(filename, prediction, box, flag, i, customlabel=undefined){
  //sort labels by probability
  var prediction = sortObjectByValue(prediction);
  var selection  = Object.keys(prediction).length>0? 0 : -1;
  var result     = {prediction:prediction, custom:'', selected:selection, box:box, loconf:flag};
  global.input_files[filename].results[i] =  result;

  //update file list table
  var contentdiv = $( `[id="patches_${filename}"]` );
  //box that shows the image patch and the predicted labels and probabilities
  var $rd = build_result_details(filename, result, i).appendTo(contentdiv);
  if(customlabel != undefined)
    $rd.find('.new-label').val(customlabel).trigger('input').blur();

  //add it to the low confidence section if needed
  if(flag)
    add_to_lowconfidence(filename, result, i)

  //add box overlay
  add_box_overlay(filename, box, i);
}



//sends an image to flask and initiates automatic prediction
function process_file(filename){
  upload_file_to_flask('file_upload', global.input_files[filename].file);
  //send a processing request to python update gui with the results
  return $.get(`/process_image/${filename}`).done(function(data){
      for(i in data.labels)
          add_new_prediction(filename, data.labels[i], data.boxes[i], data.flags[i], i);
      global.input_files[filename].imagesize=data.imagesize;

      set_processed(filename);
      //delete image from flask cache
      delete_image(filename);
    });
}

//sets the global.input_files[x].processed variable and updates view accordingly
function set_processed(filename){
  $(`[id="dimmer_${filename}"]`).dimmer('hide');
  global.input_files[filename].processed=true;
  //refresh gui
  update_per_file_results(filename);
  //make the filename bold to indicate that the file has been processed
  $(`.ui.title[filename="${filename}"]`).find('label').wrap($('<b>'));
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
  upload_file_to_flask('file_upload', file).done(function(response) {
    $contentdiv.html('');
    var content = $("#filelist-item-content-template").tmpl([{filename:file.name}]);
    content.appendTo($contentdiv);
    content.find('.ui.dimmer').dimmer({'closable':false}).dimmer('show');
    content.find('img').one('load', on_image_load_setup_slider);
  });
}

//called when user clicks on a table row to open the accordion item
//uploads image to flask, creates accordion ui item
function on_accordion_open(x){
  var filename = this.find('[filename]').attr('filename');
  maybe_create_filelist_item_content(filename);
}

//called when user clicks on the "process" button of a single image
function on_process_image(e){
  filename = e.target.attributes['filename'].value;
  process_file(filename);
}

//called when user clicks on the "process all" button
function process_all(){
  $button = $('#process-all-button')

  j=0;
  async function loop_body(){
    if(j>=Object.values(global.input_files).length || global.cancel_requested ){
      $button.html('<i class="play icon"></i>Process All Images');
      $('#cancel-processing-button').hide();
      return;
    }
    $('#cancel-processing-button').show();
    $button.html(`Processing ${j}/${Object.values(global.input_files).length}`);

    f = Object.values(global.input_files)[j];
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


//callback from the plus-icon in the upper right corner of an image
function on_add_custom_box_button(e){
  $etarget = $(e.target)
  var $image_container = $etarget.closest('[filename]').find('.image-container')
  var filename         = $etarget.closest('[filename]').attr('filename');

  $etarget.toggleClass('active');
  if($etarget.hasClass('active')){
    $etarget.addClass('blue');
    register_box_draw($image_container, function(box){add_custom_box(filename, box)});
    $image_container.find('img').css({'cursor':'crosshair'})
  }else{
    $etarget.removeClass('blue');
    $image_container.off('mousedown');
    $image_container.off('mouseup');
    $image_container.find('img').css({'cursor':'default'})
  }
  e.stopPropagation();
}


//called after drawing a new box
function add_custom_box(filename, box, label=undefined){
  //clip
  for(var i in box) box[i] = Math.max(Math.min(1,box[i]),0)

  console.log('NEW BOX', filename, box);
  upload_file_to_flask('file_upload', global.input_files[filename].file);
  
  i = 1000+Math.max(0, Math.max(...Object.keys(global.input_files[filename].results)) +1);
  $.get(`/custom_patch/${filename}?box=[${box}]&index=${i}`).done(function(){
    console.log('custom_patch done');
    add_new_prediction(filename, {}, box, false, i, label);
    update_per_file_results(filename);
    delete_image(filename);
  });
}


function load_annotations_from_file(jsonfile, imagefilename){
  maybe_create_filelist_item_content(imagefilename);

  var reader = new FileReader();
  reader.onload = async function(){
    var text = reader.result;
    var data = JSON.parse(text);
    for(var i in data.shapes){
      var imagesize = await read_imagesize_from_tiff(global.input_files[imagefilename].file);
      var height    = imagesize.height;
      var width     = imagesize.width;
      var box       = data.shapes[i].points;
          box       = [box[0][1]/height, box[0][0]/width, box[1][1]/height, box[1][0]/width];
      var label = data.shapes[i].label;
      add_custom_box(imagefilename, box, label);
    }
    set_processed(imagefilename);
  };
  reader.readAsText(jsonfile);
}

function on_external_annotations_select(ev){
  for(f of ev.target.files){
    var basename = filebasename(f.name);
    //match annotation files with input files
    for(var inputfile of Object.values(global.input_files)){
      if(basename == filebasename(inputfile.name) ){
        console.log('Matched annotation for input file ', inputfile.name);
        load_annotations_from_file(f, inputfile.name);
      }
    }
  }
}


//
