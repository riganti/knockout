var observableLatestValue = ko.utils.createSymbolOrString('_latestValue');
var observableValidator = ko.utils.createSymbolOrString('_validator');

ko.observable = function (initialValue, validator) {
    function observable() {
        if (arguments.length > 0) {
            // Write

            // Ignore writes if the value hasn't changed
            var newValue = arguments[0];
            var notifySubscribers;
            if (validator) {
                result = validator.call(observable, newValue);
                newValue = result.newValue;
                notifySubscribers = result.notifySubscribers;
            }
            if (observable.isDifferent(observable[observableLatestValue], newValue) || notifySubscribers) {
                observable.valueWillMutate();
                observable[observableLatestValue] = newValue;
                observable.valueHasMutated();
            }
            return this; // Permits chained assignments
        }
        else {
            // Read
            ko.dependencyDetection.registerDependency(observable); // The caller only needs to be notified of changes if they did a "read" operation
            return observable[observableLatestValue];
        }
    }

    observable[observableLatestValue] = initialValue;
    observable[observableValidator] = validator;

    // Inherit from 'subscribable'
    if (!ko.utils.canSetPrototype) {
        // 'subscribable' won't be on the prototype chain unless we put it there directly
        ko.utils.extend(observable, ko.subscribable['fn']);
    }
    ko.subscribable['fn'].init(observable);

    // Inherit from 'observable'
    ko.utils.setPrototypeOfOrExtend(observable, observableFn);

    if (ko.options['deferUpdates']) {
        ko.extenders['deferred'](observable, true);
    }

    return observable;
}

// Define prototype for observables
var observableFn = {
    'equalityComparer': valuesArePrimitiveAndEqual,
    peek: function() { return this[observableLatestValue]; },
    valueHasMutated: function () {
        this['notifySubscribers'](this[observableLatestValue], 'spectate');
        this['notifySubscribers'](this[observableLatestValue]);
    },
    valueWillMutate: function () { this['notifySubscribers'](this[observableLatestValue], 'beforeChange'); }
};

// Note that for browsers that don't support proto assignment, the
// inheritance chain is created manually in the ko.observable constructor
if (ko.utils.canSetPrototype) {
    ko.utils.setPrototypeOf(observableFn, ko.subscribable['fn']);
}

var protoProperty = ko.observable.protoProperty = '__ko_proto__';
observableFn[protoProperty] = ko.observable;

ko.isObservable = function (instance) {
    var proto = typeof instance == 'function' && instance[protoProperty];
    if (proto && proto !== observableFn[protoProperty] && proto !== ko.computed['fn'][protoProperty]) {
        throw Error("Invalid object that looks like an observable; possibly from another Knockout instance");
    }
    return !!proto;
};

ko.isWriteableObservable = function (instance) {
    return (typeof instance == 'function' && (
        (instance[protoProperty] === observableFn[protoProperty]) ||  // Observable
        (instance[protoProperty] === ko.computed['fn'][protoProperty] && instance.hasWriteFunction)));   // Writable computed observable
};

ko.exportSymbol('observable', ko.observable);
ko.exportSymbol('isObservable', ko.isObservable);
ko.exportSymbol('isWriteableObservable', ko.isWriteableObservable);
ko.exportSymbol('isWritableObservable', ko.isWriteableObservable);
ko.exportSymbol('observable.fn', observableFn);
ko.exportProperty(observableFn, 'peek', observableFn.peek);
ko.exportProperty(observableFn, 'valueHasMutated', observableFn.valueHasMutated);
ko.exportProperty(observableFn, 'valueWillMutate', observableFn.valueWillMutate);
