﻿const settings = include('settings.json');
const sheets = include(`${settings.modulesDir}/sheets.js`);

const Exit = include(`${settings.dataDir}/Exit.js`);
const Room = include(`${settings.dataDir}/Room.js`);
const Object = include(`${settings.dataDir}/Object.js`);
const Clue = include(`${settings.dataDir}/Clue.js`);
const Item = include(`${settings.dataDir}/Item.js`);
const Puzzle = include(`${settings.dataDir}/Puzzle.js`);
const InventoryItem = include(`${settings.dataDir}/InventoryItem.js`);
const Status = include(`${settings.dataDir}/Status.js`);
const Player = include(`${settings.dataDir}/Player.js`);

module.exports.loadRooms = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.roomSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnRoomName = 0;
            const columnNumberExits = 1;
            const columnExits = 2;
            const columnUnlocked = 3;
            const columnLeadsTo = 4;
            const columnFrom = 5;

            game.rooms.length = 0;
            for (let i = 1, j = 0; i < sheet.length; i = i + j) {
                var exits = [];
                for (j = 0; j < parseInt(sheet[i][columnNumberExits]); j++) {
                    exits.push(
                        new Exit(
                            sheet[i + j][columnExits],
                            sheet[i + j][columnUnlocked] === "TRUE",
                            sheet[i + j][columnLeadsTo],
                            sheet[i + j][columnFrom],
                            i + j + 1
                        ));
                }
                const channel = game.guild.channels.find(channel => channel.name === sheet[i][columnRoomName]);
                game.rooms.push(
                    new Room(
                        sheet[i][columnRoomName],
                        channel,
                        exits,
                        i + 1
                    )
                );
            }
            // Now go through and make the dest for each exit an actual Room object.
            // Also, add any occupants to the room.
            for (let i = 0; i < game.rooms.length; i++) {
                for (let j = 0; j < game.rooms[i].exit.length; j++) {
                    game.rooms[i].exit[j].dest = game.rooms.find(room => room.name === game.rooms[i].exit[j].dest);
                }
                for (let j = 0; j < game.players_alive.length; j++) {
                    if (game.players_alive[j].location.name === game.rooms[i].name) {
                        game.rooms[i].addPlayer(game, game.players_alive[j], null, null, false);
                    }
                }
            }
            resolve(game);
        });
    });
};

module.exports.loadObjects = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.objectSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnLocation = 1;
            const columnAccessibility = 2;
            const columnRequires = 3;
            const columnHidingSpot = 4;
            const columnPreposition = 5;

            game.objects.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                game.objects.push(
                    new Object(
                        sheet[i][columnName],
                        sheet[i][columnLocation],
                        sheet[i][columnAccessibility] === "TRUE",
                        sheet[i][columnRequires] ? sheet[i][columnRequires] : "",
                        sheet[i][columnHidingSpot] === "TRUE",
                        sheet[i][columnPreposition] ? sheet[i][columnPreposition] : "",
                        i + 1
                    )
                );
            }
            resolve(game);
        });
    });
};

module.exports.loadClues = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.clueSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnLocation = 1;
            const columnAccessibility = 2;
            const columnRequires = 3;

            game.clues.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                game.clues.push(
                    new Clue(
                        sheet[i][columnName],
                        sheet[i][columnLocation],
                        sheet[i][columnAccessibility] === "TRUE",
                        sheet[i][columnRequires] ? sheet[i][columnRequires] : "",
                        i + 1
                    )
                );
            }
            resolve(game);
        });
    });
};

module.exports.loadItems = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.itemSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnPluralName = 1;
            const columnLocation = 2;
            const columnSublocation = 3;
            const columnAccessibility = 4;
            const columnRequires = 5;
            const columnQuantity = 6;
            const columnUses = 7;
            const columnDiscreet = 8;
            const columnEffect = 9;
            const columnCures = 10;
            const columnContainingPhrase = 11;

            game.items.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                const containingPhrase = sheet[i][columnContainingPhrase].split(',');
                var effects = sheet[i][columnEffect] ? sheet[i][columnEffect].split(',') : "";
                for (let j = 0; j < effects.length; j++)
                    effects[j] = effects[j].trim();
                var cures = sheet[i][columnCures] ? sheet[i][columnCures].split(',') : "";
                for (let j = 0; j < cures.length; j++)
                    cures[j] = cures[j].trim();
                game.items.push(
                    new Item(
                        sheet[i][columnName],
                        sheet[i][columnPluralName] ? sheet[i][columnPluralName] : "",
                        sheet[i][columnLocation],
                        sheet[i][columnSublocation],
                        sheet[i][columnAccessibility] === "TRUE",
                        sheet[i][columnRequires],
                        parseInt(sheet[i][columnQuantity]),
                        parseInt(sheet[i][columnUses]),
                        sheet[i][columnDiscreet] === "TRUE",
                        effects,
                        cures,
                        containingPhrase[0].trim(),
                        containingPhrase[1] ? containingPhrase[1].trim() : "",
                        i + 1
                    )
                );
            }
            resolve(game);
        });
    });
};

