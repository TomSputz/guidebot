module.exports = client => {
  // Log that the bot is online.
  client.logger(`${client.user.tag}, ready to serve ${client.users.size} users in ${client.guilds.size} servers.`, "ready");

  // Make the bot activity 'Listening to amy mentions', alluding to the mention functionality that can tell users the prefix to use.
  client.user.setActivity("any mentions", {type: "LISTENING"});
};
