import numpy as np
import scipy.optimize
import torchvision, torch



def one_hot(x,n):
    return np.eye(n, dtype='int32')[x]

def eval_image(output, annotation, n, th, IGNORED_CLASSES):
    out_boxes  = output['boxes_raw']
    out_labels = output['labels']
    out_scores = output['scores']
    
    #compute intersection over union
    iou         = torchvision.ops.box_iou(
        torch.as_tensor(annotation['boxes']), torch.as_tensor(out_boxes)
    ).numpy()
    #match predicted and annotated boxes
    row_ixs, col_ixs = scipy.optimize.linear_sum_assignment(iou, maximize=True)
    #only consider those with iou above threshold
    iou_good    = (iou > 0.4)[row_ixs,col_ixs]
    row_ixs     = row_ixs[iou_good]
    col_ixs     = col_ixs[iou_good]
    
    TP,WL,FP,FN = [0,0,0,0]
    ann_onehot  = np.zeros(n, dtype='int32')
    out_onehot  = np.zeros(n, dtype='int32')
    ignored_onehot = np.zeros(n, dtype='int32')
    TP_onehot   = np.zeros(n, dtype='int32')
    lowconfs    = [0,0,0]   #[0]:correct,[1]:incorrect,[2]:undeterminable
    hiconfs     = [0,0,0]   #[0]:correct,[1]:incorrect,[2]:undeterminable
    
    #iterate over matched boxes
    for i,j in zip(row_ixs, col_ixs):
        assert annotation['labels'][i] != 0, NotImplemented
        
        if annotation['labels_str'][i] in IGNORED_CLASSES:
            #annotated as undeterminable or similar
            ignored_onehot += one_hot(out_labels[j], n)
            lowconfs[2]    += (out_scores[j] <  th)
            hiconfs[2]     += (out_scores[j] >= th)
        else:
            ann_onehot += one_hot(annotation['labels'][i], n)
            out_onehot += one_hot(out_labels[j], n)
            
            if out_labels[j] != 0:
                hit = np.array(annotation['labels'][i] == out_labels[j])
                TP += hit
                WL += ~hit
                TP_onehot += one_hot(out_labels[j], n) * hit
                lowconfs[int(~hit)] += (out_scores[j] < th)
                hiconfs[int(~hit)]  += (out_scores[j] >= th)
            else:
                FN += 1
                lowconfs[1] += (out_scores[j] < th)
                hiconfs[1]  += (out_scores[j] >= th)
    
    for i,l in enumerate(annotation['labels_str']):
        if i not in row_ixs:
            #assert l not in IGNORE_DETECT, NotImplemented
            #unmatched annotation
            FN += 1
            ann_onehot += one_hot(annotation['labels'][i], n)
    for j,l in enumerate(out_labels):
        if j not in col_ixs:
            #unmatched prediction
            if l != 0:   #FIXME?
                FP += 1
            out_onehot  += one_hot(l, n)
            lowconfs[1] += (out_scores[j] < th)
            hiconfs[1]  += (out_scores[j] >= th)
    return TP,WL,FP,FN, TP_onehot, ann_onehot, out_onehot, ignored_onehot, lowconfs, hiconfs


