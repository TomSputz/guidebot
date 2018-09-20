module.exports = {
  run: (client, message) => client.coloredEmbed(message.channel, message.author.username + "'s permission level", message.author.permLevel + " - " + client.config.permLevels.find(l => l.level === message.author.permLevel).name, 0x7289DA),

  conf: {
    enabled: true,
    guildOnly: true,
    aliases: [],
    permLevel: "User"
  },
  
  help: {
    name: "mylevel",
    category: "Miscelaneous",
    description: "Tells you your permission level for the current message location.",
    usage: "mylevel"
  }
};