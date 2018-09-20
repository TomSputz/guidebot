exports.run = async (client, message) => client.coloredEmbed(message.channel, message.author.username + "'s permission level", message.author.permLevel + " - " + client.config.permLevels.find(l => l.level === message.author.permLevel).name, 0x7289DA);

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: [],
  permLevel: "User"
};

exports.help = {
  name: "mylevel",
  category: "Miscelaneous",
  description: "Tells you your permission level for the current message location.",
  usage: "mylevel"
};
