var lib = require('./lib');

exports.attach = function attach( Sqz, db, model, imports, opts ) {

    var utils = imports.utils;

    model.PublishStates = [ 'new', 'published', 'unpublished' ];

    model.Document = db.define('Document', {
        /**
         * The document's unique ID.
         */
        id:             { type: Sqz.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true, semo$restrict: true },
        /**
         * The ID of the domain account this content item belongs to.
         */
        domainID:       { type: Sqz.INTEGER, semo$restrict: true },
        /**
         * The document slug. Used to generate unique public URLs for documents.
         */
        slug:           { type: Sqz.STRING },
        /**
         * The ID of the document's template.
         */
        templateID:     { type: Sqz.INTEGER },
        /**
         * The ID of the document's theme.
         */
        themeID:        { type: Sqz.INTEGER },
        /**
         * The document content data.
         */
        contentData:    { type: Sqz.JSON },
        /**
         * The document meta data.
         */
        metaData:       { type: Sqz.JSON },
        /**
         * The document publish status.
         */
        publishStatus:  { type: Sqz.ENUM, values: model.PublishStates, defaultValue: model.PublishStates[0] }
    },
    {
        classMethods: {
            filterValues: lib.filterValues( model, 'Document' )
        },
        instanceMethods: {
            applyValues: lib.applyValues( model, 'Document' ),
            /**
             * Test whether this document is new.
             */
            isNew: function() {
                return this.status == 'new';
            },
            /**
             * Test whether this document is published.
             */
            isPublished: function() {
                return this.status == 'published';
            },
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

    model.Document.belongsTo( model.LibraryItem );
    model.Document.sync();
    model.LibraryItem.sync();
}
