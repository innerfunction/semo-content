var Sqz = require('sequelize');
var Log = require('log4js').getLogger('model');
var Q = require('q');

module.exports = function setup( opts, imports, register ) {

    var db = new Sqz( opts.database, opts.username, opts.password, opts.options );

    // A transaction wrapper function which takes a Q promise returning function,
    // and invokes that function within a DB transaction. If the function resolves
    // correctly then the transaction is committed; else the transaction is
    // rolled-back. This function returns a deferred promise resolving to the
    // result of the wrapped function.
    function transaction( fn ) {
        var dp = Q.defer();
        db.transaction()
        .then(function transact( t ) {
            try {
                // Call the wrapped function, passing an object suitable to use an an options
                // object on standard Sequelize method calls. (This object has a transaction:
                // property; code wanting to include additional options should create a new
                // object, and copy the transaction property to the new object).
                // NOTE: This assumes that fn() returns a *Sequelize* promise, not a Q promise.
                return fn({ transaction: t })
                .then(function commit( result ) {
                    t.commit()
                    .then(function resolve() {
                        dp.resolve( result );
                    });
                })
                .catch(function error( err ) {
                    //Log.error('Returned by transaction:', err );
                    t.rollback()
                    .then(function reject() {
                        dp.reject( err );
                    });
                });
            }
            catch( e ) {
                //Log.error('Thrown in transaction:', e );
                return t.rollback()
                .then(function reject() {
                    dp.reject( e );
                });
            }
        });
        return dp.promise;
    }

    var model = {
        Sqz:         Sqz,
        db:          db,
        transaction: transaction
    }

    // contentOnly flag allows the model to be run with only content service related tables.
    if( !opts.contentOnly ) {
        require('./accounts').attach( Sqz, db, model, imports, opts );
        require('./libraryitems').attach( Sqz, db, model , imports, opts );
        require('./documents').attach( Sqz, db, model , imports, opts );
        require('./snippets').attach( Sqz, db, model , imports, opts );
    }
    require('./contents').attach( Sqz, db, model, imports, opts );
    require('./images').attach( Sqz, db, model , imports, opts );

    model.sync = function( force ) {
        Log.info('Synchronizing database schema...');
        return db.sync({ force: force });
    }

    // Utility method for resolving a list of Sequelize promises.
    // This is different from Sequelize's Promise.all function in that the list of promises
    // to resolve is specified as the arguments array.
    model.resolveAll = function() {
        var promises = [];
        for( var i = 0; i < arguments.length; i++ ) promises.push( arguments[i] );
        return Sqz.Promise.all( promises );
    }

    // Utility method for wrapping a value in a Sequelize/Bluebird promise.
    model.asPromise = function( value ) {
        return new Sqz.Promise(function( resolve ) {
            resolve( value );
        });
    }
    
    // Register a listener with the hub to get the content service when loaded.
    imports.hub.on('service', function( name, service ) {
        if( name == 'content' ) {
            model.contentService = service;
        }
    });

    var result = { model: model };
    if( opts.options.forceSync ) {
        model.sync( true )
        .then(function() {
            register( null, result );
        })
        .fail(function( err ) {
            register( err );
        })
        .done();
    }
    else register( null, result );
}
