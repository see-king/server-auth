/**
 * Testing the UserAuth class
 */

const authClass = require('./user-auth')

// server 1
const auth = new authClass("12345")

// server 2
const auth2 = new authClass("12345")
const password = "abcdef12345"
const clr = require('./cli-colors')

const log = (text, color) => console.log( clr._C(text, color) )

const test = async() =>{
    log(`Checking the UserAuth class`, "Green")
    console.log("Creating password hash")
    const hash = await auth.hash( password )
    log( clr._C(`hash is: ${hash}`, "Cyan") )
    
    log("\nAuthenticating with wrong password")
    const wrongResult = await auth.auth("aaaaa", hash )
    log(`authentication result: ${wrongResult}`, "Cyan")

    log( `\nAuthenticating with right password and payload=${{userId: 12}}` )
    const rightResult = await auth.auth( password, hash , {userId: 12} )
    log(`authentication result (must be a token): ${rightResult}`, "Cyan")

    log( `\nAuthenticating with right password and payload=${{userId: 12}} on another server with same key` )
    const rightResult2 = await auth2.auth( password, hash , {userId: 12} )
    log(`authentication result (must be a token): ${rightResult2}`, "Cyan")

    if( rightResult ){
        
        log("\nVerifying received token")        
        const decrypt1 = auth.verifyToken(rightResult)
        if(decrypt1){
            log(  `Verification result:`, "Cyan")
            console.log(decrypt1)
        }        

        log("\nVerifying received token on another server with same key")        
        const decrypt1_1 = auth2.verifyToken(rightResult)
        if(decrypt1_1){
            log(  `Verification result:`, "Cyan");
            console.log(decrypt1_1)
        }        
    }

    log( `\nAuthenticating with right password and expiration time of 1 second` )
    const oneSecondToken = await auth.auth( password, hash , {userId: 13}, (1/60) )
    log(`authentication result (must be a token): ${oneSecondToken}`, "Cyan")
    if( oneSecondToken ){

        log("Waiting two seconds...")        
        setTimeout( ()=>{
            
            log("\nVerifying one-second token")        
            const decrypt2 = auth.verifyToken(oneSecondToken)
            if(decrypt2){
                log( `Verification result:`, "Cyan") 
                console.log(decrypt2, `Now: ${Date.now()}`)
            }        

            log("\nVerifying one-second token with ignore expiration option")        
            const decrypt3 = auth.verifyToken(oneSecondToken, {ignoreExpiration: true})
            if(decrypt3){
                log( `Verification result:`, "Cyan")
                console.log( decrypt3, `Now: ${Date.now()}`)
            }        

            log(`\nFinished testing\n\n`, "Green")
        }, 2000 )
        
    } else {
        log(`\nFinished testing\n\n`, "Green")
    }

    


}


test()