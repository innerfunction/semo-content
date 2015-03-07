var Log = require('log4js').getLogger('content.images');
var Q = require('q');
var format = require('util').format;

exports.ops = require('./ops');

exports.api = function( model, content ) {
    return {
        /**
         * Get a non-modified version of a library image.
         * @param agent         A system ACL agent.
         * @param libraryKey    The image's library key.
         */
        getLibraryImage: function( agent, libraryKey ) {
            return model.Image.findWithKey( agent, libraryKey )
            .then(function getContent( image ) {
                if( image ) {
                    return content.resolve( agent, image.contentURI );
                }
                return; // No content to return.
            });
        },
        /**
         * Return a preview image for the specified library image. The image is cropped and scaled to
         * fit the specified width & height. The returned image is in JPEG format.
         * @param agent         A system ACL agent.
         * @param libraryKey    The image's library key.
         * @param width         The width of the required image.
         * @param height        The height of the required image.
         */
        getLibraryImagePreview: function( agent, libraryKey, width, height ) {
            return model.Image.findWithKey( agent, libraryKey )
            .then(function getPreviewImage( image ) {
                if( image ) {
                    var uri = content.parseURI( image.contentURI );
                    uri = uri.pushOp('resize', { width: width, height: height, mode:'crop', outType:'jpeg' });
                    return content.resolve( agent, uri );
                }
                return; // No content to return.
            });
        },
        /**
         * Return a cropped and scaled version of a library image.
         * @param agent         A system ACL agent.
         * @param libraryKey    The image's library key.
         * @param crop          Optional crop arguments; an object with x, y, width and height properties.
         * @param scale         Optional scale percentage.
         * @param type          The image output format.
         */
        cropAndScaleLibraryImage: function( agent, libraryKey, crop, scale, type ) {
            return model.Image.findWithKey( agent, libraryKey )
            .then(function getCropAndScaledImage( image ) {
                if( image ) {
                    var uri = content.parseURI( image.contentURI );
                    if( crop ) {
                        crop.outType = type;
                        uri = uri.pushOp('crop', crop );
                    }
                    if( scale ) {
                        uri = uri.pushOp('scale', { percent: scale, outType: type });
                    }
                    return content.resolve( agent, uri );
                }
                return; // No content to return.
            });
        },
        /**
         * Get the image URI for a specified source URI.
         * TODO: Download the file if not found in the db.
         * @param agent         A system ACL agent.
         * @param sourceURI     The image's source URI.
         */
        getImageURIForSourceURI: function( agent, sourceURI ) {
        },
        /**
         * Get the image URI for a specified source file.
         * TODO: Load the file if not found in the db.
         * @param agent         A system ACL agent.
         * @param sourcePath    The path to the source image file.
         */
        getImageURIForSourcePath: function( agent, sourcePath ) {
        }
    }
}
