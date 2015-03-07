var Log = require('log4js').getLogger('semo-content');
var utils = require('semo-utils');

exports.factory = function() {
    var bus = utils.bus();
    bus.add('content', require('./content'));
    bus.add('model', require('./model'));
    return bus;
}
