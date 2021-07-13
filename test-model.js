require("dotenv").config()
const modelClass = require(".")
const clr = require('./cli-colors')
const joi = require("joi")
const uniqid = require("uniqid")
const ENV = process.env

const { INIT_CWD, AUTH_TEST_FIELDS } = ENV;


const userLoginField = ENV.AUTH_USER_FIELDS_LOGIN || 'email'
const userPasswordField = ENV.AUTH_USER_FIELDS_PASSWORD || 'password'
const verificationUSer = 
    {
        [userLoginField]: joi.string().email().required(),
        [userPasswordField]: joi.string().min(6).required()
    }

const newUser = {
    [userLoginField]: `test_user_${uniqid()}@new.new`,
    [userPasswordField]: "qwerty1234",
}

// AUTH_TEST_FIELDS is a value for additional field in test user.
// these are set as a string with the next format: fieldName1|defaultValue1,fieldName2|defaultValue2
if (AUTH_TEST_FIELDS){
    testFields = AUTH_TEST_FIELDS.split(",").map( item => item.split("|"))

    console.log( "\nFound additional fields, updating test user...")
    // populate test user and verification
    testFields.map( item => {
        [fname, fval] = item

        console.log("Adding field:", fname, "with value:", fval)
        // update user
        newUser[fname] = fval
        // update verification

        verificationUSer[fname] = joi.string()
    })

    console.log("Verification object:", Object.keys(verificationUSer) )
}

const verification = { user: joi.object(verificationUSer) }


console.log("\nRunning in [", INIT_CWD, "]\n")


const test = async () => {

    const model = new modelClass()
    const modelWithMoreFields = new modelClass({
        verification
    })

    let connected = false

    // check connection
    try{
        console.log( clr.Blue + "Checking connection..." + clr.Reset)
        connected = await model.checkConnection();
        if( !connected ){
            console.log( clr.Yellow + "DB Connection was refused")
            console.log( "Please add the next values to .env in order to configure DB connection:")
            console.log("AUTH_DB_HOST")
            console.log("AUTH_DB_PORT")
            console.log("AUTH_DB_DB")
            console.log("AUTH_DB_USER")
            console.log("AUTH_DB_PASSWORD \n\n" + clr.Reset )
        } else {
            console.log( clr.Green + "Connection established\n\n" + clr.Reset)
        }
    } catch (e ){}


    

    // continue only if connected
    if( connected ){

        try {
            console.log(clr.Blue + "Logging in with wrong data" + clr.Reset)
            const token = await model.login("abc")
            if( !token ){
                if( model.error === "Connection refused" ){
                    
                }
            } else {
                connected = true;
                console.log("Login result", token)
            }
            
        } catch (e) {
    
        }

        try {
            console.log(clr.Blue + "\nRegister a new user with wrong email" + clr.Reset)
            const registered = await model.register({ ...newUser, email: "asd" })
            console.log("Registration result", registered, ", Error:", model.error)
        } catch (e) {
            console.log("Error registering user", e)
        }
    
        try {
            console.log(clr.Blue + "\nRegister a new user with wrong password" + clr.Reset)
            const registered = await model.register({ ...newUser, password: "" })
            console.log("Registration result", registered, ", Error:", model.error)
        } catch (e) {
            console.log("Error registering user", e)
        }
    
        try {
            console.log(clr.Blue + "\nRegister a new user with wrong name" + clr.Reset)
            const registered = await model.register({ ...newUser, name: "A" })
            console.log("Registration result", registered, ", Error:", model.error)
        } catch (e) {
            console.log("Error registering user", e)
        }
    
        try {
            console.log(clr.Blue + "\nRegister a new user with wrong additional field" + clr.Reset)
            const registered = await model.register({ ...newUser, wrongField: "some value" })
            console.log("Registration result", registered, ", Error:", model.error)
        } catch (e) {
            console.log("Error registering user", e)
        }
    
        try {
            console.log(clr.Blue + "\nRegister a new user with correct data" + clr.Reset)
            const registered = await modelWithMoreFields.register({ ...newUser })
            console.log("Registration result", registered, ", Error:", modelWithMoreFields.error)
        } catch (e) {
            console.log("Error registering user", e)
        }
    
        try {
            console.log(clr.Blue + "\nLogging in with new user's data" + clr.Reset)
            const token = await model.login(newUser.email, newUser.password)
            console.log("Login result:", token, ", Error:", model.error)
    
            if (!token) {
                console.log(clr.Red + "Could not log in with correct data.")
                console.log(clr.Yellow + "You may try adding next values to .env to ensure correct login process:")
                console.log("AUTH_USER_FIELDS_LOGIN (denotes login field in users table. Defaults to 'email')")
                console.log("AUTH_USER_FIELDS_ID (denotes user id field, defaults to 'id')")
                console.log("AUTH_USER_FIELDS_PASSWORD (denotes password field in users table, defaults to 'password')" + clr.Reset)
            } else {
                console.log(clr.Blue + "Verifying received token" + clr.Reset)
                const tokenData = await model.verifyToken(token)
                console.log("Token data:", tokenData, ", Error:", model.error)
    
                // attempt to renew the token 
                console.log(clr.Blue + "\nAttempt to renew the token" + clr.Reset)
                const token2 = await model.renewToken(token)
                if (token2) {
                    console.log( clr.Green + "Token renewed. fetching token data...")
                    try {
                        const tokenData2 = await model.verifyToken(token2)
                        console.log(clr.Yellow + "New token data: ")
                        console.log(tokenData2);
                        console.log(clr.Reset)
                    } catch (e) {
                        console.log(clr.Yellow + "Error verifying renewed token:" + clr.Reset, e.message)
                    }
                }

                // attempt to login with shouldAuthenticate callback returning false
                console.log(clr.Blue + "attempt to login with shouldAuthenticate callback that returns false" + clr.Reset)
                
                // create callback function that returns false
                let callback = async () => false 

                // setting callback function custom error message
                callback.error ="Wrong credentials"; 

                let res = await model.login(newUser.email, newUser.password, callback )
                console.log( clr.Yellow + "Result:", res, clr.Red + "\nError:", model.error )


                // attempt to login with shouldAuthenticate callback returning null
                console.log(clr.Blue + "attempt to login with shouldAuthenticate callback that returns null" + clr.Reset)
                
                // create callback function that sets its own error and returns null
                callback = async () => { callback.error = "something went wrong..." } 
                
                res = await model.login(newUser.email, newUser.password, callback )
                console.log( clr.Yellow + "Result:", res, clr.Red + "\nError:", model.error )

                
                // attempt to logout
                console.log(clr.Blue + "\nAttempt to logout..." + clr.Reset)
                await model.logout(token)
                console.log(clr.Blue + "\nLogged out" + clr.Reset)
    
    
    
            }
    
        } catch (e) {
            console.log("Error registering user", e)
        }
    
    }

    


}


test().then(process.exit)
