var lib = require('./lib');
var errors = require('./errors');
var format = require('util').format;

exports.attach = function attach( Sqz, db, model, imports, opts ) {

    var utils = imports.utils;

    model.Content = db.define('Content', {
        /**
         * The content URI used to generate the item.
         */
        uri: {
            type:       Sqz.STRING,
            allowNull:  false,
            primaryKey: true,
            semo$restrict: true,
            set: function( uri ) {
                this.setDataValue('uri', uri && uri.toString() );
            }
        },
        /**
         * The ID of the domain account this content item belongs to.
         */
        domainID: {
            type: Sqz.INTEGER,
            semo$restrict: true
        },
        /**
         * The content item's base content URI (same as the content URI for base content).
         */
        baseURI: {
            type: Sqz.STRING,
            set: function( uri ) {
                this.setDataValue('baseURI', uri && uri.toString() );
            }
        },
        /**
         * The content item's hash.
         */
        hash: {
            type: Sqz.STRING
        },
        /**
         * The content item data.
         */
        data: {
            type: Sqz.BLOB
        },
        /**
         * The content item MIME type.
         */
        mimeType: {
            type: Sqz.STRING
        }
    },
    {
        // See https://github.com/sequelize/sequelize/pull/2057
        indexes: [
            {
                name:   'content_base_uri',
                unique: false,
                fields: ['baseURI']
            }
        ],
        classMethods: {
            findWithURI: function( agent, uri ) {
                var where = agent.applyDomain({ uri: uri });
                return model.Content.findOne({ where: where });
            }
        },
        instanceMethods: {
            toJSON: function() {
                return {
                    uri:        this.uri,
                    domainID:   this.domainID,
                    baseURI:    this.baseURI,
                    hash:       this.hash,
                    mimeType:   this.mimeType,
                    data:       format('data:%s;base64,%s', this.mimeType, this.data.toString('base64'))
                }
            }
        }
    });

    model.Content.sync();
}
