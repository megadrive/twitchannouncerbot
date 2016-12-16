"use strict"

let oauth = require("./oauth.inc.js")

module.exports = {
	"elevated_users": oauth.elevated_users,
	"prefix": "!",
	"oauth": oauth.token,
	"twitch_client_id": oauth.twitch_client_id
}
