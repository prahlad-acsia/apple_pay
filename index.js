import express from 'express';
import fetch from 'node-fetch';
import 'dotenv/config';
const app = express();
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
//You will only need this line for localhost self-cert SendGrid REST API
//If you don't plan on using SendGrid with the REST method below or
//if your dev environment isn't localhost but a secure HTTPS standard website URL,
//then you will not need this line and shouldn't use it (for security)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const port = process.env.PORT || 3000;
// const environment = process.env.ENVIRONMENT || 'sandbox';
const environment = process.env.ENVIRONMENT;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
// const endpoint_url = environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const endpoint_url = 'https://api-m.paypal.com';
/**
 * Creates an order and returns it as a JSON response.
 * @function
 * @name createOrder
 * @memberof module:routes
 * @param {object} req - The HTTP request object.
 * @param {object} req.body - The request body containing the order information.
 * @param {string} req.body.intent - The intent of the order.
 * @param {object} res - The HTTP response object.
 * @returns {object} The created order as a JSON response.
 * @throws {Error} If there is an error creating the order.
 */
app.post('/create_order', (req, res) => {
    get_access_token()
        .then(access_token => {
            let order_data_json = {
                'intent': req.body.intent.toUpperCase(),
                'purchase_units': [{
                    'amount': {
                        'currency_code': 'USD',
                        'value': '1.0'
                    }
                }]
            };

            const data = JSON.stringify(order_data_json)

            fetch(endpoint_url + '/v2/checkout/orders', { //https://developer.paypal.com/docs/api/orders/v2/#orders_create
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${access_token}`
                    },
                    body: data
                })
                .then(res => res.json())
                .then(json => {
                    res.send(json);
                }) //Send minimal data to client
        })
        .catch(err => {
            console.log(err);
            res.status(500).send(err)
        })
});

/**
 * Completes an order and returns it as a JSON response.
 * @function
 * @name completeOrder
 * @memberof module:routes
 * @param {object} req - The HTTP request object.
 * @param {object} req.body - The request body containing the order ID and intent.
 * @param {string} req.body.order_id - The ID of the order to complete.
 * @param {string} req.body.intent - The intent of the order.
 * @param {string} [req.body.email] - Optional email to send receipt.
 * @param {object} res - The HTTP response object.
 * @returns {object} The completed order as a JSON response.
 * @throws {Error} If there is an error completing the order.
 */
app.post('/complete_order', (req, res) => {
    get_access_token()
        .then(access_token => {
            fetch(endpoint_url + '/v2/checkout/orders/' + req.body.order_id + '/' + req.body.intent, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${access_token}`
                    }
                })
                .then(res => res.json())
                .then(json => {
                    console.log(json);
                    let intent_object = req.body.intent === "authorize" ? "authorizations" : "captures";
                    //Remove this if you don't want to send email with SendGrid
                  if (json.purchase_units[0].payments[intent_object][0].status === "COMPLETED") {
                      send_email_receipt({"id": json.id, "email": req.body.email});
                    }
                    res.send(json);
                }) //Send minimal data to client
        })
        .catch(err => {
            console.log(err);
            res.status(500).send(err)
        })
});

/**
 * Retrieves a client token and returns it as a JSON response.
 * @function
 * @name getClientToken
 * @memberof module:routes
 * @param {object} req - The HTTP request object.
 * @param {object} req.body - The request body containing the access token and optional customer ID.
 * @param {string} req.body.access_token - The access token used for authorization.
 * @param {string} [req.body.customer_id] - Optional customer ID to be included in the request.
 * @param {object} res - The HTTP response object.
 * @returns {object} The client token as a JSON response.
 * @throws {Error} If there is an error retrieving the client token.
 */
app.post("/get_client_token", (req, res) => {
    get_access_token()
      .then((access_token) => {
        const payload = req.body.customer_id
          ? JSON.stringify({ customer_id: req.body.customer_id })
          : null;
  
        fetch(endpoint_url + "/v1/identity/generate-token", {
          method: "post",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: payload,
        })
          .then((response) => response.json())
          .then((data) => res.send(data.client_token));
      })
      .catch((error) => {
        console.error("Error:", error);
        res.status(500).send("An error occurred while processing the request.");
      });
  });

app.get("/.well-known/apple-developer-merchantid-domain-association", (req, res) => {
  res.sendFile(process.cwd() + '/apple-developer-merchantid-domain-association');
});
  

// Helper / Utility functions

//Servers the index.html file
app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/index.html');
});
//Servers the style.css file
app.get('/style.css', (req, res) => {
    res.sendFile(process.cwd() + '/style.css');
});
//Servers the script.js file
app.get('/script.js', (req, res) => {
    res.sendFile(process.cwd() + '/script.js');
});

console.log("env__",environment);

//PayPal Developer YouTube Video:
//How to Retrieve an API Access Token (Node.js)
//https://www.youtube.com/watch?v=HOkkbGSxmp4
function get_access_token() {
    const auth = `${client_id}:${client_secret}`
    const data = 'grant_type=client_credentials'
    return fetch(endpoint_url + '/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(auth).toString('base64')}`
            },
            body: data
        })
        .then(res => res.json())
        .then(json => {
            return json.access_token;
        })
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
})
console.log("Test 2");
