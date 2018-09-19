/*
Logger class for easy and aesthetically pleasing console logging 
*/
const logger = (content, type = "log") => console.log(`${new Date(Date.now()).toLocaleTimeString()} [${type.toUpperCase()}] ${content}`);
logger.error = (content) => logger(content, "error");
logger.warn = (content) => logger(content, "warn");
logger.debug = (content) => logger(content, "debug");
logger.cmd = (content) => logger(content, "cmd");

module.exports = logger;