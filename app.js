"use strict";

const config = require("./config");
const db = require("./db")

const request = require("request");
const Discord = require("discord.js");
const bot = new Discord.Client();

const time = {
	"seconds": v => v * 1000,
	"minutes": v => v * 60000,
	"hours": v => v * 3600000
};

bot.on("ready", function(){
	console.info("AnnouncerBot ready!");

	bot.user.setUsername("AnnouncerBot");

	checkIfOnline(); // fire once, then start loop
	setInterval(checkIfOnline, time.minutes(1));
});

bot.on("message", function(msg){
	// do not respond to bots
	if(msg.author.bot)
		return;

	for(const key in commands){
		if(msg.content.startsWith(config.prefix + key)){
			commands[key](msg);
		}
	}
});

bot.login(config.oauth);

const commands = {
	/**
	 * Output all available commands.
	 */
	"commands": function(msg){
		console.info("Running command: commands");

		msg.channel.sendMessage(config.prefix + Object.keys(commands).join(", " + config.prefix))
	},

	/**
	 * Change AnnouncerBot's now-playing game. Only nominated users can do this command.
	 * @elevated
	 */
	"set_game": function(msg){
		if(config.elevated_users.indexOf(msg.author.id) === -1)
			return;

		const game = msg.content.split(/\s+/).slice(1).join(' ');
		if(game.length > 3){
			bot.user.setGame(game)
				.then(function(user){
					msg.channel.sendMessage(msg.author.username + " -> Updated what I'm 'playing'.")
						.then(message => message.delete(time.minutes(1)));
				})
				.catch(function(err){
					console.error(err);
				});
		}
	},

	/**
	 * Set a user's stream username.
	 */
	"stream_username": function(msg){
		console.info("Running command: stream_username");

		const table_name = "stream_username";
		const args = msg.content.split(/\s+/);

		if(args[1] !== undefined){
			db.find(table_name, {"guild_id": msg.guild.id, "author_id": msg.author.id})
				.then(function(users){
					if(users.length){
						db.update(table_name, {"author_id": msg.author.id}, {"twitch_username": args[1], "is_up": false, "guild_id": msg.guild.id})
							.then(function(){
								msg.channel.sendMessage(msg.author.username + " -> Updated your twitch username.")
									.then(message => message.delete(time.minutes(1)));
							})
					}
					else{
						db.insert(table_name, {"author_id": msg.author.id, "twitch_username": args[1], "is_up": false, "guild_id": msg.guild.id})
							.then(function(){
								msg.channel.sendMessage(msg.author.username + " -> Updated your twitch username.")
									.then(message => message.delete(time.minutes(1)));
							})
					}
				});
		}
		else {
			db.find(table_name, {"guild_id": msg.guild.id, "author_id": msg.author.id})
				.then(function(users){
					const message = msg.author.username + " -> Usage: `!stream_username yourtwitchusername`";
					if(users.length){
						message += " | Current username is: `" + users[0].twitch_username + "`";
					}

					msg.channel.sendMessage(message)
						.then(message => message.delete(time.minutes(1)));
				});

		}
	},

	/**
	 * Set the output channel when a stream goes online.
	 */
	"output_channel": function(msg){
		console.info("Running command: output_channel");

		const table_name = "output_channel";
		if(msg.mentions.channels.array().length){
			const channel = msg.mentions.channels.first();

			db.find(table_name, {"guild_id": channel.guild.id})
				.then(function(data){
					// If exists, update.
					if(data.length){
						db.update(table_name, {"guild_id": channel.guild.id}, {"output_channel": channel.id})
							.then(function(){
								msg.channel.sendMessage("Set stream announce channel to `#" + channel.name + "`.")
									.then(message => message.delete(time.minutes(1)));
							});
					}
					// If not, insert
					else {
						db.insert(table_name, {
							"guild_id": channel.guild.id,
							"output_channel": channel.id
						})
							.then(function(){
								msg.channel.sendMessage("Set stream announce channel to `#" + channel.name + "`.")
									.then(message => message.delete(time.minutes(1)));
							})
					}
				});
		}
		else {
			db.find(table_name, {"guild_id": msg.channel.guild.id})
				.then(function(channels){
					const channel_name = null;
					if(channels.length){
						const channel = bot.channels.find("id", channels[0].output_channel);
						if(channel){
							channel_name = channel.name;
						}
					}

					const message = msg.author.username + " -> Usage: `!output_channel #announcement_channel_here`";
					if(channel_name)
						message += " | Current channel is: `#" + channel_name + "`";

					msg.channel.sendMessage(message)
						.then(message => message.delete(time.minutes(1)));
				});
		}
	},

	/**
	 * Simulates (with argument) when a channel goes online or offline.
	 * @elevated
	 */
	"simulate": function(msg){
		if(config.elevated_users.indexOf(msg.author.id) === -1)
			return;

		const args = msg.content.split(/\s+/);

		const simulated = {
			"guild_id": 1,
			"author_id": 50
			"channel_id": 100,
			"output_channel": test_channel,
			"is_up": args[0] ? args[0] : false
		};

		db.find("stream_username", {"guild_id": simulated.guild_id, "author_id": })
	}
};

/**
 * Loop and announce if a user has started streaming.
 */
function checkIfOnline(){
	db.findAll("stream_username")
		.then(function(usernames){
			const api = "https://api.twitch.tv/kraken/streams/";
			const opts = {
				url: "",
				headers: {
					"Accept": "application/vnd.twitchtv.v3+json",
					"Client-ID": config.twitch_client_id
				}
			};

			for(const i = 0; i < usernames.length; i++) {
				opts.url = api + usernames[i].twitch_username;
				request(opts, function(err, res, body){
					if(err)
						console.error(err);

					db.find("stream_username", {"twitch_username": usernames[i].twitch_username})
						.then(function(username){
							const is_currently_streaming = username[0].is_up;
							const stream_data = JSON.parse(body);

							if(stream_data.stream){
								if(is_currently_streaming !== true){
									db.update("stream_username", {"twitch_username": usernames[i].twitch_username}, {"is_up": true, "announce_message_id": null})
										.then(function(){
											console.info(usernames[i].twitch_username + " has started streaming.");
											announce(usernames[i], stream_data);
										});
								}
							}
							else{
								if(is_currently_streaming !== false){
									db.update("stream_username", {"twitch_username": usernames[i].twitch_username}, {"is_up": false, "announce_message_id": null})
										.then(function(){
											db.find("output_channel", {"guild_id": username[0].guild_id})
												.then(function(channel){
													const chan = bot.channels.find('id', channels[0].output_channel);
													if(chan){
														const announce_msg = chan.fetchMessage(username[0].announce_message_id);
														if(announce_msg){
															announce_msg.delete();
														}
													}
												});
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
 */
function announce(username_document, stream_data){
	bot.fetchUser(username_document.author_id)
		.then(function(user){
			db.find("output_channel", {"guild_id": username_document.guild_id})
				.then(function(channels){
					if(channels.length === 0)
						return;

					const channel = bot.channels.find('id', channels[0].output_channel);
					channel.sendMessage("@here **" + user.username + "** is now streaming **" + stream_data.stream.game + "** live on Twitch! http://twitch.tv/" + username_document.twitch_username)
						.then(function(message){
							db.update("stream_messages", {
								"guild_id": username_document.guild_id,
								"stream_username": username_document[0].stream_username
							}, {
								announce_message_id: message.id
							}).then(function(){
								console.info("> Updated message id: " + message.id);
							});
						})
						.catch(console.error);
				});
		});
}
