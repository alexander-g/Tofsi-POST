import torch, torchvision
import PIL.Image
import numpy as np
#optionally imported below
#import matplotlib as mpl


def train_detector(detector, ds_train, ood_files=[], task_kw={'epochs':10}, num_workers='auto'):
    task     = DetectionTask(detector, **task_kw)
    ld_train = ds_train.create_dataloader(batch_size=8, shuffle=True, num_workers=num_workers)
    ld_test  = None
    task.fit(ld_train, ld_test, task_kw['epochs'])


def train_classifier(classifier, ds_train, ds_test=None, task_kw={'epochs':10}, num_workers='auto'):
    task     = ClassificationTask(classifier, **task_kw)
    ld_train = ds_train.create_dataloader(batch_size=8, shuffle=True, num_workers=num_workers)
    ld_test  = None
    if ds_test is not None:
        ld_test  = ds_test.create_dataloader(batch_size=8, shuffle=False, num_workers=num_workers)
    task.fit(ld_train, ld_test, task_kw['epochs'])



class TrainingTask(torch.nn.Module):
    def __init__(self, basemodule, epochs=10, lr=0.05, callback=None):
        super().__init__()
        self.basemodule        = basemodule
        self.epochs            = epochs
        self.lr                = lr
        self.progress_callback = callback
    
    def training_step(self, batch):
        raise NotImplementedError()
    def validation_step(self, batch):
        raise NotImplementedError()
    def validation_epoch_end(self, logs):
        raise NotImplementedError()
    
    def configure_optimizers(self):
        optim = torch.optim.SGD(self.parameters(), lr=self.lr, momentum=0.9, weight_decay=1e-4)
        steps = [int(self.epochs*i) for i in [0.6,0.8,0.92]]
        print('Learning rate milestones:', steps)
        sched = torch.optim.lr_scheduler.MultiStepLR(optim, steps, gamma=0.2)
        return optim, sched
    
    @property
    def device(self):
        return next(self.parameters()).device
    
    def train_one_epoch(self, loader, optimizer, scheduler=None):
        for i,batch in enumerate(loader):
            if self.__class__.stop_requested:
                break
            loss,logs  = self.training_step(batch)
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            self.callback.on_batch_end(logs, i, len(loader))
        if scheduler:
            scheduler.step()
    
    def eval_one_epoch(self, loader):
        all_outputs = []
        for i,batch in enumerate(loader):
            outputs, logs  = self.validation_step(batch)
            self.callback.on_batch_end(logs, i, len(loader))
            all_outputs   += [outputs]
        logs = self.validation_epoch_end(all_outputs)
        self.callback.on_batch_end(logs, i, len(loader))
    
    def fit(self, loader_train, loader_valid=None, epochs='auto'):
        self.epochs = epochs
        if epochs == 'auto':
            self.epochs = max(15, 50 // len(loader_train))
            
        if self.progress_callback is not None:
            self.callback = TrainingProgressCallback(self.progress_callback, self.epochs)
        else:
            self.callback = PrintMetricsCallback()
        
        self.train().requires_grad_(True)
        optim, sched  = self.configure_optimizers()
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        torch.cuda.empty_cache()
        try:
            self.to(device)
            self.__class__.stop_requested = False
            for e in range(self.epochs):
                if self.__class__.stop_requested:
                    break
                self.train().requires_grad_(True)
                self.train_one_epoch(loader_train, optim, sched)
                
                self.eval().requires_grad_(False)
                if loader_valid:
                    self.eval_one_epoch(loader_valid)
                
                self.callback.on_epoch_end(e)
        except KeyboardInterrupt:
            print('\nInterrupted')
        except Exception as e:
            #prevent the exception getting to ipython (memory leak)
            import traceback
            traceback.print_exc()
            return e
        finally:
            self.zero_grad(set_to_none=True)
            self.eval().cpu().requires_grad_(False)
            torch.cuda.empty_cache()
     
    #XXX: class method to avoid boiler code
    @classmethod
    def request_stop(cls):
        cls.stop_requested = True


class DetectionTask(TrainingTask):
    def training_step(self, batch):
        x,y         = batch
        x           = x.to(self.device)
        y           = [dict([(k,yy[k].to(self.device)) for k in ['boxes', 'labels']])  for yy in y]
        lossdict    = self.basemodule(x,y)
        loss        = torch.stack( [*lossdict.values()] ).sum()
        logs        = dict([(k,v.item())  for k,v in lossdict.items()] + [('loss', loss.item())])
        return loss, logs
    
    def validation_step(self, batch):
        x,y_true    = batch
        x           = x.to(self.device)
        y_pred      = self.basemodule(x)
        return {'y_pred':y_pred, 'y_true':y_true}, {}
    
    def validation_epoch_end(self, outputs):
        boxes_true  = [b for B in [ [o['boxes'].cpu()  for o in O['y_true']] for O in outputs] for b in B]
        boxes_pred  = [b for B in [ [o['boxes'].cpu()  for o in O['y_pred']] for O in outputs] for b in B]
        scores_pred = [s for S in [ [o['scores'].cpu() for o in O['y_pred']] for O in outputs] for s in S]
        return {
            'Precision@98Recall' : precision_at_recall(boxes_true, boxes_pred, scores_pred, target_recall=0.98),
            'Precision@95Recall' : precision_at_recall(boxes_true, boxes_pred, scores_pred, target_recall=0.95),
            'Precision@90Recall' : precision_at_recall(boxes_true, boxes_pred, scores_pred, target_recall=0.90),
        }


class ClassificationTask(TrainingTask):
    def training_step(self, batch):
        x,ytrue     = batch
        x,ytrue     = x.to(self.device), ytrue.to(self.device)
        ypred       = self.basemodule(x)
        loss        = torch.nn.functional.cross_entropy(ypred, ytrue, ignore_index=-1, reduction='none')
        """loss        = smoothed_cross_entropy(ypred, ytrue, ignore_index=-1, reduce=False)"""
        loss       += max_entropy_loss(ypred[...,:15], ytrue, index=-1)                                      #FIXME:  [...,:15] hardcoded
        loss        = loss.mean()
        return loss, {'loss': loss.item()}
    
    def validation_step(self, batch):
        x,y_true    = batch
        x           = x.to(self.device)
        y_raw       = self.basemodule(x)
        return {'y_raw':y_raw.cpu(), 'y_true':y_true.cpu()}, {}
    
    def validation_epoch_end(self, outputs):
        y_true  = torch.cat([o['y_true'] for o in outputs]).cpu()
        y_raw   = torch.cat([o['y_raw'] for o in outputs]).cpu()
        y_pred  = y_raw.argmax(-1)
        acc     = (y_true == y_pred)[y_true!=-1].numpy().mean()
        acc90,T90,th90   = accuracy_at_hiconf_recall(y_raw, y_true, recall_target=0.9)
        return {
            'Accuracy'                 : acc.item(),
            'Accuracy@90%HiConfRecall' : acc90.item(),
        }


def smoothed_cross_entropy(ypred, ytrue, alpha=0.01, ignore_index=-100, reduce=True):
    mask    = (ytrue != ignore_index )
    ytrue   = ytrue * mask
    
    ypred   = torch.nn.functional.log_softmax(ypred, dim=-1)
    alpha_i = alpha / ypred.size(-1)
    loss    = -(  ypred.gather(dim=-1, index=ytrue[:,np.newaxis]) * (1-alpha)
                + ypred.sum(dim=-1, keepdim=True)*alpha_i)[...,0]
    loss    = torch.nan_to_num(loss)
    if reduce:
        return loss[mask].mean()
    else:
        return loss * mask

def max_entropy_loss(ypred, ytrue, index=-100):
    mask    = ytrue == index
    prob    = torch.softmax(ypred, -1)
    entropy = torch.sum(prob * torch.log(prob), -1)
    loss    = entropy * mask
    return loss

def hiconf_acc_rec(raw, labels, th=0.5, T=1, max_n=15):
    prob = torch.softmax( torch.as_tensor(raw)[...,:max_n]/T, -1 )
    labels = torch.as_tensor(labels)
    maxp = prob.max(-1)[0]
    return (prob.argmax(-1) == labels)[maxp>th].float().mean(), (maxp>th).float().mean()

def accuracy_at_hiconf_recall(raw_output, labels, recall_target=0.9):
    thresholds   = [0.5, 0.7, 0.75, 0.8, 0.9]
    temperatures = np.linspace(0.5, 5.0, 19)
    acc_rec      = [[hiconf_acc_rec(raw_output, labels, th, T) for th in thresholds] for T in temperatures]
    acc_rec      = torch.as_tensor(acc_rec)
    acc_hirecall = acc_rec[...,0]*(acc_rec[...,1] >= recall_target)
    acc_hirecall = torch.nan_to_num(acc_hirecall)
    i,j          = np.unravel_index(np.nanargmax(acc_hirecall), acc_hirecall.shape)
    return acc_hirecall[i,j], temperatures[i], thresholds[j]







class PrintMetricsCallback:
    '''Prints metrics after each training epoch in a compact table'''
    def __init__(self):
        self.epoch = 0
        self.logs  = {}
        
    def on_epoch_end(self, epoch):
        self.epoch = epoch + 1
        self.logs  = {}
        print() #newline
    
    def on_batch_end(self, logs, batch_i, n_batches):
        self.accumulate_logs(logs)
        percent     = ((batch_i+1) / n_batches)
        metrics_str = ' | '.join([f'{k}:{float(np.mean(v)):>9.5f}' for k,v in self.logs.items()])
        print(f'[{self.epoch:04d}|{percent:.2f}] {metrics_str}', end='\r')
    
    def accumulate_logs(self, newlogs):
        for k,v in newlogs.items():
            self.logs[k] = self.logs.get(k, []) + [v]

class TrainingProgressCallback:
    '''Passes training progress as percentage to a custom callback function'''
    def __init__(self, callback_fn, epochs):
        self.n_epochs    = epochs
        self.epoch       = 0
        self.callback_fn = callback_fn
    
    def on_batch_end(self, logs, batch_i, n_batches):
        percent     = ((batch_i+1) / (n_batches*self.n_epochs))
        percent    += self.epoch / self.n_epochs
        self.callback_fn(percent)
    
    def on_epoch_end(self, epoch):
        self.epoch = epoch + 1


