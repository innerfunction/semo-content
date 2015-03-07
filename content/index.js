var Log = require('log4js').getLogger('content');
var Q = require('q');
var format = require('util').format;
var mods = {
    curi:   require('./content-uri'),
    utils:  require('semo-utils')
}
var images = require('./images');
var wkhtml = require('./wkhtml');
var baseContentResolvers = require('./base-content-resolvers');

// Standard content system errors.
var error = {
    OpNotAvailable: function( uri ) {
        return format('Content operation not available for URI %s', uri );
    },
    SchemeNotFound: function( scheme ) {
        return format('Content operation scheme not found: "%s"', scheme );
    },
    OpNotFound: function( scheme, op, uri ) {
        return format('Content operation not found: "%s:%s" in %s', scheme, op, uri );
    },
    BadOpArgs: function( op, args ) {
        return format('Bad arguments for content operation "%s" (%s)', op, args );
    },
    BaseContentResolverNotFound: function( scheme ) {
        return format('Base content resolver not found for scheme %s', scheme );
    },
    ContentNotFound: function( uri ) {
        return format('Content not found: %s', uri );
    }
}

// Create a DB cache for the content system.
function createCache( model ) {
    return {
        /**
         * Read a content item from the DB by content URI.
         * @param agent     A system ACL agent.
         * @param uri       The content URI of the item to find.
         * @param topts     Optional transaction options (i.e. an object { transaction: t })
         */
        read: function( agent, uri, topts ) {
            var where = agent.applyDomain({ uri: uri.toString() });
            return model.Content.findOne({ where: where }, topts );
        },
        /**
         * Write a new content item to the DB. Content items marked with nocache=true will
         * not be written to the DB.
         * @param agent     A system ACL agent.
         * @param content   The content item to write.
         * @param topts     Optional transaction options (i.e. an object { transaction: t })
         */
        write: function( agent, content, topts ) {
            if( content.nocache ) {
                return model.asPromise( content );
            }
            content = agent.applyDomain( content );
            //content.baseURI = content.uri.baseURI.toString();
            content.baseURI = mods.curi.baseURI( content.uri ).toString();
            // Writing to cache always means creating a new item. If an item is being
            // updated/replaced (i.e. because its base content has changed) then the
            // cache will have been invalidated first, meaning that pre-existing
            // content items will have been deleted by this point.
            return model.Content.create( content, topts );
        },
        /**
         * Invalidate the cache for a specified base content URI.
         * @param agent     A system ACL agent.
         * @param baseURI   The URI of the base content item.
         * @param topts     Optional transaction options (i.e. an object { transaction: t })
         */
        invalidate: function( agent, baseURI, topt ) {
            var where = agent.applyDomain({ baseURI: baseURI.toString() });
            return model.Content.destroy({ where: where }, topt );
        }
    }
}

