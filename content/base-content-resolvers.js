var format = require('util').format;

/**
 * Wrap model data in a content item.
 * @param data  The model data.
 * @param type  The model item type.
 */
function contentItem( data, type ) {
    if( data === undefined ) {
        return;
    }
    return {
        mimeType:   'application/vnd.innerfunction-semo.'+type,
        nocache:    true,
        data:       data
    }
}

// Base content resolvers for different core model types.
module.exports = {
    library: function( agent, params, model, cache ) {
        var key = Object.keys( params )[0];
        return model.LibraryItem.findOne({ where: { key: key } })
        .then(function wrapContent( libItem ) {
            return contentItem( libItem, libItem.type );
        });
    },
    image: function( agent, params, model, cache ) {
        var key = Object.keys( params )[0];
        var uri = format('image://%s/', key );
        return cache.read( agent, uri );
    }
}