module.exports.loadPuzzles = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.puzzleSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnSolved = 1;
            const columnRequiresMod = 2;
            const columnLocation = 3;
            const columnParentObject = 4;
            const columnType = 5;
            const columnAccessible = 6;
            const columnRequires = 7;
            const columnSolution = 8;
            const columnAttempts = 9;
            const columnWhenSolved = 10;

            game.puzzles.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                const commands = sheet[i][columnWhenSolved] ? sheet[i][columnWhenSolved].split('/') : new Array("", "");
                var solvedCommands = commands[0] ? commands[0].split(',') : "";
                for (let j = 0; j < solvedCommands.length; j++)
                    solvedCommands[j] = solvedCommands[j].trim();
                var unsolvedCommands = commands[1] ? commands[1].split(',') : "";
                for (let j = 0; j < unsolvedCommands.length; j++)
                    unsolvedCommands[j] = unsolvedCommands[j].trim();
                game.puzzles.push(
                    new Puzzle(
                        sheet[i][columnName],
                        sheet[i][columnSolved] === "TRUE",
                        sheet[i][columnRequiresMod] === "TRUE",
                        sheet[i][columnLocation],
                        sheet[i][columnParentObject],
                        sheet[i][columnType],
                        sheet[i][columnAccessible] === "TRUE",
                        sheet[i][columnRequires] ? sheet[i][columnRequires] : "",
                        sheet[i][columnSolution] ? sheet[i][columnSolution] : "",
                        parseInt(sheet[i][columnAttempts]),
                        solvedCommands,
                        unsolvedCommands,
                        i + 1
                    )
                );
            }
            resolve(game);
        });
    });
};

module.exports.loadStatusEffects = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.statusSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnDuration = 1;
            const columnFatal = 2;
            const columnCures = 3;
            const columnNextStage = 4;
            const columnCuredCondition = 5;
            const columnRollModifier = 6;
            const columnAttributes = 7;

            game.statusEffects.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                var cures = sheet[i][columnCures] ? sheet[i][columnCures].split(',') : "";
                for (let j = 0; j < cures.length; j++)
                    cures[j] = cures[j].trim();
                var modifiesSelf = null;
                if (sheet[i][columnRollModifier].charAt(0) === 's') modifiesSelf = true;
                else if (sheet[i][columnRollModifier].charAt(0) === 'o') modifiesSelf = false;
                game.statusEffects.push(
                    new Status(
                        sheet[i][columnName],
                        sheet[i][columnDuration].toLowerCase(),
                        sheet[i][columnFatal] === "TRUE",
                        cures,
                        sheet[i][columnNextStage],
                        sheet[i][columnCuredCondition],
                        parseInt(sheet[i][columnRollModifier].substring(1)),
                        modifiesSelf,
                        sheet[i][columnAttributes] ? sheet[i][columnAttributes] : "",
                        i + 1
                    )
                );
            }
            // Now go through and make the nextStage and curedCondition an actual Status object.
            for (let i = 0; i < game.statusEffects.length; i++) {
                if (game.statusEffects[i].nextStage)
                    game.statusEffects[i].nextStage = game.statusEffects.find(statusEffect => statusEffect.name === game.statusEffects[i].nextStage);
                if (game.statusEffects[i].curedCondition)
                    game.statusEffects[i].curedCondition = game.statusEffects.find(statusEffect => statusEffect.name === game.statusEffects[i].curedCondition);
            }
            resolve(game);
        });
    });
};

