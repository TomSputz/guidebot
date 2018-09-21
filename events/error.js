// This event executes whenever the discord library throws an error
module.exports = (client, error) => client.logger.error(`An error event was sent by Discord.js: \n${JSON.stringify(error)}`);
