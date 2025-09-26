const settings = include('Configs/settings.json');
const constants = include('Configs/constants.json');
const serverconfig = include('Configs/serverconfig.json');
const saver = include(`${constants.modulesDir}/saver.js`);
const serverManager = include(`${constants.modulesDir}/serverManager.js`);

const { ChannelType } = require("../node_modules/discord-api-types/v10");

module.exports.config = {
    name: "setupdemo_moderator",
    description: "Sets up a demo game.",
    details: "Populates an empty spreadsheet with default game data as defined in the demodata config file. "
        + "This will create a game environment to demonstrate most of the basics of Neo World Program gameplay. "
        + "By default, it will generate 2 rooms, 8 objects, 14 prefabs, 3 recipes, 3 items, 1 puzzle, 1 event, "
        + "13 status effects, and 6 gestures. If the channels for the demo game's rooms don't exist, they will be "
        + "created automatically. It will not create any players for you. Once this command is used you can use "
        + `the ${settings.commandPrefix}startgame command to add players, or manually add them on the spreadsheet. `
        + "It is recommended that you have at least one other Discord account to use as a player. "
        + `Once the spreadsheet has been fully populated, you can use ${settings.commandPrefix}load all start `
        + "to begin the demo. **If there is already data on the spreadsheet, it will be overwritten. Only use "
        + "this command if the spreadsheet is currently blank.**",
    usage: `${settings.commandPrefix}setupdemo`,
    usableBy: "Moderator",
    aliases: ["setupdemo"],
    requiresGame: false
};

module.exports.run = async (bot, game, message, command, args) => {
    if (game.inProgress) return game.messageHandler.addReply(message, `You can't use this command while a game is in progress.`);

    try {
        var roomValues = await saver.setupdemo();

        // Ensure that a room category exists.
        let roomCategories = serverconfig.roomCategories.split(",");
        let roomCategory = null;
        if (roomCategories.length === 0 || roomCategories.length === 1 && roomCategories[0] === "") {
            try {
                roomCategory = await serverManager.createCategory(game.guild, "Rooms");
                await serverManager.registerRoomCategory(roomCategory);
            }
            catch (err) {
                game.messageHandler.addGameMechanicMessage(message.channel, err);
            }
        }
        else roomCategory = await game.guild.channels.fetch(roomCategories[0].trim());

        // Create the room channels, if they don't already exist.
        if (roomCategory) {
            for (let i = 0; i < roomValues.length; i++) {
                let channel = game.guild.channels.cache.find(channel => channel.name === roomValues[i][0]);
                if (!channel) {
                    await game.guild.channels.create({
                        name: roomValues[i][0],
                        type: ChannelType.GuildText,
                        parent: roomCategory
                    });
                }
            }

            game.messageHandler.addGameMechanicMessage(message.channel,
                "The spreadsheet was populated with demo data. Once you've populated the Players sheet, either manually or with the "
                + `${settings.commandPrefix}startgame command in conjuction with the ${settings.commandPrefix}play command, `
                + `use ${settings.commandPrefix}load all start to begin the demo.`
            );
        }
        else return game.messageHandler.addGameMechanicMessage(message.channel, "The spreadsheet was populated with demo data, but there was an error finding a room category to contain the new room channels.");
    }
    catch (err) {
        console.log(err);
        game.messageHandler.addGameMechanicMessage(message.channel, "There was an error saving data to the spreadsheet. Error:\n```" + err + "```");
    }

    return;
};
