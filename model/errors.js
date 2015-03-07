var format = require('util').format;

exports.ValidationFailure = function( resource, property, code ) {
    var err = new Error( format('Validation failure on %s.%s: %s', resource, property, code ) );
    err.http = {
        code: 422,
        message: 'Unprocessable entity',
        cause: {
            error:      'validation-failure',
            resource:   resource,
            property:   property,
            code:       code
        }
    };
    return err;
}
