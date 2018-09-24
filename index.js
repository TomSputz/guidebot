// This will check if the node version you are running is the required
// Node version, if it isn't it will throw the following error to inform
// you.
if (Number(process.version.slice(1).split(".")[0]) < 8) throw new Error("Node 8.0.0 or higher is required. Update Node on your system.");

// Load our extensions to the primitive javascript types
require("./modules/JSExtensions");
// Load our custom client
const Client = require("./modules/CustomClient");

const init = async () => {
  // This is your client. Some people call it `bot`, some people call it `self`,
  // some might call it `cootchie`. Either way, when you see `client.something`,
  // or `bot.something`, this is what we're refering to. Your client.
  const client = new Client("./config.js");
  await client.loadCommands("./commands/");
  await client.loadEvents("./events/");
  client.login();
  // End top-level async/await function.
};
init();