var mods = {
    fs:     require('fs'),
    mime:   require('mime'),
    path:   require('path'),
    spawn:  require('child_process').spawn,
    temp:   require('temp').track(),
    utils:  require('semo-utils')
};
var Q = require('q');
var format = require('util').format;
var Log = require('log4js').getLogger('content.images');

/**
 * Write an image to a temporary file before preceeding with an imagemagick operation.
 * @param image The image content item to write. Must have a Buffer containing the image data
 *              as its @data property.
 * @return An object with the following properties:
 *         - input:     The full path to the temporary file containing the image data.
 *         - path:      The full path to the temporary directory containing the temporary file.
 *         - cleanup:   A function which will cleanup (by deleting) the temporary directory.
 *                      Must be called once the temporary file has been used.
 */
function writeTempImageFile( image ) {
    var dp = Q.defer();
    mods.temp.mkdir('semo-imma', function writeTempFile( err, path ) {
        if( err ) {
            dp.reject( err );
        }
        else {
            var inExt = mods.mime.extension( image.mimeType );
            var input = mods.path.join( path, 'input.'+inExt );
            function cleanup() {
                mods.utils.fs.rmdir( path );
            }
            mods.fs.writeFile( input, image.data, function resolve( err ) {
                if( err ) {
                    dp.reject( err );
                }
                else dp.resolve({
                    input:   input,
                    path:    path,
                    cleanup: cleanup
                });
            });
        }
    });
    return dp.promise;
}

/**
 * Capture output on stdout, stderr and exit codes from a child process.
 * @param proc A spawned child process.
 */
function captureOutput( proc ) {
    var dp = Q.defer();
    var stdout = [], stderr = [], code, signal;
    proc.stdout.on('data', function stdout( data ) {
        stdout.push( data );
    });
    proc.stderr.on('data', function stderr( data ) {
        stderr.push( data );
    });
    proc.on('exit', function exit( cod, sig ) {
        code = cod;
        signal = sig;
    });
    proc.on('close', function close() {
        dp.resolve({
            stdout: Buffer.concat( stdout ),
            stderr: Buffer.concat( stderr ), 
            code:   code,
            signal: signal
        });
    });
    return dp.promise;
}

/**
 * Invoke the ImageMagick 'convert' command with the specified input image and arguments.
 * - Writes the input image to a temporary file.
 * - Invokes the convert command with the specified arguments on the image file.
 * - Result is written to an output file and read back into memory.
 * - Content item is returned with the result image as its content.
 * @param image     A content item containing the image to convert.
 * @param args      The 'convert' command's arguments.
 * @param outType   The output image's MIME type.
 */
function convert( image, args, outType ) {
    // Write the image data to a temporary file before invoking the command.
    return writeTempImageFile( image )
    .then(function( result ) {
        // Find a file extension for the output file.
        var outExt = outType
            ? mods.mime.extension( outType )||outType
            : mods.mime.extension( image.mimeType );
        // Spawn the command.
        var output = mods.path.join( result.path, 'output.'+outExt );
        args = [ result.input ].concat( args ).concat( output );
        var convert = mods.spawn('convert', args );
        // Capture and process output.
        return captureOutput( convert )
        .then(function( result ) {
            if( result.code != 0 ) {
                // Error - extract info from stdout/stderr.
                var stdout = result.stdout.toString();
                var stderr = result.stderr.toString();
                var err = new Error( format('IM convert error %s %s', stdout, stderr ) );
                err.code = result.code;
                err.signal = result.signal;
                Log.debug('convert',args.join(' '));
                Log.error('Convert error:', err );
                throw err;
            }
            // Read the image result into a proto-content item and return.
            return Q.nfcall( mods.fs.readFile, output )
            .then(function( result ) {
                return {
                    data:       result,
                    mimeType:   mods.mime.lookup( outExt )
                }
            });
        })
        .fin(function() {
            // Cleanup temp files before returning.
            result.cleanup();
        });
    });
}
exports.convert = convert;

/** Crop an image. */
exports.crop = function( image, top, left, width, height, outType ) {
    if( isNaN( top ) )          throw new Error( format('IMMA crop: Bad "top":', top ) );
    else if( isNaN( left ) )    throw new Error( format('IMMA crop: Bad "left":', left ) );
    else if( isNaN( width ) )   throw new Error( format('IMMA crop: Bad "width"', width ) );
    else if( isNaN( height ) )  throw new Error( format('IMMA crop: Bad "height"', height ) );
    var args = [ '-crop', format('%dx%d+%d+%d!', width, height, top, left ) ];
    return convert( image, args, outType );
};

/** Scale an image by width.*/
exports.scaleW = function( image, width, outType ) {
    if( isNaN( width ) ) {
        throw new Error( format('IMMA scaleW: Bad "width":', width ) );
    }
    var args = [
        '-set', 'option:filter:blur', '0.8',
        '-filter', 'Lagrange',
        '-strip',
        '-resize', width,
        '-quality', '80' ];
    return convert( image, args, outType );
};

/**
 * Invoke the imagemagick 'identify' command and return an object containing the result.
 */
exports.identify = function( image ) {
    return writeTempImageFile( image )
    .then(function( result ) {
        var input = result.input;
        // 20141104 - Hack to fix problem on specific server:
        // The 'identify' command was exiting with a SIGILL signal on
        // service.eventpac.com; but 'convert ... info:' continued to work.
        //var identify = mods.spawn('identify', [ input ]);
        var identify = mods.spawn('convert', [ input, 'info:' ]);
        return captureOutput( identify, function( stdout, stderr, code, signal ) {
            // Sample identify output: 
            // /private/...semo-images-imma112104/input.jpeg JPEG 320x452 320x452+0+0 8-bit DirectClass 30.5KB 0.000u 0:00.009
            var fields = stdout.toString().split(/\s+/g);
            if( fields.length > 2 ) {
                var r = /(\d+)x(\d+)/.exec( fields[2] );
                if( r ) {
                    var meta = {
                        format: fields[1].toLowerCase(),
                        width:  Number( r[1] ),
                        height: Number( r[2] )
                    };
                    var data = new Buffer( JSON.stringify( meta ) );
                    return {
                        data:       data,
                        mimeType:   'application/json'
                    };
                }
            }
            throw new Error( stderr.toString()||stdout.toString()||'Unspecified identify error: '+code );
        })
        .fin(function() {
            // Cleanup temp files before returning.
            result.cleanup();
        });
    });
};