def eval_all(outputs, annotations, CLASSES_OF_INTEREST, IGNORED_CLASSES, th):
    import pylab as P
    
    n = len(CLASSES_OF_INTEREST)
    
    metrics = []
    for idx in range(len(annotations)):
        metrics += [eval_image(outputs[idx], annotations[idx], n, th, IGNORED_CLASSES)]
    print('TP/WL/FP/FN:        ', np.array([m[:4] for m in metrics]).sum(0))
    ann_counts =  np.stack([m[5] for m in metrics]).sum(0)
    out_counts =  np.stack([m[6] for m in metrics]).sum(0)
    ignored_counts =  np.stack([m[7] for m in metrics]).sum(0)
    full_counts    = out_counts + ignored_counts
    recall     = (np.stack([m[4] for m in metrics]).sum(0) / ann_counts)
    precision  = (np.stack([m[4] for m in metrics]).sum(0) / full_counts)
    print('Per-class recall:   ',   recall.round(2))
    print('Per-class precision:',   precision.round(2))
    lowconf_counts = np.stack([m[8] for m in metrics]).sum(0)
    lowconf_files  = np.stack([m[8] for m in metrics]).any(1)
    lowconf_files_prcnt = [1-lowconf_files.mean(), lowconf_files.mean()]
    lowconf_counts_prcnt= lowconf_counts / lowconf_counts.sum()
    hiconf_counts       = np.stack([m[9] for m in metrics]).sum(0)
    hiconf_counts_prcnt = hiconf_counts / hiconf_counts.sum()
    
    
    gs = P.figure(0, (20,9)).add_gridspec(6,2)
    P.subplot(gs[:4,0])
    P.bar(CLASSES_OF_INTEREST[1:], ann_counts[1:], label='Annotated')
    P.bar(CLASSES_OF_INTEREST[1:], full_counts[1:], label='Predicted but undeterminable', width=0.3, color='pink')
    P.bar(CLASSES_OF_INTEREST[1:], out_counts[1:], label='Predicted', width=0.3, color='C1')
    P.xticks(rotation=45, ha='right'); P.legend(); P.title('Counts');
    for i,err in enumerate(  (full_counts / ann_counts)[1:] - 1 ):
        P.gca().text(i-0.3, max(ann_counts[i+1], full_counts[i+1])+3, f'{err*100:+.0f}%', fontsize=9)

    P.subplot(gs[4:,0])
    P.barh([2,2],   lowconf_files_prcnt, left=[0,lowconf_files_prcnt[0]], color=P.cm.Purples([0.8,0.2]))
    P.text(0,                  2-0.35, f'High Confidence\n{int(lowconf_files_prcnt[0]*100)}%', color='w');
    P.text(lowconf_files_prcnt[0],2-0.35, f'Low\n{int(lowconf_files_prcnt[1]*100)}%',             color='gray');
    
    P.barh([1,1,1], hiconf_counts_prcnt, left=[0]+np.cumsum(hiconf_counts_prcnt).tolist()[:-1], color=[(0.4, 0.8, 0.4), (0.8, 0.3, 0.3), 'pink', ])
    P.text(0,                               1-0.35, f'Correct\n(High Confidence)\n{int(hiconf_counts_prcnt[0]*100)}%',        color='w', rotation=0); 
    P.text(np.cumsum(hiconf_counts_prcnt)[0], 1-0.35, f'Incorrect\n\n{int(hiconf_counts_prcnt[1]*100)}%',      color='w', rotation=0); 
    P.text(np.cumsum(hiconf_counts_prcnt)[1], 1-0.35, f'Un.\n\n{int(hiconf_counts_prcnt[2]*100)}%', color='gray', rotation=0)
    P.xticks([]); P.yticks([]);
    
    P.barh([0,0,0], lowconf_counts_prcnt, left=[0]+np.cumsum(lowconf_counts_prcnt).tolist()[:-1], color=[(0.4, 0.8, 0.4), (0.8, 0.3, 0.3), 'pink', ])
    P.text(0,                               0-0.35, f'Correct\n(Low Confidence)\n{int(lowconf_counts_prcnt[0]*100)}%',        color='w', rotation=0); 
    P.text(np.cumsum(lowconf_counts_prcnt)[0], 0-0.35, f'Incorrect\n(Low Confidence)\n{int(lowconf_counts_prcnt[1]*100)}%',      color='w', rotation=0); 
    P.text(np.cumsum(lowconf_counts_prcnt)[1], 0-0.35, f'Undeterminable\n(Low Confidence)\n{int(lowconf_counts_prcnt[2]*100)}%', color='gray', rotation=0)
    P.xticks([]); P.yticks([]);
    
    P.subplot(gs[:3,1]);
    P.bar(CLASSES_OF_INTEREST[1:], recall[1:], color='C4', label='Recall')
    P.xticks(visible=False); P.legend(); P.ylim(0,1); P.grid(alpha=0.3);
    for i,x in enumerate( recall[1:] ): P.gca().text(i-0.2, x-0.05, f'{x*100:.0f}%', fontsize=9, color='w')
    
    P.subplot(gs[3:,1])
    P.bar(CLASSES_OF_INTEREST[1:], precision[1:], color='C8', label='Precision')
    P.xticks(rotation=45, ha='right'); P.legend(); P.ylim(0,1); P.grid(alpha=0.3);
    for i,x in enumerate(  precision[1:] ): P.gca().text(i-0.2, x-0.05, f'{x*100:.0f}%', fontsize=9, color='k')
    P.tight_layout()

    print('Avg rel error:       ', np.abs((full_counts / ann_counts)[1:] - 1).mean())


def eval_dataset(ds, model, CLASSES_OF_INTEREST, IGNORED_CLASSES, th, _n=10000):
    outputs, annotations = [],[]
    _n = min(_n, len(ds))
    for i in range(_n):
        print(f'[{i:03d}/{_n}]', end='\r')
        outputs     += [model.process_image(ds.tiff_files[i], use_onnx=False)]
        annotations += [ds[i][1]]
    eval_all(outputs, annotations, CLASSES_OF_INTEREST, IGNORED_CLASSES, th,)
    return outputs, annotations