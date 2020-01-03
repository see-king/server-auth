const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


class UserAuth {
    

    /**
     * 
     * @param {*} secret private key for jsonwebtoken script (see https://www.npmjs.com/package/jsonwebtoken)
     * @param {*} logCallback function to log errors, by default it's console.log
     * @param {*} saltRounds salt rounds for bcrypt encryption
     * @param {*} jwtEncryptOptions options for jwt.sign() function, defaults to empty object
     * @param {*} jwtDecryptOptions options for jwt.verify() function, defaults to empty object
     */
    constructor( secret, logCallback = console.log, saltRounds = 10, jwtEncryptOptions = {}, jwtDecryptOptions={} ){
        this.saltRounds = saltRounds
        this.secret = secret
        this.logCallback = logCallback
        this.jwtEncryptOptions = jwtEncryptOptions
        this.jwtDecryptOptions = jwtDecryptOptions
    }    


    /**
     * Log callback wrapper. Creates an object of passed message and error and calls logCallback function
     * @param {*} message 
     * @param {*} error 
     */
    log( message, error ){
        this.logCallback( { message, error } )
    }

    /**
     * Creates a password hash to store in DB     * 
     * @param {*} password 
     * @usage const hash = await uauth.hash("qwerty12345") (in async context)
     */
    async hash( password ){
        try{
            return await bcrypt.hash( password, this.saltRounds)            
        } catch( e ){
            this.log( "Error hashing password", e )            
            return false
        }        
    }

    /**
     * Checks if password corresponds to password hash from DB and returns JWT token with given payload on success or false otherwise.
     * @param {*} password 
     * @param {*} passwordHash 
     * @param {*} payload JWT.sign payload, basically anything to store within the token (see https://www.npmjs.com/package/jsonwebtoken for details )     
     * @param {*} expireMinutes - minutes to expire the token within, defaults to 30
    */
    async auth( password, passwordHash, payload = {}, expireMinutes = 30){
        try{            
            if( await bcrypt.compare( password, passwordHash) ){
                return this.getToken(payload, expireMinutes) 
            } else {
                this.log("Password didn't match", {} )
                this.error = "Password didn't match"                
                return false
            }
        } catch( e ){
            this.log( "Error comparing password", e )            
            return false
        }
    }

    verifyToken( token, options = {} ){
        try {

            // mixin the passed verification options
            const verifyOptions = {...this.jwtDecryptOptions, ...options }

            return jwt.verify(token, this.secret, verifyOptions ) 
        } catch( e ){
            let error = "Unknown token verification error"
            let errorDetails = {}
            

            try {
                const{name, message} = e
                errorDetails = {name, message}
    
                switch( e.name ){
                    case "TokenExpiredError":
                        error = "Token expired"
                        errorDetails.expiredAt = e.expiredAt
                        break
                    case "JsonWebTokenError":
                        error = "Token invalid!"
                        break;
                    case "NotBeforeError":
                        error = "Token is not active yet"
                        errorDetails.date = e.date
                        break;
                }
            } catch ( e1 ){}            
            
            return {error, errorDetails }
        }
    }

    getToken( payload, expireMinutes = 30 ){

        const options = {...this.jwtEncryptOptions, expiresIn: this.expireInMinutes(expireMinutes) }

        try{
            return jwt.sign(payload, this.secret, options ) 
        } catch( e ){
            this.log("Error signing JWT token", e )
        }        
    }

    /**
     * returns timestamp offset for {minutes} minutes
     * @param {int} minutes amount of minutes
     */
    expireInMinutes( minutes ){
        return 60 * minutes
    }



}


module.exports = UserAuth