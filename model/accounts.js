var lib = require('./lib');
var errors = require('./errors');
var format = require('util').format;

exports.attach = function attach( Sqz, db, model, imports, opts ) {

    var utils = imports.utils;

    model.AccountTypes = [ 'domain', 'user' ];

    model.AccountStates = [ 'inactive', 'active' ];

    model.AccountRoles = [ 'normal', 'admin', 'superadmin' ];

    model.Account = db.define('Account', {
        /**
         * The account unique ID.
         */
        id:         { type: Sqz.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true, semo$restrict: true },
        /**
         * The account type. Domain accounts can contain multiple user accounts. All accounts can be
         * logged in with, assuming a valid username + password can be provided.
         */
        type:       { type: Sqz.ENUM, values: model.AccountTypes, defaultValue: model.AccountTypes[0], semo$restrict: true },
        /**
         * The ID of the domain account this account belongs to.
         */
        domainID:   { type: Sqz.INTEGER, semo$restrict: true },
        /**
         * The account username. Defaults to email address.
         */
        username:   { type: Sqz.STRING, semo$restrict: true },
        /**
         * The account password. Stored as a salted hash.
         */
        password:   { type: Sqz.STRING, semo$restrict: true },
        /**
         * The salt used to hash the password.
         */
        salt:       { type: Sqz.STRING, semo$restrict: true },
        /**
         * The account security role.
         */
        role:       { type: Sqz.ENUM, values: model.AccountRoles, defaultValue: model.AccountRoles[0], semo$restrict: true },
        /**
         * The account name.
         */
        name:       { type: Sqz.STRING },
        /**
         * The account email address.
         */
        email:      { type: Sqz.STRING, isEmail: true },
        /**
         * The account slug. Used to generate unique public URLs for site documents.
         */
        slug:       { type: Sqz.STRING },
        /**
         * The account status.
         */
        status:     { type: Sqz.ENUM, values: model.AccountStates, defaultValue: model.AccountStates[0], semo$restrict: true }
    },
    {
        classMethods: {
            filterValues: lib.filterValues( model, 'Account' ),
            /**
             * Create a new account using the specified values.
             */
            initialize: function( values ) {
                // If password and confirmPassword values are provided then check that they match.
                if( values.password && values.confirmPassword && values.password != values.confirmPassword ) {
                    throw errors.ValidationError('account','password','confirm_password_mismatch');
                }
                // Check that we have a username or email (username will default to email)
                if( !(values.username || values.email) ) {
                    throw errors.ValidationError('account','username','no_username_provided');
                }
                return {
                    username:   values.username||values.email,
                    salt:       utils.crypto.salt(),
                    name:       values.name||values.email||values.username,
                    email:      values.email
                }
            }
        },
        instanceMethods: {
            applyValues: lib.applyValues( model, 'Account' ),
            /**
             * Test whether this account is a domain account.
             */
            isDomain: function() {
                return this.type == 'domain';
            },
            /**
             * Apply a domain filter to a DB 'where' clause.
             * Part of an account's agent functionality.
             */
            applyDomain: function( where ) {
                where = where||{};
                // For 'domain' accounts, the domain ID to apply is the account ID;
                // For 'user' accounts, the domain ID to apply is the account's domain ID.
                where.domainID = this.type == 'domain' ? this.id : this.domainID;
                return where;
            },
            /**
             * Test whether this account is active.
             */
            isActive: function() {
                return this.status == 'active';
            },
            /**
             * Set this account's password.
             */
            setPassword: function( password ) {
                this.password = utils.crypto.digest( password, this.salt );
            },
            /**
             * Check whether a password is valid for this account.
             */
            checkPassword: function( password ) {
                return this.password == utils.crypto.digest( password, this.salt );
            },
            /**
             * Return a string representaion of the account as "name (username)".
             */
            toString: function() {
                return format('%s (%s)', this.name, this.username );
            }
        }
    });

    model.Account.hasOne( model.Account, { as: 'Domain', foreignKey: 'DomainID' });
    model.Account.sync();
}
