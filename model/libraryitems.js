var lib = require('./lib');
var errors = require('./errors');
var format = require('util').format;

exports.attach = function attach( Sqz, db, model, imports, opts ) {

    var utils = imports.utils;

    model.LibraryStates = [ 'active', 'trash' ];

    model.LibraryItem = db.define('LibraryItem', {
        /**
         * The library key. A GUID which uniquely identifies this item.
         */
        key: {
            type:           Sqz.STRING,
            allowNull:      false,
            primaryKey:     true,
            defaultValue:   utils.keyGen,
            semo$restrict:  true
        },
        /**
         * The ID of the domain account this library item belongs to.
         */
        domainID: {
            type:           Sqz.INTEGER,
            semo$restrict:  true
        },
        /**
         * The library item category type, e.g. 'image'.
         */
        type: {
            type: Sqz.STRING
        },
        /**
         * A name/title for the item.
         */
        name: {
            type: Sqz.STRING
        },
        /**
         * A longer item description.
         */
        description: {
            type: Sqz.STRING
        },
        /**
         * A space separated list of tags associated with the library item.
         * A space is kept at the start and end of the field to make searching for items using LIKE easier.
         */
        tags: {
            type: Sqz.STRING,
            /** Get tags as an array of tag values. */
            get: function getTags() {
                var tags = this.getDataValue('tags');
                return tags && tags.trim().split(/\s+/g);
            },
            /** Set tags as either (1) a space separated string of tag names, or (2) an array of tag names. */
            set: function setTags( tags ) {
                if( Array.isArray( tags ) ) {
                    tags = format(' %s ', tags.join(' ') );
                }
                else if( tags ) {
                    tags = tags.toString().split(/\s+/g);
                    tags = format(' %s ', tags.join(' ') );
                }
                this.setDataValue('tags', tags );
            }
        },
        /**
         * The library item status.
         */
        status: {
            type:           Sqz.ENUM,
            values:         model.LibraryStates,
            defaultValue:   model.LibraryStates[0]
        }
    },
    {
        // See https://github.com/sequelize/sequelize/pull/2057
        indexes: [
            {
                name:   'library_domain_status_type_key',
                unique: true,
                fields: ['domainID','status','type','key']
            }
        ],
        classMethods: {
            filterValues: lib.filterValues( model, 'LibraryItem' ),
            /**
             * Create a new library item using the specified values.
             */
            initialize: function( values ) {
                return values;
            }
        },
        instanceMethods: {
            applyValues: lib.applyValues( model, 'LibraryItem' ),
            trash: function() {
                this.status = 'trash';
            }
        }
    });

    model.LibraryItem.sync();
}
