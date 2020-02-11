# User authentication for express + mysql DB

## Basic Usage
1. use .env file to set up DB connection (see **Connection options in .env**) 
2. Add AUTH_JWT_KEY value in .env for JWT secret key
3. Instantiate auth model
4. Asyncronously call .register() or .login() methods:

```js
// require dotenv config to set up mysql connection
require("dotenv").config()
const modelClass = require("@see-king/auth")

// instantiate model
const model = new modelClass()

async (
    try{
        // userData is an object with required fields.
        const result = await model.register( userData )
        // result is boolean.
        // model.error holds error message, if any
        console.log( result ? "New user is registered!" : model.error  )
    } catch(e){
        console.log("Error registering user", e)
    }
)()
```

## Connection options in .env

To define Mysql connection use the next values in .env:
*(You may copy content from .env-example and edit it)*
```
AUTH_DB_HOST=localhost
AUTH_DB_PORT=3306
AUTH_DB_DB=somedatabase
AUTH_DB_USER=root
AUTH_DB_PASSWORD=root
```
Additional connection options are:
```
AUTH_DB_WAIT_FOR_CONNECTION=true
AUTH_DB_CONNECTION_LIMIT=10
AUTH_DB_QUEUE_LIMIT=0
```

## Model options in .env
```
AUTH_JWT_KEY=someSecretString12345

AUTH_TABLE_USERS=users
AUTH_TABLE_SESSIONS=sessions

AUTH_USER_FIELDS_LOGIN=email
AUTH_USER_FIELDS_ID=id
AUTH_USER_FIELDS_PASSWORD=password
AUTH_SESSION_FIELDS_SESSION=token
```
### Table names
- **AUTH_TABLE_USERS** defines the name of users table in database
- **AUTH_TABLE_SESSIONS** defines the name of sessions table in database
### Table fields
- **AUTH_USER_FIELDS_LOGIN** - the name of login field within users table (the field that will be compared to login value)
- **AUTH_USER_FIELDS_ID** - the name of id field within users table
- **AUTH_USER_FIELDS_PASSWORD** - the name of password field within users table
- **AUTH_SESSION_FIELDS_SESSION** - the name of session id field within sessions table
- **AUTH_SESSION_FIELDS_USER** - the name of user id field within sessions table

## Advanced usage
You can pass options to constructor to fine-tune the results.
```js
const model = new modelClass({
    logger: customLogger, // custom logger function to output error messages. Defaults to console.log
    queries: { ... },
    ... // To be continued...
})
```