var mods = {
    url:    require('url')
};
var format = require('util').format;

/**
 * A module for parsing and inspecting content URIs.
 * A content URI is used to both address content and describe its production. A content URI is composed as:
 *
 *      [scheme]://[base-content-ref](/[name])*
 *
 * Where:
 *      'scheme' is a content operation scheme (see below).
 *      'base-content-ref' is a reference to the base content.
 *      'name' is an operation name (which may include parameters, see below).
 *
 * The pattern follows the standard URL form, where if one or more operation names are present then they
 * form a path representing the sequence of operations to be applied to the base document in order to
 * generate the content item.
 *
 * Content operation schemes are namespaces for content operation functions. When a specific scheme is
 * used in a content URI then all operation names within the URI are expected to be available in that
 * scheme.
 *
 * Operation names correspond to operation functions within the operation scheme and are sequentially
 * applied to the base content to produce the result. Simple operation names map directly to a function
 * of the same name in the scheme.
 * The full pattern for a URI operation with parameters is:
 *
 *      ( ([op-scheme] '~')? [op-name] ) ( ';' [param] ( '!' [value] )? )*
 *
 * That is, -
 *      + An operation, described as -
 *          + An optional operation scheme, with a ~ suffic
 *          + Followed by an operation name (in the URI's default scheme if not prefixed by a scheme)
 *          + Some schemes are functional schemes, meaning that the op name is optional (the scheme
 *            defines a default op for the scheme).
 *      + Followed by parameters delimited by semi-colons, e.g. op;param1;param2
 *      + Where optionally, parameters can take name=value form, e.g. op;param1!value1;
 *        (The ! character is used because it is not replaced when the URI component is URI encoded).
 */

/**
 * A URI for referencing and generating derived content.
 * @param scheme            The operation scheme.
 * @param baseContentRef    A reference to the base content.
 * @param path              The operation path.
 * @param lastIdx           The last index of the operation path to use.
 * @param baseURI           The content URI of the base content.
 */
function ContentURI( scheme, baseContentRef, path, lastIdx, baseURI ) {
    if( lastIdx == undefined ) {
        lastIdx = path.length - 1;
    }
    if( !baseURI ) {
        baseURI = lastIdx > -1 && new ContentURI( scheme, baseContentRef, path, lastIdx - 1 );
    }
    this.scheme = scheme;
    this.baseContentRef = baseContentRef;
    this.path = lastIdx > -1 ? pathToString( path, lastIdx ) : '';
    this.nextOp = lastIdx > -1 ? path[lastIdx] : false;
    this.baseURI = baseURI;
}
// Test whether the URI references the base content.
ContentURI.prototype.isBaseContentRef = function() {
    return !this.baseURI;
}
// Convert this URI to a string.
ContentURI.prototype.toString = function() {
    return format('%s://%s/%s', this.scheme, this.baseContentRef, this.path );
}
// Create a new URI by pushing a new content op onto the end of this one.
ContentURI.prototype.pushOp = function() {
    var op;
    if( arguments.length == 1 ) {
        // Argument is a string specifying the op and its parameters.
        op = new ContentOp( this.scheme, arguments[0] );
    }
    else {
        // Arguments are 'opID' (the operation ID); 'params' (an object containing operation parameters).
        op = new ContentOp( this.scheme, arguments[0] );
        op.params = arguments[1];
    }
    var path = splitPath( this.path, this.scheme );
    path.push( op );
    return new ContentURI( this.scheme, this.baseContentRef, path, path.length - 1, this );
}
ContentURI.prototype.toJSON = ContentURI.prototype.inspect;

// A content operation, derived from a component of a content URI.
function ContentOp( scheme, component ) {
    if( !Array.isArray( component ) ) {
        // Assume component is the op in string form.
        component = component.split(';');
    }
    var op = component[0], id;
    var r = /([^:]+)~(.*)/.exec( op );      // Check for scheme change - /scheme~op
    if( r ) {
        this.scheme = r[1];                 // Scheme change found, change scheme name.
        id = r[2];
    }
    else {
        this.scheme = scheme;
        id = op;
    }
    this.id = id||'default';                // If no op ID is specified then default to 'default'.
    this.params = component.slice( 1 )      // Rest of the array is the op parameters.
    .reduce(function( params, param ) {     // Convert array of params into a map of name/value pairs.
        var idx = param.indexOf('!');       // Attempt splitting param into a name!value pair.
        if( idx > 0 ) {
            params[param.substring( 0, idx )] = param.substring( idx + 1 );
        }
        else {
            params[param] = true;           // Params without an explicit value are mapped to true.
        }
        return params;
    }, {});
}
// Return a string representation of a content op.
ContentOp.prototype.toString = function() {
    var params = this.params;
    return Object.keys( params )                    // Get array of parameter names.
    .sort()
    .reduce(function paramToString( s, name ) {     // Reduce the array to a string of name!value pairs.
        var value = params[name];
        if( value === true ) {                      // Don't include the value for parameters mapped to boolean true.
            return format('%s;%s', s, name );
        }
        return format('%s;%s!%s', s, name, value );
    }, this.id );
}

// Convert a URI path to a string.
function pathToString( path, lastIdx ) {
    return path.slice( 0, lastIdx + 1 )
    .map(function opToString( op ) {
        return Array.isArray( op ) ? op.join(';') : op.toString();
    })
    .join('/');
}

// Split a string path into an array of content op descriptors.
function splitPath( path, scheme, first ) {
    return path.split('/')
    .slice( first||0 )
    .map(function splitOp( op ) {
        return new ContentOp( scheme, op.split(';').map( decodeURIComponent ) );
    });
}

// Parse a URI string.
exports.parse = function( uri ) {
    if( uri instanceof ContentURI ) {
        return uri;
    }
    uri = mods.url.parse( uri );
    var scheme = uri.protocol;
    if( scheme ) {

        // Path begins with '/' so discard the first item, which will be empty.
        var path;
        if( uri.path && uri.path != '/' ) {
            path = splitPath( uri.path, scheme, 1 );
        }
        else path = [];

        scheme = scheme.substring( 0, scheme.length - 1 );
        return new ContentURI( scheme, uri.host, path );
    }
    else throw new Error('Bad content URI: '+uri);
}

// Return the precursor URI for a content URI object or string.
exports.baseURI = function( uri ) {
    // TODO: Review naming - the term 'base URI' refers to two distinct things.
    return exports.parse( uri ).baseURI;
}

// Append an operation to a URI string.
exports.appendOp = function( uri, op ) {
    return uri.toString()+'/'+op;
}

// Create a new URI for base content.
exports.create = function( scheme, baseContentRef, path ) {
    return new ContentURI( scheme, baseContentRef, path||'');
}

/* TESTAGE
var uri = exports.parse('image://abc123/x~scale;width!50;nocrop');
console.log('uri %j',uri);
console.log('toString',uri.toString());
console.log('nextOp',uri.nextOp);
console.log('baseURI',uri.baseURI.toString());

var puri = uri.pushOp('resize;width!50;height!50');
console.log('push uri',puri.toString());
console.log('push uri nextOp',puri.nextOp);
console.log('push uri baseURI',puri.baseURI.toString());
*/
