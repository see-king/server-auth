require("dotenv").config()
const modelClass = require("./model")


const pool = require("../db/remote")
const model = new modelClass( pool )
const newUser = {
    email: "new@new.new", 
    password: "qwerty1234", 
    name:"New User"
}

const test = async() => {
    try{
        console.log("Logging in with wrong data")
        const token = await model.login("abc")
        console.log("Login result", token  )
    } catch(e){

    }

    try{
        console.log("\nRegister a new user with wrong email")
        const registered = await model.register( {...newUser, email: "asd"} )
        console.log("Registration result", registered, ", Error:", model.error  )
    } catch(e){
        console.log("Error registering user", e)
    }

    try{
        console.log("\nRegister a new user with wrong password")
        const registered = await model.register( {...newUser, password: ""} )
        console.log("Registration result", registered , ", Error:", model.error )
    } catch(e){
        console.log("Error registering user", e)
    }

    try{
        console.log("\nRegister a new user with wrong name")
        const registered = await model.register( {...newUser, name: "A"} )
        console.log("Registration result", registered, ", Error:", model.error  )
    } catch(e){
        console.log("Error registering user", e)
    }

    try{
        console.log("\nRegister a new user with correct data")
        const registered = await model.register( {...newUser} )
        console.log("Registration result", registered, ", Error:", model.error  )
    } catch(e){
        console.log("Error registering user", e)
    }

    try{
        console.log("\nLogging in with new user's data")
        const token = await model.login( newUser.email, newUser.password)
        console.log("Login result", token , ", Error:", model.error )

        console.log("Verifying received token")
        const tokenData = await model.verifyToken(token)
        console.log("Token data:", tokenData, ", Error:", model.error  )
    } catch(e){
        console.log("Error registering user", e)
    }
        

    
}

test().then( process.exit )