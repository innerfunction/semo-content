var format = require('util').format;

exports.attach = function( model, config ) {

    var Sqz = model.Sqz;
    var db = model.db;

    model.Image = db.define('Image', {
        /**
         * The image's unique ID.
         */
        id:         { type: Sqz.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true, semo$restrict: true },
        /**
         * The ID of the domain account this image item belongs to.
         */
        domainID:   { type: Sqz.INTEGER, semo$restrict: true },
        /**
         * The content URI used to generate the image.
         */
        contentURI: { type: Sqz.STRING },
        /**
         * The image's source URI.
         * For an uploaded/downloaded file, this is the file name or URL the file was loaded from.
         */
        sourceURI:  { type: Sqz.STRING }
    },
    {
        classMethods: {
            findWithSourceURI: function( agent, uri ) {
                var where = agent.applyDomain({ sourceURI: uri });
                return model.Image.findOne({ where: where });
            }
        },
        instanceMethods: {
            /**
             * Get meta data for this image. Requires the content service to have been resolved by the
             * model service.
             * @param agent A system ACL agent.
             * @return A promise resolving to the image's meta data.
             */
            getMetaData: function( agent ) {
                var content = model.contentService;
                var uri = content.composeURI( this.contentURI, 'meta' );
                return content.resolve( agent, uri );
            }
        }
    });
}
