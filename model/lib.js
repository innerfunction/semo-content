/**
 * Make a function for filtering values related to a model resource (i.e. table record).
 * @param model     The application model.
 * @param resource  A resource name.
 * @return A function suitable for use as an filterValue class method on resource model.
 */
exports.filterValues = function( model, resource ) {
    /**
     * A method function for filtering a set of name/value pairs to those named properties
     * supported by the associated DAO.
     * @param values    The set of values to filter.
     * @param excludes  An optional list of additional property names to exclude.
     *                  Can also be specified as a set of excluded property names
     *                  mapped to true.
     */
    return function filterValues( values, excludes ) {
        var result = {};
        // Normalize excludes to a map of excluded names.
        if( Array.isArray( excludes ) ) {
            excludes = excludes.reduce(function( result, name ) {
                result[name] = true;
                return result;
            }, {});
        }
        // Read set of defined attributes on the resource model.
        var attrs = model[resource].attributes;
        // Copy values to this, provided the value is a named attribute, and the
        // name isn't excluded.
        for( var name in values ) {
            if( attrs.hasOwnProperty( name ) && !excludes[name] ) {
                result[name] = values[name];
            }
        }
        return result;
    }
}

/**
 * Make a function for applying values to a model resource (i.e. table record).
 * Any field definitions on the model marked with semo$restricted will be excluded from the
 * set of values applied to the resource.
 * @param model     The application model.
 * @param resource  A resource name.
 * @return A function suitable for use as an applyValues method.
 */
exports.applyValues = function( model, resource, excludes ) {
    // Uninitialized set of excluded (i.e. semo$restricted) property names.
    // We can't initialize it at this point because typically the model hasn't yet been
    // initialized when this function is called.
    var excludes = false;
    return function applyValues( values ) {
        var resourceModel = model[resource];
        // Initialize excludes it not already.
        if( !excludes ) {
            excludes = {};
            for( var name in resourceModel.attributes ) {
                var attr = resourceModel.attributes[name];
                if( attr['semo:restricted'] ) {
                    excludes[name] = true;
                }
            }
        }
        // Filter values so that only non-restricted name/values relevant to the resource
        // are included.
        values = resourceModel.filterValues( values, excludes );
        // Update attributes on the resource.
        return this.updateAttributes( values );
    }
}
