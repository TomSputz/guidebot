exports.run = (client, message) => client.successEmbed(message.channel, "Bot is shutting down.").then(client.commands.forEach(cmd => client.unloadCommand(cmd)) && process.exit(1));

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: [],
  permLevel: "Bot Admin"
};

exports.help = {
  name: "reboot",
  category: "System",
  description: "Shuts down the bot. If running under PM2, bot will restart automatically.",
  usage: "reboot"
};
