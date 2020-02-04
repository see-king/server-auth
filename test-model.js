require("dotenv").config()
const modelClass = require(".")
const clr = require('./cli-colors')

const { INIT_CWD } = process.env;

const newUser = {
    email: "new@new.new",
    password: "qwerty1234",
    name: "New User"
}

console.log("\nRunning in [", INIT_CWD, "]\n")


const test = async () => {

    const model = new modelClass()
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
            console.log(clr.Blue + "\nRegister a new user with correct data" + clr.Reset)
            const registered = await model.register({ ...newUser })
            console.log("Registration result", registered, ", Error:", model.error)
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
    
    
    
            }
    
        } catch (e) {
            console.log("Error registering user", e)
        }
    
    }

    


}


test().then(process.exit)
