const authClass = require('./user-auth')
const joi = require('@hapi/joi')
const uniqid = require('uniqid')
const clr = require('./cli-colors')
const pool = require('./pool')
const env = process.env
const key = env.AUTH_JWT_KEY

if( !key ){
    throw `${clr.Red}\n\nERROR: JWT Key not found. Please, add AUTH_JWT_KEY value to .env file${clr.Reset}\n\n`
}

const auth = new authClass(key)

class userAuthModel {

    constructor( options = {}) {

        this.user = null

        this.pool = pool

        this.error = null

        this.options = {
            // default options
            ...{
                queries: {
                    // login query - SELECT * from users where email='some@email.com'
                    login: "SELECT * FROM `{{table}}` WHERE `{{login}}`=?",
                    // insert query
                    insert: "INSERT INTO {{table}} {{fields}} VALUES {{values}}",
                    // update query
                    insert: "UPDATE {{table}}  set {{fields}} where ?=?"
                },

                tables: {
                    users: process.env.AUTH_TABLES_USERS || "users",
                    sessions: process.env.AUTH_TABLES_SESSIONS || "sessions"
                },

                userFields: {
                    id:  env.AUTH_USER_FIELDS_ID || "id",
                    login: env.AUTH_USER_FIELDS_LOGIN || "email",
                    password:  env.AUTH_USER_FIELDS_PASSWORD || "password"
                },

                sessionFields: {                    
                    session_id: env.AUTH_SESSION_FIELDS_SESSION ||  "sessionId",
                    session_user: env.AUTH_SESSION_FIELDS_USER || "userId"
                },

                verification: {
                    user: joi.object({
                        email: joi.string().email().required(),
                        password: joi.string().min(6).required(),
                    })
                },

                // Logger calback for error messages. Default is console.log
                logger: console.log
            },

            // overrides
            ...options
        }

    }

    /**
     * Run a dummy query to check DB connection
     */
    async checkConnection(){
        // this query must run if there is a connection and database is selected
        try {
            await pool.query("SHOW TABLES;")
            return true;
        } catch( e ){
            return false;
        }
    }

    async login(login, password) {

        const self = this;

        self.error = null

        try {
            // get users table name from options
            const table = this.options.tables.users

            // get login field from options
            const field = this.options.userFields.login

            // get login query from options
            const query = this.options.queries.login
                // replace table placeholder
                .replace(/{{(table)}}/, table)
                // replace field placeholder
                .replace(/{{(login)}}/, field)


            // fetch user from DB
            const [result] = await this.pool.query(query, [login])
            const user = result[0]
            

            // if user fetched
            if (user && user[this.options.userFields.password] && user[this.options.userFields.id]) {

                // create session id
                const sessionId = uniqid()

                // check the password hash and get token
                const token = await auth.auth(password, user.password, { userId: user[this.options.userFields.id], sessionId })

                // if token received - store session to DB and return token
                if (token) {
                    this.token = token
                    this.user = user
                    // TODO: store session to DB
                    if( await this.storeSession(sessionId, user[this.options.userFields.id]) ){
                        return token;
                    } else {
                        return false;
                    }
                } else {
                    this.error = auth.error
                    return false
                }



            } else {
                this.error = "Error fetching user from DB"
                return false;
            }

        } catch (e) {
            switch( e.code ){
                case "ECONNREFUSED":
                    this.error = "Connection refused";
                    this.options.logger(this.error )
                    break;
                default:
                    this.error = "Error fetching user from DB"
                    this.options.logger(this.error )
                    break;
            }
            return false;
        }
        
        
    }


