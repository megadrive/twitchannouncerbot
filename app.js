"use strict";

let config = require("./config");
let db = require("./db")

let request = require("request");
let Discord = require("discord.js");
let bot = new Discord.Client();

bot.on("ready", function(){
	console.info("Twitch AnnouncerBot ready!");

	bot.user.setGame("with itself");
	bot.user.setUsername("AnnouncerBot");
	bot.user.setAvatar("https://pbs.twimg.com/profile_images/509073338191183872/fYdty6yd.png");

	checkIfOnline(); // fire once, then start loop
	setInterval(checkIfOnline, 60000);
});

bot.on("message", function(msg){
	// do not respond to bots
	if(msg.author.bot)
		return;

	checkIfOnline();

	for(let key in commands){
		if(msg.content.startsWith(config.prefix + key)){
			commands[key](msg);
		}
	}
});

bot.login(config.oauth);

let commands = {
	/**
	 * Output all available commands.
	 */
	"commands": function(msg){
		console.info("Running command: commands");

		msg.channel.sendMessage(config.prefix + Object.keys(commands).join(", " + config.prefix))
	},

	/**
	 * Set a user's stream username.
	 */
	"stream_username": function(msg){
		console.info("Running command: stream_username");

		let table_name = "stream_username";
		let args = msg.content.split(/\s+/);

		if(args[1] !== undefined){
			db.find(table_name, {"guild_id": msg.guild.id, "author_id": msg.author.id})
				.then(function(users){
					if(users.length){
						db.update(table_name, {"author_id": msg.author.id}, {"twitch_username": args[1], "is_up": false, "guild_id": msg.guild.id})
							.then(function(){
								msg.channel.sendMessage(msg.author.username + " -> Updated your twitch username.");
							})
					}
					else{
						db.insert(table_name, {"author_id": msg.author.id, "twitch_username": args[1], "is_up": false, "guild_id": msg.guild.id})
							.then(function(){
								msg.channel.sendMessage(msg.author.username + " -> Updated your twitch username.");
							})
					}
				});
		}
		else {
			msg.channel.sendMessage(msg.author.username + " -> Usage: !stream_username yourtwitchusername");
		}
	},

	/**
	 * Set the output channel when a stream goes online.
	 */
	"output_channel": function(msg){
		console.info("Running command: output_channel");

		if(Object.keys(msg.mentions.channels).length){
			let channel = msg.mentions.channels.first();
			let table_name = "output_channel";

			db.find(table_name, {"guild_id": channel.guild.id})
				.then(function(data){
					// If exists, update.
					if(data.length){
						db.update(table_name, {"guild_id": channel.guild.id}, {"output_channel": channel.id})
							.then(function(){
								msg.channel.sendMessage("Set stream announce channel to #" + channel.name);
							});
					}
					// If not, insert
					else {
						db.insert(table_name, {
							"guild_id": channel.guild.id,
							"output_channel": channel.id
						})
							.then(function(){
								msg.channel.sendMessage("Set stream announce channel to #" + channel.name);
							})
					}
				});
		}
		else {
			msg.channel.sendMessage(msg.author.username + " -> Usage: !output_channel #announcement_channel_here");
		}
	},

	// TEST COMMANDS
	"test_announce": function(msg){
		console.log("Running command: test_announce");

		announce({
			"author_id":msg.author.id,
			"twitch_username":"megadriving",
			"is_up":false,
			"guild_id":msg.guild.id
		});
	}
};

/**
 * Loop and announce if a user has started streaming.
 */
function checkIfOnline(){
	db.findAll("stream_username")
		.then(function(usernames){
			let api = "https://api.twitch.tv/kraken/streams/";
			let opts = {
				url: "",
				headers: {
					"Accept": "application/vnd.twitchtv.v3+json",
					"Client-ID": config.twitch_client_id
				}
			};

			for(let i = 0; i < usernames.length; i++) {
				opts.url = api + usernames[i].twitch_username;
				request(opts, function(err, res, body){
					if(err)
						console.error(err);

					db.find("stream_username", {"twitch_username": usernames[i].twitch_username})
						.then(function(username){
							let is_currently_streaming = username[0].is_up;
							let stream_data = JSON.parse(body);

							if(stream_data.stream){
								if(is_currently_streaming !== true){
									db.update("stream_username", {"twitch_username": usernames[i].twitch_username}, {"is_up": true})
										.then(function(){
											console.info(usernames[i].twitch_username + " has started streaming.");
											announce(usernames[i], stream_data);
										});
								}
							}
							else{
								if(is_currently_streaming !== false){
									db.update("stream_username", {"twitch_username": usernames[i].twitch_username}, {"is_up": false})
										.then(function(){
											console.info(usernames[i].twitch_username + " has stopped streaming.");
										});
								}
							}
						});

				});
			}
		});
}

/**
 * Announce to a channel if it exists.
 *
 * @param      {ForerunnerDB::Document}  username_document  The username document
 */
function announce(username_document, stream_data){
	bot.fetchUser(username_document.author_id)
		.then(function(user){
			db.find("output_channel", {"guild_id": username_document.guild_id})
				.then(function(channels){
					if(channels.length === 0)
						return;

					let channel = bot.channels.find('id', channels[0].output_channel);
					channel.sendMessage("**" + user.username + "** is now streaming **" + stream_data.stream.game + "** live on Twitch! http://twitch.tv/" + username_document.twitch_username)
						.then(message => console.log(`Sent message: ${message.content}`))
						.catch(console.error);
				});
		});
}