module.exports.loadPlayers = function (game) {
    return new Promise((resolve) => {
        // Clear all player status effects first.
        for (let i = 0; i < game.players.length; i++) {
            for (let j = 0; j < game.players[i].status.length; j++) {
                clearInterval(game.players[i].status[j].timer);
            }
        }

        sheets.getData(settings.playerSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnID = 0;
            const columnName = 1;
            const columnTalent = 2;
            const columnClueLevel = 3;
            const columnAlive = 4;
            const columnLocation = 5;
            const columnHidingSpot = 6;
            const columnStatus = 7;
            const columnItemName = 8;
            const columnItemPluralName = 9;
            const columnItemUses = 10;
            const columnItemDiscreet = 11;
            const columnItemEffect = 12;
            const columnItemCures = 13;
            const columnItemContainingPhrase = 14;

            game.players.length = 0;
            game.players_alive.length = 0;
            game.players_dead.length = 0;

            for (let i = 2, j = 0; i < sheet.length; i = i + j) {
                var inventory = new Array(3);
                for (j = 0; j < inventory.length; j++) {
                    if (sheet[i + j][columnItemName] !== "NULL") {
                        const containingPhrase = sheet[i + j][columnItemContainingPhrase].split(',');
                        var effects = sheet[i + j][columnItemEffect] ? sheet[i + j][columnItemEffect].split(',') : "";
                        for (let k = 0; k < effects.length; k++)
                            effects[k] = effects[k].trim();
                        var cures = sheet[i + j][columnItemCures] ? sheet[i + j][columnItemCures].split(',') : "";
                        for (let k = 0; k < cures.length; k++)
                            cures[k] = cures[k].trim();
                        inventory[j] =
                            new InventoryItem(
                                sheet[i + j][columnItemName],
                                sheet[i + j][columnItemPluralName] ? sheet[i + j][columnItemPluralName] : "",
                                parseInt(sheet[i + j][columnItemUses]),
                                sheet[i + j][columnItemDiscreet] === "TRUE",
                                effects,
                                cures,
                                containingPhrase[0].trim(),
                                containingPhrase[1] ? containingPhrase[1].trim() : "",
                                i + j + 1
                            );
                    }
                    else
                        inventory[j] =
                            new InventoryItem(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                i + j + 1
                            );
                }
                const player =
                    new Player(
                        sheet[i][columnID],
                        game.guild.members.find(member => member.id === sheet[i][columnID]),
                        sheet[i][columnName],
                        sheet[i][columnName],
                        sheet[i][columnTalent],
                        parseInt(sheet[i][columnClueLevel]),
                        sheet[i][columnAlive] === "TRUE",
                        game.rooms.find(room => room.name === sheet[i][columnLocation]),
                        sheet[i][columnHidingSpot],
                        new Array(),
                        inventory,
                        i + 1
                    );
                game.players.push(player);

                if (player.alive) {
                    game.players_alive.push(player);

                    // Parse statuses and inflict the player with them.
                    const currentPlayer = game.players_alive[game.players_alive.length - 1];
                    const statuses = sheet[i][columnStatus].split(',');
                    for (let k = 0; k < game.statusEffects.length; k++) {
                        for (let l = 0; l < statuses.length; l++) {
                            if (game.statusEffects[k].name === statuses[l].trim()) {
                                currentPlayer.inflict(game, game.statusEffects[k].name, false, false, false, false);
                                break;
                            }
                        }
                    }
                    sheets.updateCell(currentPlayer.statusCell(), currentPlayer.statusString);

                    for (let k = 0; k < game.rooms.length; k++) {
                        if (game.rooms[k].name === currentPlayer.location.name) {
                            game.rooms[k].addPlayer(game, currentPlayer, null, null, false);
                            break;
                        }
                    }
                }
                else
                    game.players_dead.push(player);
            }
            resolve(game);
        });
    });
};

module.exports.loadInventories = function (game) {
    return new Promise((resolve) => {
        sheets.getData(settings.playerSheetLoadCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnID = 0;
            const columnItemName = 8;
            const columnItemPluralName = 9;
            const columnItemUses = 10;
            const columnItemDiscreet = 11;
            const columnItemEffect = 12;
            const columnItemCures = 13;
            const columnItemContainingPhrase = 14;

            for (let i = 0; i < game.players_alive.length; i++) {
                game.players_alive[i].inventory.length = 0;
                var inventory = new Array(3);
                for (let j = 2, k = 0; j < sheet.length; j = j + k) {
                    if (sheet[j][columnID] === game.players_alive[i].id) {
                        for (k = 0; k < inventory.length; k++) {
                            if (sheet[j + k][columnItemName] !== "NULL") {
                                const containingPhrase = sheet[j + k][columnItemContainingPhrase].split(',');
                                var effects = sheet[j + k][columnItemEffect] ? sheet[j + k][columnItemEffect].split(',') : "";
                                for (let l = 0; l < effects.length; l++)
                                    effects[l] = effects[l].trim();
                                var cures = sheet[j + k][columnItemCures] ? sheet[j + k][columnItemCures].split(',') : "";
                                for (let l = 0; l < cures.length; l++)
                                    cures[l] = cures[l].trim();
                                inventory[k] =
                                    new InventoryItem(
                                        sheet[j + k][columnItemName],
                                        sheet[j + k][columnItemPluralName] ? sheet[j + k][columnItemPluralName] : "",
                                        parseInt(sheet[j + k][columnItemUses]),
                                        sheet[j + k][columnItemDiscreet] === "TRUE",
                                        effects,
                                        cures,
                                        containingPhrase[0].trim(),
                                        containingPhrase[1] ? containingPhrase[1].trim() : "",
                                        j + k + 1
                                    );
                            }
                            else {
                                inventory[k] =
                                    new InventoryItem(
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        j + k + 1
                                    );
                            }
                        }
                        game.players_alive[i].inventory = inventory;
                    }
                    else k = inventory.length;
                }
            }
            resolve(game);
        });
    });
};
