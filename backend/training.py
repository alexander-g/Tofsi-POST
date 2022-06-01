import os
from base.backend import pubsub
from base.backend import GLOBALS


def start_training(imagefiles, targetfiles, training_options:dict, settings):
    locked = GLOBALS.processing_lock.acquire(blocking=False)
    if not locked:
        raise RuntimeError('Cannot start training. Already processing.')

    with GLOBALS.processing_lock:
        GLOBALS.processing_lock.release()  #decrement recursion level bc acquired twice
    
        model = settings.models['detection']
        #indicate that the current model is unsaved
        settings.active_models['detection'] = ''
        
        ok = True
        if training_options.get('train_detector'):
            ok = model.start_training_detector(
                imagefiles, 
                targetfiles, 
                classes_nonpollen = training_options.get('classes_nonpollen', []),
                classes_ignore    = [],
                num_workers       = 0, 
                callback          = training_progress_callback,
            )
        if training_options['train_classifier'] and ok:
            ok = model.start_training_classifier(
                imagefiles, 
                targetfiles, 
                classes_of_interest = training_options.get('classes_of_interest', []),
                classes_nonpollen   = training_options.get('classes_nonpollen', []),
                classes_lowconf     = training_options.get('classes_unknown', []),
                classes_ignore      = [],
                num_workers         = 0, 
                callback            = training_progress_callback,
            )
        return 'OK' if ok else 'INTERRUPTED'

def training_progress_callback(x):
    pubsub.PubSub.publish({'progress':x,  'description':'Training...'}, event='training')

def find_targetfiles(inputfiles):
    def find_targetfile(imgf):
        no_ext_imgf = os.path.splitext(imgf)[0]
        for f in [f'{imgf}.json', f'{no_ext_imgf}.json']:
            if os.path.exists(f):
                return f
    return list(map(find_targetfile, inputfiles))
