/**
 * Testing the UserAuth class
 */

const authClass = require('./index')

// server 1
const auth = new authClass("12345")

// server 2
const auth2 = new authClass("12345")


const password = "abcdef12345"

const clr = {
    Black: '\u001b[30m',
    Red: '\u001b[31m',
    Green: '\u001b[32m',
    Yellow: '\u001b[33m',
    Blue: '\u001b[34m',
    Magenta: '\u001b[35m',
    Cyan: '\u001b[36m',
    White: '\u001b[37m',
    Reset: '\u001b[0m'
}

const test = async() =>{
    console.log(`\n\n\n${clr.Green}Checking the UserAuth class${clr.Reset}\n`)
    console.log("Creating password hash")
    const hash = await auth.hash( password )
    console.log(`${clr.Cyan}hash is: ${hash}${clr.Reset}`)
    
    console.log("\nAuthenticating with wrong password")
    const wrongResult = await auth.auth("aaaaa", hash )
    console.log(`${clr.Cyan}authentication result: ${wrongResult}${clr.Reset}`)

    console.log( `\nAuthenticating with right password and payload=${{userId: 12}}` )
    const rightResult = await auth.auth( password, hash , {userId: 12} )
    console.log(`${clr.Cyan}authentication result (must be a token): ${rightResult}${clr.Reset}`)

    console.log( `\nAuthenticating with right password and payload=${{userId: 12}} on another server with same key` )
    const rightResult2 = await auth2.auth( password, hash , {userId: 12} )
    console.log(`${clr.Cyan}authentication result (must be a token): ${rightResult2}${clr.Reset}`)

    if( rightResult ){
        
        console.log("\nVerifying received token")        
        const decrypt1 = auth.verifyToken(rightResult)
        if(decrypt1){
            console.log(  `${clr.Cyan}Verification result:`, decrypt1)
        }        

        console.log("\nVerifying received token on another server with same key")        
        const decrypt1_1 = auth2.verifyToken(rightResult)
        if(decrypt1_1){
            console.log(  `${clr.Cyan}Verification result:`, decrypt1_1)
        }        
    }

    console.log( `\nAuthenticating with right password and expiration time of 1 second` )
    const oneSecondToken = await auth.auth( password, hash , {userId: 13}, (1/60) )
    console.log(`${clr.Cyan}authentication result (must be a token): ${oneSecondToken}${clr.Reset}`)
    if( oneSecondToken ){

        console.log("Waiting two seconds...")        
        setTimeout( ()=>{
            
            console.log("\nVerifying one-second token")        
            const decrypt2 = auth.verifyToken(oneSecondToken)
            if(decrypt2){
                console.log( `${clr.Cyan}Verification result:${clr.Reset}`, decrypt2, `Now: ${Date.now()}`)
            }        

            console.log("\nVerifying one-second token with ignore expiration option")        
            const decrypt3 = auth.verifyToken(oneSecondToken, {ignoreExpiration: true})
            if(decrypt3){
                console.log( `${clr.Cyan}Verification result:${clr.Reset}`, decrypt3, `Now: ${Date.now()}`)
            }        

            console.log(`${clr.Green}\nFinished testing\n\n${clr.Reset}`)
        }, 2000 )
        
    } else {
        console.log(`${clr.Green}\nFinished testing\n\n${clr.Reset}`)
    }

    


}


test()