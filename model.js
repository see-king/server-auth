const authClass = require('./user-auth')
const joi = require('@hapi/joi')
const uniqid = require('uniqid')

const key = process.env.JWT_KEY
console.log( "key: " , key )

const auth = new authClass(key)

class userAuthModel {

    constructor(pool, options = {}) {

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
                    users: "users",
                    sessions: "sessions"
                },

                fields: {
                    login: "email",
                    password: "password",
                    session_token: "token"
                },

                verification: {
                    user: joi.object({
                        email: joi.string().email().required(),
                        password: joi.string().min(6).required(),
                        name: joi.string().min(2).required()
                    })
                }
            },

            // overrides
            ...options
        }

    }

    async login(login, password) {
        this.error = null

        try {
            // get users table name from options
            const table = this.options.tables.users

            // get login field from options
            const field = this.options.fields.login

            // get login query from options
            const query = this.options.queries.login
                // replace table placeholder
                .replace(/{{(table)}}/, table)
                // replace field placeholder
                .replace(/{{(login)}}/, field)


            // fetch user from DB
            const [result] = await this.pool.query(query, [login])
            const user = result[0]
            // console.log(user)

            // if user fetched
            if (user && user.password && user.id) {



                // create session id
                const sessionId = uniqid()

                // console.log( `checking user password: ${password} hash: ${user.password}`)
                // check the password hash and get token
                const token = await auth.auth(password, user.password, { userId: user.id, sessionId })

                // if token received - store session to DB and return token
                if (token) {
                    this.token = token
                    this.user = user
                    // TODO: store session to DB
                    return token;
                } else {
                    this.error = auth.error
                    return false
                }



            } else {
                this.error = "Error fetching user from DB"
                return false;
            }

        } catch (e) {
            console.log("Error", e)
            this.error = "Error fetching user from DB"
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
            console.log("Registration user data", value)

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
                    console.log(insert, insert.insertId)
                    return true

                } catch (e) {
                    console.log("error registering", e.message)
                    let message = "Error writing user to database"
                    switch (e.code) {
                        case "ER_DUP_ENTRY":
                            message = "Email already exists!"
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
        console.log("prepared insert statement", { query, values })

        return { query, values }
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

}

module.exports = userAuthModel