exports.factory = function() {

    var model; // The db model; value set by init() function.

    // Map of registered content op schemes. Each content scheme is a map of named
    // operation functions; each op function takes two arguments:
    // * args:  An array of op args, as defined in the content URI.
    // * item:  The content item being operated upon.
    var schemes = {};

    // A share mutex for resolving content URIs. The share mutex ensures that any given content
    // URI is only ever has one process resolving it, and that any other processes wanting to
    // resolve that URI wait for the resolution to complete before having the result shared
    // with them.
    var mutex = mods.utils.concurrent.shareMutex();

    // The content item cache.
    var cache = createCache( model );

    // Resolve content from a URI. Generate's the content if not already cached.
    // @param agent A system ACL agent.
    // @param uri   The content URI to resolve.
    function resolve( agent, uri ) {
        // Attempt reading the URI from the cache first.
        return cache.read( agent, uri )
        .then(function cacheRead( content ) {
            if( content ) {
                Log.debug('Content cache hit for %s', uri );
            }
            // If content not found in cache then generate from the URI.
            else {
                // If the URI is a base content reference (i.e. doesn't define any operations on
                // base content) and it wasn't found in the cache then it doesn't exist, throw a
                // content not found error.
                if( uri.isBaseContentRef() ) {
                    Log.debug('Resolving base content for %s...', uri );
                    var op = uri.nextOp;
                    var opfn = baseContentResolvers[op.scheme];
                    if( !opfn ) {
                        throw error.BaseContentResolverNotFound( op.scheme );
                    }
                    content = opfn( agent, op.params, model, cache )
                    .then(function cacheWrite( content ) {
                        if( content === undefined ) {
                            throw error.ContentNotFound( uri );
                        }
                        return cache.write( agent, content );
                    });
                }
                else {
                    Log.debug('Generating content for %s...', uri );
                    // Resolve content for the base URI. This returns the content to apply the content
                    // op to.
                    content = resolve( agent, uri.baseURI )
                    .then(function invokeOp( content ) {
                        // Resolve the content op.
                        var op = uri.nextOp;
                        if( !op ) {
                            throw error.OpNotAvailable( uri );
                        }
                        var scheme = schemes[op.scheme]; // Read ops for current scheme.
                        if( !scheme ) {
                            throw error.SchemeNotFound( op.scheme );
                        }
                        var opfn = scheme[op.id]; // Lookup op.
                        if( !opfn ) {
                            throw error.OpNotFound( op.scheme, op.id, uri );
                        }
                        // Apply the content op to the base content.
                        return opfn( op.params, content );
                    })
                    .then(function cacheWrite( content ) {
                        // Write the content item to cache.
                        content.uri = uri.toString();
                        content.hash = mods.utils.crypto.digest( content.data );
                        return cache.write( agent, content );
                    });
                    /*
                    .fail(function( err ) {
                        // TODO: Old code wrapped errors in content items so that they were cachable.
                    })
                    */
                }
            }
            return content;
        });
    }

    var content = {
        /**
         * Initialize the content component.
         */
        init: function( bus ) {
            model = bus.get('model');
        },
        /**
         * Resolve content from a URI.
         * @param agent     A system ACL agent.
         * @param uri       The URI to resolve.
         * @return A promise resolving to the content result.
         */
        resolve: function( agent, uri ) {
            if( typeof uri == 'string' ) {
                uri = mods.curi.parse( uri );
            }
            // Resolve the URI within the mutex, to avoid having multiple processes all
            // resolving the same URI at the same time.
            return mutex.call( uri, function resolveCall() {
                return resolve( agent, uri );
            });

        },
        /**
         * Write base content to the content cache. Necessary before derived content can be
         * generated.
         * @param agent     A system ACL agent.
         * @param uri       The base content item's content URI.
         * @param values    The content item's values. Must have mimeType and data properties.
         *                  May have an optional hash property; if not provided, then a hash value
         *                  is automatically calculated using the data property.
         * @param topts     Optional transaction options (i.e. an object { transaction: t })
         * @return A promise resolving to the content record in the DB.
         */
        writeBaseContent: function( agent, uri, values, topts ) {
            assert( !!values.mimeType, 'writeBaseContent: values.mimeType must be provided');
            assert( !!values.data,     'writeBaseContent: values.data must be provided');
            var curi = mods.curi.parse( uri );
            var hash = values.hash||mods.utils.crypto.digest( values.data );
            var content = {
                uri:        curi,
                mimeType:   values.mimeType,
                data:       values.data,
                hash:       hash
            }
            // Start a transaction to write the content.
            return model.transaction(function writeContent( topts ) {
                return cache.invalidate( agent, curi, topts )
                .then(function insertItem() {
                    // Then insert the new base content item by writing to cache.
                    return cache.write( agent, content, topts );
                });
            });
        },
        /**
         * Add a new op scheme to the content engine.
         * @param scheme    The scheme name.
         * @param ops       A map of op functions, keyed by op name. See 'schemes' above.
         */
        addScheme: function( scheme, ops ) {
            schemes[scheme] = ops;
        },
        /**
         * Parse a content URI string.
         */
        parseURI: function( uri ) {
            return mods.curi.parse( uri );
        },
        /**
         * Compose a content URI from a base URI appended with a named op and params.
         */
        composeURI: function( baseURI, opID, opParams ) {
            return content.parseURI( baseURI ).pushOp( opID, opParams );
        }
    };

    content.images = images.api( model, content );
    
    content.addScheme('image', images.ops );
    content.addScheme('wkhtml', wkhtml.ops );

    return content;
}
