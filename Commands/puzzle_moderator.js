﻿const settings = include('Configs/settings.json');

module.exports.config = {
    name: "puzzle_moderator",
    description: "Solves or unsolves a puzzle.",
    details: 'Solves or unsolves a puzzle. You may specify an outcome, if the puzzle has more than one solution. '
        + 'You may specify a player to solve the puzzle. If you do, players in the room '
        + 'will be notified, so you should generally give a string for the bot to use, '
        + 'otherwise the bot will say "[player] uses the [puzzle]." which may not sound right. '
        + "If you specify a player, only puzzles in the room that player is in can be solved/unsolved. "
        + 'Additionally, if you specify a player, you can make them attempt to solve a puzzle. '
        + 'You can also use a room name instead of a player name. In that case, only puzzles in the room '
        + 'you specify can be solved/unsolved. This is useful if you have multiple puzzles with the same name '
        + 'spread across the map. This should generally only be used for puzzles which require moderator intervention.',
    usage: `${settings.commandPrefix}puzzle solve button\n`
        + `${settings.commandPrefix}puzzle unsolve keypad\n`
        + `${settings.commandPrefix}solve binder taylor\n`
        + `${settings.commandPrefix}unsolve lever colin\n`
        + `${settings.commandPrefix}solve computer PASSWORD1\n`
        + `${settings.commandPrefix}solve computer PASSWORD2\n`
        + `${settings.commandPrefix}puzzle solve keypad tool shed\n`
        + `${settings.commandPrefix}puzzle unsolve lock men's locker room\n`
        + `${settings.commandPrefix}solve paintings emily "Emily removes the PAINTINGS from the wall."\n`
        + `${settings.commandPrefix}unsolve lock men's locker room "The LOCK on LOCKER 1 locks itself"\n`
        + `${settings.commandPrefix}puzzle attempt cyptex lock 05-25-99 scarlet`,
    usableBy: "Moderator",
    aliases: ["puzzle", "solve", "unsolve", "attempt"],
    requiresGame: true
};

module.exports.run = async (bot, game, message, command, args) => {
    var input = command + " " + args.join(" ");
    if (command === "puzzle") {
        if (args[0] === "solve") command = "solve";
        else if (args[0] === "unsolve") command = "unsolve";
        else if (args[0] === "attempt") command = "attempt";
        input = input.substring(input.indexOf(args[1]));
        args = input.split(" ");
    }
    else input = args.join(" ");

    if (args.length === 0)
        return game.messageHandler.addReply(message, `You need to input all required arguments. Usage:\n${exports.config.usage}`);

    // The message, if it exists, is the easiest to find at the beginning. Look for that first.
    var announcement = "";
    var index = input.indexOf('"');
    if (index === -1) index = input.indexOf('“');
    if (index !== -1) {
        announcement = input.substring(index + 1);
        // Remove the announcement from the list of arguments.
        input = input.substring(0, index - 1);
        args = input.split(" ");
        // Now clean up the announcement text.
        if (announcement.endsWith('"') || announcement.endsWith('”'))
            announcement = announcement.substring(0, announcement.length - 1);
        if (!announcement.endsWith('.') && !announcement.endsWith('!'))
            announcement += '.';
    }

    // Find the prospective list of puzzles.
    var puzzles = game.puzzles.filter(puzzle => input.toUpperCase().startsWith(puzzle.name + ' ') || input.toUpperCase() === puzzle.name);
    if (puzzles.length > 0) {
        input = input.substring(puzzles[0].name.length).trim();
        args = input.split(" ");
    }

    // Now find the player, who should be the last argument.
    var player = null;
    for (let i = 0; i < game.players_alive.length; i++) {
        if (game.players_alive[i].name.toLowerCase() === args[args.length - 1].toLowerCase()) {
            player = game.players_alive[i];
            args.splice(args.length - 1, 1);
            input = args.join(" ");
            break;
        }
    }

    // If a player wasn't specified, check if a room name was.
    var room = null;
    if (player === null) {
        const parsedInput = input.replace(/\'/g, "").replace(/ /g, "-").toLowerCase();
        for (let i = 0; i < game.rooms.length; i++) {
            if (parsedInput.endsWith(game.rooms[i].name)) {
                room = game.rooms[i];
                input = input.substring(0, parsedInput.indexOf(room.name) - 1);
                break;
            }
        }
    }

    // Finally, find the puzzle.
    var puzzle = null;
    for (let i = 0; i < puzzles.length; i++) {
        if ((player !== null && puzzles[i].location.name === player.location.name)
            || (room !== null && puzzles[i].location.name === room.name)) {
            puzzle = puzzles[i];
            break;
        }
    }
    if (puzzle === null && player === null && room === null && puzzles.length > 0) puzzle = puzzles[0];
    else if (puzzle === null) return game.messageHandler.addReply(message, `Couldn't find puzzle "${input}".`);

    var outcome = "";
    var targetPlayer = null;
    if (player !== null && puzzle.type === "room player") {
        for (let i = 0; i < game.players_alive.length; i++) {
            if (game.players_alive[i].location.name === player.location.name &&
                (game.players_alive[i].displayName.toLowerCase() === input.toLowerCase() || game.players_alive[i].name.toLowerCase() === input.toLowerCase())) {
                targetPlayer = game.players_alive[i];
                break;
            }
        }
    }
    for (let i = 0; i < puzzle.solutions.length; i++) {
        if (targetPlayer && puzzle.solutions[i].toLowerCase() === targetPlayer.displayName.toLowerCase() ||
            puzzle.type !== "room player" && puzzle.solutions[i].toLowerCase() === input.toLowerCase()) {
            outcome = puzzle.solutions[i];
            break;
        }
    }

    if (announcement === "" && player !== null) announcement = `${player.displayName} uses the ${puzzle.name}.`;

    if (command === "solve") {
        if (puzzle.solutions.length > 1 && input !== "" && outcome === "") return game.messageHandler.addReply(message, `"${input}" is not a valid solution.`);
        puzzle.solve(bot, game, player, announcement, outcome, true, targetPlayer);
        game.messageHandler.addGameMechanicMessage(message.channel, `Successfully solved ${puzzle.name}.`);
    }
    else if (command === "unsolve") {
        puzzle.unsolve(bot, game, player, announcement, null, true);
        game.messageHandler.addGameMechanicMessage(message.channel, `Successfully unsolved ${puzzle.name}.`);
    }
    else if (command === "attempt") {
        if (player === null) return game.messageHandler.addReply(message, `Cannot attempt a puzzle without a player.`);
        const misc = {
            command: command,
            input: input,
            message: message,
            targetPlayer: targetPlayer
        };
        player.attemptPuzzle(bot, game, puzzle, null, input, command, misc);
        game.messageHandler.addGameMechanicMessage(message.channel, `Successfully attempted ${puzzle.name} for ${player.name}.`);
    }

    return;
};
