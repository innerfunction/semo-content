var mods = {
    mime:           require('mime'),
    sbuffers:       require('stream-buffers'),
    wkhtmltoimage:  require('wkhtmltoimage'),
    wkhtmltopdf:    require('wkhtmltopdf')
}
var Q = require('q');
var Log = require('log4js').getLogger('content.wkhtml');
var format = require('util').format;

/**
 * Content item input needs to be converted to a URL (or alternatively, HTML)
 * This can be done in two ways:
 * - Content item references a Document or Snippet library item -> get a URL for the item
 * - Content item has text/html MIME type -> get its string content
 */
function resolveContent( content ) {
    switch( content.mimeType ) {
    case 'application/vnd.innerfunction-semo.document':
    case 'application/vnd.innerfunction-semo.snippet':
        // TODO: What is the data property in this case? How is the underlying item resolved?
    case 'text/html':
        return content.data.toString();
    }
    throw new Error( format('wkhtmk: Unsupported base content type "%s"', content.mimeType ) );
}

/**
 * Capture output from a wkhtml command and return as a content item.
 * @param cmd       The wkhtml command being executed.
 * @param mimeType  The expected MIME type of the result.
 * @param cmdID     A command ID; used for logging.
 */
function captureOutput( cmd, mimeType, cmdID ) {
    var dp = Q.defer();
    // Create a writeable stream to buffer.
    var wstream = new mods.sbuffers.WriteableStreamBuffer({
        initialSize:        (100 * 1024),
        incrementAmount:    (10 * 1024)
    });
    // Pipe the wkhtml command's result to the buffer.
    cmd.pipe( wstream );
    // Resolve the content item result once the pipe completes.
    wstream.on('end', function() {  // TODO: Confirm this is the correct way to do this.
        dp.resolve({
            data:       wstream.getContents(),
            mimeType:   mimeType
        });
    });
    // Capture any errors from the command.
    wstream.on('error', function( err ) {
        Log.error('%s:', cmdID, err );
        dp.reject( err );
    });
    return dp.promise;
}

// Content ops. Operations accept the same options (parameters) in the same format as for the command line,
// e.g. --output-format!png;--page-size!A4; - options not taking a value should be mapped to boolean true
// (which is the how the content URI handles op parameters by default).
exports.ops = {
    'toimage': function( params, content ) {
        var outputFormat = params['--output-format'];
        if( outputFormat === undefined ) {
            opts['--output-format'] = outputFormat = 'jpeg';
        }
        var mimeType = mods.mime.lookup( outputFormat );
        return resolveContent( content )
        .then(function( input ) {
            return captureOutput( mods.wkhtmltoimage( input, params ), mimeType, 'toimage' );
        });
    },
    'topdf': function( params, content ) {
        var mimeType = mods.mime.lookup('pdf');
        return resolveContent( content )
        .then(function( input ) {
            return captureOutput( mods.wkhtmltopdf( input, params ), mimeType, 'topdf' );
        });
    }
}
