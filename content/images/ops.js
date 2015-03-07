var Log = require('log4js').getLogger('content.images');
var imma = require('./imma');
var mime = require('mime');
var format = require('util').format;

function echo( content ) {
    return {
        mimeType:   content.mimeType,
        data:       content.data
    }
}

module.exports = {
    'convert': function( params, content ) {
        var inType = mime.extension( content.mimeType );
        var outType = params.outType;
        if( !outType ) {
            throw new Error('convert: Output type not specified');
        }
        if( inType == outType ) {
            return echo( content );
        }
        var outFormat = mime.extension( outType )||outType;
        var args = [];
        // If the input format supports transparency but the output format doesn't, then
        // flatten the image onto a white background colour.
        // See http://www.imagemagick.org/discourse-server/viewtopic.php?f=1&t=8359
        if( (inType == 'image/png' || inType == 'image/gif') && outType == 'image/jpeg' ) {
            args = ['-background', 'white', '-flatten'];
        }
        return mods.imma.convert( content, args, outType );
    },
    'crop': function( params, content ) {
        if( !Object.keys( params ) ) {
            return echo( content );
        }
        var top     = Number( params.top );
        var left    = Number( params.left );
        var width   = Number( params.width );
        var height  = Number( params.height );
        var outType = params.outType;
        Log.debug('crop offset(%d,%d) dims(%d,%d)', top, left, width, height );
        return imma.crop( content, top, left, width, height, outType );
    },
    'resample-w': function( params, content ) {
        if( !Object.keys( params ) ) {
            return echo( content );
        }
        var refWidth    = Number( params.refWidth );    // The reference image width.
        var refDPI      = Number( params.refDPI );      // The DPI of the reference width.
        var targetDPI   = Number( params.targetDPI );   // The target DPI of the output.
        var targetWidth = (refWidth * (targetDPI / refDPI)).toFixed( 0 ); // The target width at the target DPI.
        var outType = params.outType;
        Log.debug('resample %dpx @ %ddpi -> %dpx @ %ddpi', refWidth, refDPI, targetWidth, targetDPI );
        return imma.scaleW( content, targetWidth, outType );
    },
    'scale-w': function( params, content ) {
        var width = Number( params.width );
        var outType = params.outType;
        return imma.scaleW( content, width, outType );
    },
    'resize': function( params, content ) {
        var width = Number( params.width );
        var height = Number( params.height );
        var mode = params.mode||'fit';
        var outType = params.outType;
        Log.debug('resize %dx%d %s %s', width, height, mode, outType);
        var args = ['-resize'];
        var dims = (width||'')+'x'+(height||'');
        if( mode == 'crop' ) {
            args = args.concat([ dims+'^', '-gravity', 'center', '-extent', dims ]);
        }
        else {
            args.push( dims );
        }
        return imma.convert( content, args, outType );
    },
    'scale': function( params, content ) {
        var percent = Number( params.percent );
        var outType = params.outType;
        Log.debug('scale %d%% %s', percent, outType );
        var args = ['-resize', percent+'%' ];
        return imma.convert( content, args, outType );
    },
    'meta': function( params, content ) {
        return imma.identify( content );
    }
}
