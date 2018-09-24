module.exports = {
  run: (client, message) => message.channel.send("Ping?").then(msg => msg.edit(`Pong! Latency is ${msg.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms`)),

  conf: {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: "User"
  },
  
  help: {
    category: "Miscelaneous",
    description: "It like... Pings. Then Pongs. And it's not Ping Pong.",
    usage: "ping"
  }
};