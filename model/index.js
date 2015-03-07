var Log = require('log4js').getLogger('model');
var Sqz = require('sequelize');
var Q = require('q');
var utils = require('semo-utils');

exports.factory = function() {
    return {
        init: function( hub, config ) {
            this.config = config;
        },
        start: function() {

            var config = this.config;
            var db = new Sqz( config.database, config.username, config.password, config.options );
            var model = utils.tgz.model( Sqz, db );

            require('./contents').attach( model, config );
            require('./images').attach( model, config );

            if( opts.options.forceSync ) {
                return model.sync( true );
            }
        }
    }
}
