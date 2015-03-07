var lib = require('./lib');

exports.attach = function attach( Sqz, db, model, imports, opts ) {

    var utils = imports.utils;

    model.Snippet = db.define('Snippet', {
        /**
         * The snippet's unique ID.
         */
        id:             { type: Sqz.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true, semo$restrict: true },
        /**
         * The ID of the domain account this content item belongs to.
         */
        domainID:       { type: Sqz.INTEGER, semo$restrict: true },
        /**
         * The snippet content data.
         */
        contentData:    { type: Sqz.JSON }
    },
    {
        classMethods: {
            filterValues: lib.filterValues( model, 'Snippet' )
        },
        instanceMethods: {
            applyValues: lib.applyValues( model, 'Snippet' ),
            /**
             * Return a promise resolving to a JSON representing of the data, including joined data.
             * TODO: Review need for these methods - using find() with includes should be sufficient?
             */
            toJSONPromise: function() {
                var content = this.toJSON();
                return this.getLibraryItem()
                .then(function( libItem ) {
                    content.libraryItem = libItem.toJSON();
                    return content;
                });
            }
        }
    });

    model.Snippet.belongsTo( model.LibraryItem );
    model.Snippet.sync();
    model.LibraryItem.sync();
}