    async register(user) {
        this.error = null
        const { value, error } = this.options.verification.user.validate(user)

        if (error) {
            this.error = error.details[0].message
            return false;
        } else {
            this.options.logger("Registration user data", value)

            // hash the password
            const hash = await auth.hash(user.password)

            if (hash) {
                // replace password with hash
                user.password = hash

                // prepare insert statement
                const { query, values } = this.prepareInsertStatement(user, this.options.tables.users)

                try {
                    // execute insert query
                    const [insert] = await this.pool.execute(query, values)
                    this.options.logger(insert, insert.insertId)
                    return true

                } catch (e) {
                    this.options.logger("error registering", e.message)
                    let message = "Error writing user to database"
                    switch (e.code) {
                        // catch duplicate entry error
                        case "ER_DUP_ENTRY":
                            message = "User with such parameters already exists!"
                            break
                    }
                    this.error = message
                    return false
                }
            } else {
                this.error = "Error creating password hash. Registration failed"
                return false
            }



        }
    }

    async storeSession( sessionId, userId ){
        const {session_id, session_user} = this.options.sessionFields
        const q = this.prepareInsertStatement(
            { 
                [session_id]: sessionId, 
                [session_user]: userId
            }, this.options.tables.sessions            
            )
        try{
            this.options.logger( "inserting session")
            const res = await this.pool.query( q.query, q.values )
            this.options.logger( "session store result", res)
            return true;
        } catch(e){
            this.options.logger( "error inserting session", e.message)
            this.error = e.message;
            return false;
        }
    }


    /**
     * Prepares insert statement for given table with data from passed item object.
     * Returns an object with two elements: {query, values} to be used like:  pool.execute(query, values)
     * @param {*} item 
     * @param {*} table 
     */
    prepareInsertStatement(item, table) {
        const fields = "`" + Object.keys(item).join("`, `") + "`"
        const placeholders = Object.keys(item).fill("?").join(", ")  // "'" + Object.values(item).join("', '") + "'"
        const values = Object.values(item)

        let query = `INSERT INTO \`${table}\` (${fields}) VALUES(${placeholders});`
        this.options.logger("prepared insert statement", { query, values })

        return { query, values }
    }

    async logout(token){
        const content = auth.decodeToken(token);
        if( content ){
            const {sessionId, userId} = content;
            if( sessionId && userId ){
                await this.deleteSesion(sessionId, userId);
            } else {
                this.log("Session id and user id were not found in token")
            }
        } else {
            this.log("Could not decode token")
        }
    }

    async deleteSesion( sessionId, userId ){
        try{
            const sessionIdField = this.options.sessionFields.session_id
            const userIdField = this.options.userFields.id
            const sessionTable = this.options.tables.sessions

            await this.pool.query(
                `DELETE FROM ${sessionTable} WHERE ${sessionIdField}=? AND ${userIdField}=?`,
                [sessionId, userId]
                )
            this.log("session deleted:", `${sessionId}, ${userId}`);
            return true;
        }catch(e){
            this.log(e.code, e.mesage);
            return false;
        }
    }


    async verifyToken( token ){
        this.error = null

        const result = await auth.verifyToken( token )
        if( result.error ){
            this.error = result.error
            return false
        }else{
            return result
        }
    }


    async renewToken( token ){
        try {
            const decoded = await this.verifyToken(token)
            if( decoded ){
                // TODO: fetch payload from old token, get new token and return
                const {userId, sessionId, iat, exp } = decoded
                if( userId && sessionId  ){
                    // attempt to fetch expiration time from previous token
                    const diff = exp - iat
    
                    // difference between exp and iat is the expiration time in seconds.
                    // if difference is a positive number, use it, divided by 60, otherwise use default 30 minutes
                    const expireIn = !isNaN(diff) && diff > 0 ? diff/60 : 30
                    
                    // return new token
                    try {
                        return await auth.getToken( {userId, sessionId}, expireIn )
                    } catch (e){
                        this.error = "Error fetching new token:" + e.mesage
                        this.options.logger( this.error )
                    }
                } else {
                    this.error = "Error renewing token: Somehow the old token didn't hold userId and/or sessionId"
                    this.options.logger( this.error,  decoded )
                }
            } else {
                // TODO: delete session record    
            }
        } catch (e){
            this.error = "Error renewing token: " + e.message
            this.options.logger( this.error )
        }
        
        return false;        
    }

    log( message, params = {} ){
        this.options.logger(message, params )
    }

}

module.exports = userAuthModel
module.exports.service = auth