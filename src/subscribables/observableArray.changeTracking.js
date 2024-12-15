var arrayChangeEventName = 'arrayChange';
var appliedTrackChangesSymbol = Symbol()
ko.extenders['trackArrayChanges'] = function(target, options) {
    // Use the provided options--each call to trackArrayChanges overwrites the previously set options
    target.compareArrayOptions = {};
    if (options && typeof options == "object") {
        ko.utils.extend(target.compareArrayOptions, options);
    }
    target.compareArrayOptions['sparse'] = true;

    // Only modify the target observable once
    if (target[appliedTrackChangesSymbol]) {
        return;
    }
    target[appliedTrackChangesSymbol] = true;
    var trackingChanges = false,
        cachedDiff = null,
        changeSubscription,
        spectateSubscription,
        pendingChanges = 0,
        previousContents,
        underlyingBeforeSubscriptionAddFunction = target.beforeSubscriptionAdd,
        underlyingAfterSubscriptionRemoveFunction = target.afterSubscriptionRemove;

    // Watch "subscribe" calls, and for array change events, ensure change tracking is enabled
    target.beforeSubscriptionAdd = function (event) {
        if (underlyingBeforeSubscriptionAddFunction) {
            underlyingBeforeSubscriptionAddFunction.call(target, event);
        }
        if (event === arrayChangeEventName) {
            trackChanges();
        }
    };
    // Watch "dispose" calls, and for array change events, ensure change tracking is disabled when all are disposed
    target.afterSubscriptionRemove = function (event) {
        if (underlyingAfterSubscriptionRemoveFunction) {
            underlyingAfterSubscriptionRemoveFunction.call(target, event);
        }
        if (event === arrayChangeEventName && !target.hasSubscriptionsForEvent(arrayChangeEventName)) {
            if (changeSubscription) {
                changeSubscription.dispose();
            }
            if (spectateSubscription) {
                spectateSubscription.dispose();
            }
            spectateSubscription = changeSubscription = null;
            trackingChanges = false;
            previousContents = undefined;
        }
    };

    function trackChanges() {
        if (trackingChanges) {
            // Whenever there's a new subscription and there are pending notifications, make sure all previous
            // subscriptions are notified of the change so that all subscriptions are in sync.
            notifyChanges();
            return;
        }

        trackingChanges = true;

        // Track how many times the array actually changed value
        spectateSubscription = target.subscribe(function () {
            ++pendingChanges;
        }, null, "spectate");

        // Each time the array changes value, capture a clone so that on the next
        // change it's possible to produce a diff
        previousContents = [].concat(target.peek() || []);
        cachedDiff = null;
        changeSubscription = target.subscribe(notifyChanges);

        function notifyChanges() {
            if (pendingChanges) {
                // Make a copy of the current contents and ensure it's an array
                var currentContents = [].concat(target.peek() || []), changes;

                // Compute the diff and issue notifications, but only if someone is listening
                if (target.hasSubscriptionsForEvent(arrayChangeEventName)) {
                    changes = getChanges(previousContents, currentContents);
                }

                // Eliminate references to the old, removed items, so they can be GCed
                previousContents = currentContents;
                cachedDiff = null;
                pendingChanges = 0;

                if (changes && changes.length) {
                    target['notifySubscribers'](changes, arrayChangeEventName);
                }
            }
        }
    }

    function getChanges(previousContents, currentContents) {
        // We try to re-use cached diffs.
        // The scenarios where pendingChanges > 1 are when using rate limiting or deferred updates,
        // which without this check would not be compatible with arrayChange notifications. Normally,
        // notifications are issued immediately so we wouldn't be queueing up more than one.
        if (!cachedDiff || pendingChanges > 1) {
            cachedDiff = ko.utils.compareArrays(previousContents, currentContents, target.compareArrayOptions);
        }

        return cachedDiff;
    }
};
