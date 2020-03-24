﻿const settings = include('settings.json');
const sheets = include(`${settings.modulesDir}/sheets.js`);

const Exit = include(`${settings.dataDir}/Exit.js`);
const Room = include(`${settings.dataDir}/Room.js`);
const Object = include(`${settings.dataDir}/Object.js`);
const Prefab = include(`${settings.dataDir}/Prefab.js`);
const Recipe = include(`${settings.dataDir}/Recipe.js`);
const Item = include(`${settings.dataDir}/Item.js`);
const Puzzle = include(`${settings.dataDir}/Puzzle.js`);
const Event = include(`${settings.dataDir}/Event.js`);
const EquipmentSlot = include(`${settings.dataDir}/EquipmentSlot.js`);
const InventoryItem = include(`${settings.dataDir}/InventoryItem.js`);
const Status = include(`${settings.dataDir}/Status.js`);
const Player = include(`${settings.dataDir}/Player.js`);
const QueueEntry = include(`${settings.dataDir}/QueueEntry.js`);

var moment = require('moment');
moment().format();

module.exports.loadRooms = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.roomSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnRoomName = 0;
            const columnTags = 1;
            const columnNumberExits = 2;
            const columnExits = 3;
            const columnPosX = 4;
            const columnPosY = 5;
            const columnPosZ = 6;
            const columnUnlocked = 7;
            const columnLeadsTo = 8;
            const columnFrom = 9;
            const columnDescription = 10;

            game.rooms.length = 0;
            for (let i = 1, j = 0; i < sheet.length; i = i + j) {
                var exits = [];
                for (j = 0; j < parseInt(sheet[i][columnNumberExits]); j++) {
                    const pos = {
                        x: parseInt(sheet[i + j][columnPosX]),
                        y: parseInt(sheet[i + j][columnPosY]),
                        z: parseInt(sheet[i + j][columnPosZ])
                    };
                    exits.push(
                        new Exit(
                            sheet[i + j][columnExits],
                            pos,
                            sheet[i + j][columnUnlocked] === "TRUE",
                            sheet[i + j][columnLeadsTo],
                            sheet[i + j][columnFrom],
                            sheet[i + j][columnDescription] ? sheet[i + j][columnDescription] : "",
                            i + j + 1
                        ));
                }
                const channel = game.guild.channels.find(channel => channel.name === sheet[i][columnRoomName]);
                var tags = sheet[i][columnTags] ? sheet[i][columnTags].split(',') : [];
                for (let j = 0; j < tags.length; j++)
                    tags[j] = tags[j].trim();
                game.rooms.push(
                    new Room(
                        sheet[i][columnRoomName],
                        channel,
                        tags,
                        exits,
                        sheet[i][columnDescription] ? sheet[i][columnDescription] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            // Now go through and make the dest for each exit an actual Room object.
            // Also, add any occupants to the room.
            for (let i = 0; i < game.rooms.length; i++) {
                for (let j = 0; j < game.rooms[i].exit.length; j++) {
                    let dest = game.rooms.find(room => room.name === game.rooms[i].exit[j].dest && room.name !== "");
                    if (dest) game.rooms[i].exit[j].dest = dest;
                }
                if (doErrorChecking) {
                    let error = exports.checkRoom(game.rooms[i]);
                    if (error instanceof Error) errors.push(error);
                }
                for (let j = 0; j < game.players_alive.length; j++) {
                    if (game.players_alive[j].location.name === game.rooms[i].name) {
                        game.rooms[i].addPlayer(game, game.players_alive[j], null, null, false);
                    }
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkRoom = function (room) {
    if (room.name === "" || room.name === null || room.name === undefined)
        return new Error(`Couldn't load room on row ${room.row}. No room name was given.`);
    if (room.channel === null || room.channel === undefined)
        return new Error(`Couldn't load room "${room.name}". There is no corresponding channel on the server.`);
    for (let i = 0; i < room.exit.length; i++) {
        let exit = room.exit[i];
        if (exit.name === "" || exit.name === null || exit.name === undefined)
            return new Error(`Couldn't load exit on row ${exit.row}. No exit name was given.`);
        if (isNaN(exit.pos.x))
            return new Error(`Couldn't load exit on row ${exit.row}. The X-coordinate given is not an integer.`);
        if (isNaN(exit.pos.y))
            return new Error(`Couldn't load exit on row ${exit.row}. The Y-coordinate given is not an integer.`);
        if (isNaN(exit.pos.z))
            return new Error(`Couldn't load exit on row ${exit.row}. The Z-coordinate given is not an integer.`);
        if (exit.link === "" || exit.link === null || exit.link === undefined)
            return new Error(`Couldn't load exit on row ${exit.row}. No linked exit was given.`);
        if (exit.dest === "" || exit.dest === null || exit.dest === undefined)
            return new Error(`Couldn't load exit on row ${exit.row}. No destination was given.`);
        if (!(exit.dest instanceof Room))
            return new Error(`Couldn't load exit on row ${exit.row}. The destination given is not a room.`);
        let matchingExit = false;
        for (let j = 0; j < exit.dest.exit.length; j++) {
            let dest = exit.dest;
            if (dest.exit[j].link === exit.name) {
                matchingExit = true;
                break;
            }
        }
        if (!matchingExit)
            return new Error(`Couldn't load exit on row ${exit.row}. Room "${exit.dest.name}"  does not have an exit that links back to it.`);
    }
    return;
};

module.exports.loadObjects = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        // Clear all recipe intervals so they don't continue after these objects are unloaded.
        for (let i = 0; i < game.objects.length; i++) {
            clearInterval(game.objects[i].recipeInterval);
            clearInterval(game.objects[i].process.timer);
        }

        sheets.getData(settings.objectSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnLocation = 1;
            const columnAccessibility = 2;
            const columnChildPuzzle = 3;
            const columnRecipeTag = 4;
            const columnActivatable = 5;
            const columnActivated = 6;
            const columnAutoDeactivate = 7;
            const columnHidingSpot = 8;
            const columnPreposition = 9;
            const columnDescription = 10;

            game.objects.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                game.objects.push(
                    new Object(
                        sheet[i][columnName],
                        sheet[i][columnLocation],
                        sheet[i][columnAccessibility] === "TRUE",
                        sheet[i][columnChildPuzzle] ? sheet[i][columnChildPuzzle] : "",
                        sheet[i][columnRecipeTag] ? sheet[i][columnRecipeTag] : "",
                        sheet[i][columnActivatable] === "TRUE",
                        sheet[i][columnActivated] === "TRUE",
                        sheet[i][columnAutoDeactivate] === "TRUE",
                        sheet[i][columnHidingSpot] === "TRUE",
                        sheet[i][columnPreposition] ? sheet[i][columnPreposition] : "",
                        sheet[i][columnDescription] ? sheet[i][columnDescription] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            for (let i = 0; i < game.objects.length; i++) {
                game.objects[i].location = game.rooms.find(room => room.name === game.objects[i].location && room.name !== "");
                let childPuzzle = game.puzzles.find(puzzle => puzzle.name === game.objects[i].childPuzzleName && puzzle.location.name === game.objects[i].location.name);
                if (childPuzzle) game.objects[i].childPuzzle = childPuzzle;
                if (doErrorChecking) {
                    let error = exports.checkObject(game.objects[i]);
                    if (error instanceof Error) errors.push(error);
                }
            }
            for (let i = 0; i < game.items.length; i++) {
                if (game.items[i].containerName.startsWith("Object:"))
                    game.items[i].container = game.objects.find(object => object.name === game.items[i].containerName.substring("Object:".length).trim() && game.items[i].location instanceof Room && object.location.name === game.items[i].location.name);
            }
            for (let i = 0; i < game.puzzles.length; i++) {
                if (game.puzzles[i].parentObjectName !== "")
                    game.puzzles[i].parentObject = game.objects.find(object => object.name === game.puzzles[i].parentObjectName && object.location.name === game.puzzles[i].location.name);
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkObject = function (object) {
    if (object.name === "" || object.name === null || object.name === undefined)
        return new Error(`Couldn't load object on row ${object.row}. No object name was given.`);
    if (!(object.location instanceof Room))
        return new Error(`Couldn't load object on row ${object.row}. The location given is not a room.`);
    if (object.childPuzzleName !== "" && !(object.childPuzzle instanceof Puzzle))
        return new Error(`Couldn't load object on row ${object.row}. The child puzzle given is not a puzzle.`);
    if (object.childPuzzle !== null && object.childPuzzle.parentObject === null)
        return new Error(`Couldn't load object on row ${object.row}. The child puzzle on row ${object.childPuzzle.row} has no parent object.`);
    if (object.childPuzzle !== null && object.childPuzzle.parentObject !== null && object.childPuzzle.parentObject.name !== object.name)
        return new Error(`Couldn't load object on row ${object.row}. The child puzzle has a different parent object.`);
    return;
};

module.exports.loadPrefabs = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.prefabSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnID = 0;
            const columnName = 1;
            const columnContainingPhrase = 2;
            const columnDiscreet = 3;
            const columnSize = 4;
            const columnWeight = 5;
            const columnUsable = 6;
            const columnUseVerb = 7;
            const columnUses = 8;
            const columnEffect = 9;
            const columnCures = 10;
            const columnNextStage = 11;
            const columnEquippable = 12;
            const columnSlots = 13;
            const columnCoveredSlots = 14;
            const columnEquipCommands = 15;
            const columnInventorySlots = 16;
            const columnPreposition = 17;
            const columnDescription = 18;

            game.prefabs.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                // Separate name and plural name.
                const name = sheet[i][columnName] ? sheet[i][columnName].split(',') : "";
                // Separate single containing phrase and plural containing phrase.
                const containingPhrase = sheet[i][columnContainingPhrase] ? sheet[i][columnContainingPhrase].split(',') : "";
                // Create a list of all status effect names this prefab will inflict when used.
                var effects = sheet[i][columnEffect] ? sheet[i][columnEffect].split(',') : [];
                for (let j = 0; j < effects.length; j++)
                    effects[j] = effects[j].trim();
                // Create a list of all status effect names this prefab will cure when used.
                var cures = sheet[i][columnCures] ? sheet[i][columnCures].split(',') : [];
                for (let j = 0; j < cures.length; j++)
                    cures[j] = cures[j].trim();
                // Create a list of equipment slots this prefab can be equipped to.
                var equipmentSlots = sheet[i][columnSlots] ? sheet[i][columnSlots].split(',') : [];
                for (let j = 0; j < equipmentSlots.length; j++)
                    equipmentSlots[j] = equipmentSlots[j].trim();
                // Create a list of equipment slots this prefab covers when equipped.
                var coveredEquipmentSlots = sheet[i][columnCoveredSlots] ? sheet[i][columnCoveredSlots].split(',') : [];
                for (let j = 0; j < coveredEquipmentSlots.length; j++)
                    coveredEquipmentSlots[j] = coveredEquipmentSlots[j].trim();
                // Create a list of commands to run when this prefab is equipped/unequipped.
                const commands = sheet[i][columnEquipCommands] ? sheet[i][columnEquipCommands].split('/') : new Array("", "");
                var equipCommands = commands[0] ? commands[0].split(',') : "";
                for (let j = 0; j < equipCommands.length; j++)
                    equipCommands[j] = equipCommands[j].trim();
                var unequipCommands = commands[1] ? commands[1].split(',') : "";
                for (let j = 0; j < unequipCommands.length; j++)
                    unequipCommands[j] = unequipCommands[j].trim();
                // Create a list of inventory slots this prefab contains.
                var inventorySlots = sheet[i][columnInventorySlots] ? sheet[i][columnInventorySlots].split(',') : [];
                for (let j = 0; j < inventorySlots.length; j++) {
                    const inventorySlot = inventorySlots[j].split(':');
                    inventorySlots[j] = { name: inventorySlot[0].trim(), capacity: parseInt(inventorySlot[1]), takenSpace: 0, weight: 0, item: [] };
                }

                game.prefabs.push(
                    new Prefab(
                        sheet[i][columnID],
                        name[0] ? name[0].trim() : "",
                        name[1] ? name[1].trim() : "",
                        containingPhrase[0] ? containingPhrase[0].trim() : "",
                        containingPhrase[1] ? containingPhrase[1].trim() : "",
                        sheet[i][columnDiscreet] === "TRUE",
                        parseInt(sheet[i][columnSize]),
                        parseInt(sheet[i][columnWeight]),
                        sheet[i][columnUsable] === "TRUE",
                        sheet[i][columnUseVerb] ? sheet[i][columnUseVerb] : "",
                        parseInt(sheet[i][columnUses]),
                        effects,
                        cures,
                        sheet[i][columnNextStage] ? sheet[i][columnNextStage].trim() : "",
                        sheet[i][columnEquippable] === "TRUE",
                        equipmentSlots,
                        coveredEquipmentSlots,
                        equipCommands,
                        unequipCommands,
                        inventorySlots,
                        sheet[i][columnPreposition] ? sheet[i][columnPreposition] : "",
                        sheet[i][columnDescription] ? sheet[i][columnDescription] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            for (let i = 0; i < game.prefabs.length; i++) {
                for (let j = 0; j < game.prefabs[i].effects.length; j++) {
                    let status = game.statusEffects.find(statusEffect => statusEffect.name === game.prefabs[i].effects[j]);
                    if (status) game.prefabs[i].effects[j] = status;
                }
                for (let j = 0; j < game.prefabs[i].cures.length; j++) {
                    let status = game.statusEffects.find(statusEffect => statusEffect.name === game.prefabs[i].cures[j]);
                    if (status) game.prefabs[i].cures[j] = status;
                }
                let nextStage = game.prefabs.find(prefab => prefab.id === game.prefabs[i].nextStageName);
                if (nextStage) game.prefabs[i].nextStage = nextStage;
                if (doErrorChecking) {
                    let error = exports.checkPrefab(game.prefabs[i], game);
                    if (error instanceof Error) errors.push(error);
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkPrefab = function (prefab, game) {
    if (game.prefabs.filter(other => other.id === prefab.id && other.row < prefab.row).length > 0)
        return new Error(`Couldn't load prefab on row ${prefab.row}. Another prefab with this ID already exists.`);
    if (prefab.name === "" || prefab.name === null || prefab.name === undefined)
        return new Error(`Couldn't load prefab on row ${prefab.row}. No prefab name was given.`);
    if (prefab.singleContainingPhrase === "")
        return new Error(`Couldn't load prefab on row ${prefab.row}. No single containing phrase was given.`);
    if (isNaN(prefab.size))
        return new Error(`Couldn't load prefab on row ${prefab.row}. The size given is not a number.`);
    if (isNaN(prefab.weight))
        return new Error(`Couldn't load prefab on row ${prefab.row}. The weight given is not a number.`);
    for (let i = 0; i < prefab.effects.length; i++) {
        if (!(prefab.effects[i] instanceof Status))
            return new Error(`Couldn't load prefab on row ${prefab.row}. "${prefab.effects[i]}" in effects is not a status effect.`);
    }
    for (let i = 0; i < prefab.cures.length; i++) {
        if (!(prefab.cures[i] instanceof Status))
            return new Error(`Couldn't load prefab on row ${prefab.row}. "${prefab.cures[i]}" in cures is not a status effect.`);
    }
    if (prefab.nextStageName !== "" && !(prefab.nextStage instanceof Prefab))
        return new Error(`Couldn't load prefab on row ${prefab.row}. "${prefab.nextStageName}" in turns into is not a prefab.`);
    for (let i = 0; i < prefab.inventory.length; i++) {
        if (prefab.inventory[i].name === "" || prefab.inventory[i].name === null || prefab.inventory[i].name === undefined)
            return new Error(`Couldn't load prefab on row ${prefab.row}. No name was given for inventory slot ${i + 1}.`);
        if (isNaN(prefab.inventory[i].capacity))
            return new Error(`Couldn't load prefab on row ${prefab.row}. The capacity given for inventory slot "${prefab.inventory[i].name}" is not a number.`);
    }
    if (prefab.inventory.length !== 0 && prefab.preposition === "")
        return new Error(`Couldn't load prefab on row ${prefab.row}. ${prefab.id} has inventory slots, but no preposition was given.`);
    return;
};

module.exports.loadRecipes = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.recipeSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnIngredients = 0;
            const columnObjectTag = 1;
            const columnDuration = 2;
            const columnProducts = 3;
            const columnInitiatedDescription = 4;
            const columnCompletedDescription = 5;

            game.recipes.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                // Separate the ingredients and sort them in alphabetical order.
                var ingredients = sheet[i][columnIngredients] ? sheet[i][columnIngredients].split(',') : [];
                ingredients.sort(function (a, b) {
                    let trimmedA = a.trim();
                    let trimmedB = b.trim();
                    if (trimmedA < trimmedB) return -1;
                    if (trimmedA > trimmedB) return 1;
                    return 0;
                });
                // For each ingredient, find its Prefab.
                for (let j = 0; j < ingredients.length; j++) {
                    ingredients[j] = ingredients[j].trim();
                    let prefab = game.prefabs.find(prefab => prefab.id === ingredients[j] && prefab.id !== "");
                    if (prefab) ingredients[j] = prefab;
                }
                // Separate the products.
                var products = sheet[i][columnProducts] ? sheet[i][columnProducts].split(',') : [];
                // For each product, find its Prefab.
                for (let j = 0; j < products.length; j++) {
                    products[j] = products[j].trim();
                    let prefab = game.prefabs.find(prefab => prefab.id === products[j] && prefab.id !== "");
                    if (prefab) products[j] = prefab;
                }

                game.recipes.push(
                    new Recipe(
                        ingredients,
                        sheet[i][columnObjectTag] ? sheet[i][columnObjectTag] : "",
                        sheet[i][columnDuration] ? sheet[i][columnDuration].toLowerCase() : "0s",
                        products,
                        sheet[i][columnInitiatedDescription] ? sheet[i][columnInitiatedDescription] : "",
                        sheet[i][columnCompletedDescription] ? sheet[i][columnCompletedDescription] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            for (let i = 0; i < game.recipes.length; i++) {
                if (doErrorChecking) {
                    let error = exports.checkRecipe(game.recipes[i]);
                    if (error instanceof Error) errors.push(error);
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkRecipe = function (recipe) {
    if (recipe.ingredients.length === 0)
        return new Error(`Couldn't load recipe on row ${recipe.row}. No ingredients were given.`);
    for (let i = 0; i < recipe.ingredients.length; i++) {
        if (!(recipe.ingredients[i] instanceof Prefab))
            return new Error(`Couldn't load recipe on row ${recipe.row}. "${recipe.ingredients[i]}" in ingredients is not a prefab.`);
    }
    if (recipe.ingredients.length > 2 && recipe.objectTag === "")
        return new Error(`Couldn't load recipe on row ${recipe.row}. Recipes with more than 2 ingredients must require an object tag.`);
    if (recipe.products.length > 2 && recipe.objectTag === "")
        return new Error(`Couldn't load recipe on row ${recipe.row}. Recipes with more than 2 products must require an object tag.`);
    const timeInt = recipe.duration.substring(0, recipe.duration.length - 1);
    if (recipe.duration !== "" && (isNaN(timeInt) || !recipe.duration.endsWith('s') && !recipe.duration.endsWith('m') && !recipe.duration.endsWith('h')))
        return new Error(`Couldn't load recipe on row ${recipe.row}. Duration format is incorrect. Must be a number followed by 's', 'm', or 'h'.`);
    if (recipe.objectTag === "" && recipe.duration !== "0s")
        return new Error(`Couldn't load recipe on row ${recipe.row}. Recipes without an object tag cannot have a duration.`);
    for (let i = 0; i < recipe.products.length; i++) {
        if (!(recipe.products[i] instanceof Prefab))
            return new Error(`Couldn't load recipe on row ${recipe.row}. "${recipe.products[i]}" in products is not a prefab.`);
    }
};

module.exports.loadItems = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.itemSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnPrefab = 0;
            const columnIdentifier = 1;
            const columnLocation = 2;
            const columnAccessibility = 3;
            const columnContainer = 4;
            const columnQuantity = 5;
            const columnUses = 6;
            const columnDescription = 7;

            game.items.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                // Find the prefab first.
                const prefab = game.prefabs.find(prefab => prefab.id === sheet[i][columnPrefab] && prefab.id !== "");

                game.items.push(
                    new Item(
                        prefab ? prefab : sheet[i][columnPrefab],
                        sheet[i][columnIdentifier] ? sheet[i][columnIdentifier] : "",
                        sheet[i][columnLocation],
                        sheet[i][columnAccessibility] === "TRUE",
                        sheet[i][columnContainer] ? sheet[i][columnContainer] : "",
                        parseInt(sheet[i][columnQuantity]),
                        parseInt(sheet[i][columnUses]),
                        sheet[i][columnDescription] ? sheet[i][columnDescription] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            var childItemIndexes = [];
            for (let i = 0; i < game.items.length; i++) {
                game.items[i].location = game.rooms.find(room => room.name === game.items[i].location && room.name !== "");
                if (game.items[i].prefab instanceof Prefab) {
                    const prefab = game.items[i].prefab;
                    game.items[i].weight = game.items[i].prefab.weight;
                    for (let j = 0; j < prefab.inventory.length; j++)
                        game.items[i].inventory.push({ name: prefab.inventory[j].name, capacity: prefab.inventory[j].capacity, takenSpace: prefab.inventory[j].takenSpace, weight: prefab.inventory[j].weight, item: [] });
                }
                if (game.items[i].containerName.startsWith("Object:")) {
                    let container = game.objects.find(object => object.name === game.items[i].containerName.substring("Object:".length).trim() && game.items[i].location instanceof Room && object.location.name === game.items[i].location.name);
                    if (container) game.items[i].container = container;
                }
                else if (game.items[i].containerName.startsWith("Item:")) {
                    childItemIndexes.push(i);
                }
                else if (game.items[i].containerName.startsWith("Puzzle:")) {
                    let container = game.puzzles.find(puzzle => puzzle.name === game.items[i].containerName.substring("Puzzle:".length).trim() && puzzle.location.name === game.items[i].location.name);
                    if (container) game.items[i].container = container;
                }
            }
            // Only assign child item containers once all items have been properly initialized.
            for (let index = 0; index < childItemIndexes.length; index++) {
                const i = childItemIndexes[index];
                const containerName = game.items[i].containerName.substring("Item:".length).trim().split("/");
                const identifier = containerName[0] ? containerName[0].trim() : "";
                const slotName = containerName[1] ? containerName[1].trim() : "";
                let possibleContainers = game.items.filter(item => item.identifier === identifier && item.location.name === game.items[i].location.name);
                let container = null;
                for (let i = 0; i < possibleContainers.length; i++) {
                    if (possibleContainers[i].quantity > 0) {
                        container = possibleContainers[i];
                        break;
                    }
                }
                if (container === null && possibleContainers.length > 0) container = possibleContainers[0];
                if (container) {
                    game.items[i].container = container;
                    game.items[i].slot = slotName;
                    // This is a pseudo-copy of the insertItems function without weight and takenSpace changing.
                    if (game.items[i].quantity !== 0) {
                        for (let j = 0; j < container.inventory.length; j++) {
                            if (container.inventory[j].name === slotName)
                                container.inventory[j].item.push(game.items[i]);
                        }
                    }
                }
            }
            // Create a recursive function for properly inserting item inventories.
            let insertInventory = function (item) {
                var createdItem = new Item(
                    item.prefab,
                    item.identifier,
                    item.location,
                    item.accessible,
                    item.containerName,
                    item.quantity,
                    item.uses,
                    item.description,
                    item.row
                );
                if (item.container instanceof Item) createdItem.container = game.items.find(gameItem => gameItem.row === item.container.row);
                else createdItem.container = item.container;
                createdItem.slot = item.slot;
                createdItem.weight = item.weight;

                // Initialize the item's inventory slots.
                if (item.prefab instanceof Prefab) {
                    for (let i = 0; i < item.prefab.inventory.length; i++)
                        createdItem.inventory.push({
                            name: item.prefab.inventory[i].name,
                            capacity: item.prefab.inventory[i].capacity,
                            takenSpace: item.prefab.inventory[i].takenSpace,
                            weight: item.prefab.inventory[i].weight,
                            item: []
                        });
                }

                for (let i = 0; i < item.inventory.length; i++) {
                    for (let j = 0; j < item.inventory[i].item.length; j++) {
                        let inventoryItem = insertInventory(item.inventory[i].item[j]);
                        let foundItem = false;
                        for (var k = 0; k < game.items.length; k++) {
                            if (game.items[k].row === inventoryItem.row) {
                                foundItem = true;
                                game.items[k] = inventoryItem;
                                break;
                            }
                        }
                        if (foundItem) {
                            game.items[k].container = createdItem;
                            if (game.items[k].containerName !== "")
                                createdItem.insertItem(game.items[k], game.items[k].slot);
                            else createdItem.inventory[i].item.push(game.items[k]);
                        }
                    }
                }
                return createdItem;
            };
            // Run through items one more time to properly insert their inventories.
            for (let i = 0; i < game.items.length; i++) {
                if (game.items[i].container instanceof Item) {
                    let container = game.items[i].container;
                    for (let slot = 0; slot < container.inventory.length; slot++) {
                        for (let j = 0; j < container.inventory[slot].item.length; j++) {
                            if (container.inventory[slot].item[j].row === game.items[i].row) {
                                game.items[i] = container.inventory[slot].item[j];
                                break;
                            }
                        }
                    }
                }
                else game.items[i] = insertInventory(game.items[i]);

                if (doErrorChecking) {
                    let error = exports.checkItem(game.items[i], game);
                    if (error instanceof Error) errors.push(error);
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    }); 
};

module.exports.checkItem = function (item, game) {
    if (!(item.prefab instanceof Prefab))
        return new Error(`Couldn't load item on row ${item.row}. The prefab given is not a prefab.`);
    if (item.inventory.length > 0 && item.identifier === "")
        return new Error(`Couldn't load item on row ${item.row}. This item is capable of containing items, but no container identifier was given.`);
    if (item.inventory.length > 0 && (item.quantity > 1 || isNaN(item.quantity)))
        return new Error(`Couldn't load item on row ${item.row}. Items capable of containing items must have a quantity of 1.`);
    if (item.identifier !== "" && item.quantity !== 0 &&
        game.items.filter(other => other.identifier === item.identifier && other.row < item.row && other.quantity !== 0).length
        + game.inventoryItems.filter(other => other.identifier === item.identifier && other.quantity !== 0).length > 0)
        return new Error(`Couldn't load item on row ${item.row}. Another item or inventory item with this container identifier already exists.`);
    if (item.prefab.pluralContainingPhrase === "" && (item.quantity > 1 || isNaN(item.quantity)))
        return new Error(`Couldn't load item on row ${item.row}. Quantity is higher than 1, but its prefab on row ${item.prefab.row} has no plural containing phrase.`);
    if (!(item.location instanceof Room))
        return new Error(`Couldn't load item on row ${item.row}. The location given is not a room.`);
    if (item.containerName.startsWith("Object:") && !(item.container instanceof Object))
        return new Error(`Couldn't load item on row ${item.row}. The container given is not an object.`);
    if (item.containerName.startsWith("Item:") && !(item.container instanceof Item))
        return new Error(`Couldn't load item on row ${item.row}. The container given is not an item.`);
    if (item.containerName.startsWith("Puzzle:") && !(item.container instanceof Puzzle))
        return new Error(`Couldn't load item on row ${item.row}. The container given is not a puzzle.`);
    if (item.containerName !== "" && !item.containerName.startsWith("Object:") && !item.containerName.startsWith("Item:") && !item.containerName.startsWith("Puzzle:"))
        return new Error(`Couldn't load item on row ${item.row}. The given container type is invalid.`);
    if (item.container instanceof Item && item.container.inventory.length === 0)
        return new Error(`Couldn't load item on row ${item.row}. The item's container is an inventory item, but the item container's prefab on row ${item.container.prefab.row} has no inventory slots.`);
    if (item.container instanceof Item) {
        if (item.slot === "") return new Error(`Couldn't load item on row ${item.row}. The item's container is an item, but a prefab inventory slot name was not given.`);
        let foundSlot = false;
        for (let i = 0; i < item.container.inventory.length; i++) {
            if (item.container.inventory[i].name === item.slot) {
                foundSlot = true;
                if (item.container.inventory[i].takenSpace > item.container.inventory[i].capacity)
                    return new Error(`Couldn't load item on row ${item.row}. The item's container is over capacity.`);
            }
        }
        if (!foundSlot) return new Error(`Couldn't load item on row ${item.row}. The item's container prefab on row ${item.container.prefab.row} has no inventory slot "${item.slot}".`);
    }
    return;
};

module.exports.loadPuzzles = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.puzzleSheetAllCells, function (response) {
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
            const columnCorrectDescription = 11;
            const columnAlreadySolvedDescription = 12;
            const columnIncorrectDescription = 13;
            const columnNoMoreAttemptsDescription = 14;
            const columnRequirementsNotMetDescription = 15;

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
                        sheet[i][columnParentObject] ? sheet[i][columnParentObject] : "",
                        sheet[i][columnType],
                        sheet[i][columnAccessible] === "TRUE",
                        sheet[i][columnRequires] ? sheet[i][columnRequires] : null,
                        sheet[i][columnSolution] ? sheet[i][columnSolution].toString() : "",
                        parseInt(sheet[i][columnAttempts]),
                        solvedCommands,
                        unsolvedCommands,
                        sheet[i][columnCorrectDescription] ? sheet[i][columnCorrectDescription] : "",
                        sheet[i][columnAlreadySolvedDescription] ? sheet[i][columnAlreadySolvedDescription] : "",
                        sheet[i][columnIncorrectDescription] ? sheet[i][columnIncorrectDescription] : "",
                        sheet[i][columnNoMoreAttemptsDescription] ? sheet[i][columnNoMoreAttemptsDescription] : "",
                        sheet[i][columnRequirementsNotMetDescription] ? sheet[i][columnRequirementsNotMetDescription] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            for (let i = 0; i < game.puzzles.length; i++) {
                game.puzzles[i].location = game.rooms.find(room => room.name === game.puzzles[i].location && room.name !== "");
                let parentObject = game.objects.find(object => object.name === game.puzzles[i].parentObjectName && object.location === game.puzzles[i].location);
                if (parentObject) game.puzzles[i].parentObject = parentObject;
                let requires = game.puzzles.find(puzzle => puzzle.name === game.puzzles[i].requires);
                if (requires) game.puzzles[i].requires = requires;
                if (doErrorChecking) {
                    let error = exports.checkPuzzle(game.puzzles[i]);
                    if (error instanceof Error) errors.push(error);
                }
            }
            for (let i = 0; i < game.objects.length; i++) {
                if (game.objects[i].childPuzzleName !== "")
                    game.objects[i].childPuzzle = game.puzzles.find(puzzle => puzzle.name === game.objects[i].childPuzzleName && puzzle.location.name === game.objects[i].location.name);
            }
            for (let i = 0; i < game.items.length; i++) {
                if (game.items[i].containerName.startsWith("Puzzle:"))
                    game.items[i].container = game.puzzles.find(puzzle => puzzle.name === game.items[i].containerName.substring("Puzzle:".length).trim() && puzzle.location.name === game.items[i].location.name);
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkPuzzle = function (puzzle) {
    if (puzzle.name === "" || puzzle.name === null || puzzle.name === undefined)
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. No puzzle name was given.`);
    if (!(puzzle.location instanceof Room))
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. The location given is not a room.`);
    if (puzzle.parentObjectName !== "" && !(puzzle.parentObject instanceof Object))
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. The parent object given is not an object.`);
    if (puzzle.parentObject !== null && puzzle.parentObject.childPuzzle === null)
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. The parent object on row ${puzzle.parentObject.row} has no child puzzle.`);
    if (puzzle.parentObject !== null && puzzle.parentObject.childPuzzle !== null && puzzle.parentObject.childPuzzle.name !== puzzle.name)
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. The parent object has a different child puzzle.`);
    if (puzzle.type !== "password" && puzzle.type !== "interact" && puzzle.type !== "toggle" && puzzle.type !== "combination lock" && puzzle.type !== "key lock")
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. "${puzzle.type}" is not a valid puzzle type.`);
    if (puzzle.requires !== null && !(puzzle.requires instanceof Puzzle))
        return new Error(`Couldn't load puzzle on row ${puzzle.row}. The requirement given is not a puzzle.`);
    return;
};

module.exports.loadEvents = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.eventSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnOngoing = 1;
            const columnDuration = 2;
            const columnTimeRemaining = 3;
            const columnTriggersAt = 4;
            const columnRoomTag = 5;
            const columnCommands = 6;
            const columnStatusEffects = 7;
            const columnTriggeredNarration = 8;
            const columnEndedNarration = 9;

            game.events.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                const durationString = sheet[i][columnDuration] ? sheet[i][columnDuration].toString() : "";
                let durationInt = parseInt(durationString.substring(0, durationString.length - 1));
                let durationUnit = durationString.charAt(durationString.length - 1);
                // If an invalid unit was given, pass NaN for both parameters. This produces an invalid duration.
                if (!"yMwdhms".includes(durationUnit)) {
                    durationInt = NaN;
                    durationUnit = NaN;
                }
                var duration = durationString ? moment.duration(durationInt, durationUnit) : null;
                var timeRemaining = sheet[i][columnTimeRemaining] ? moment.duration(sheet[i][columnTimeRemaining]) : null;
                var triggerTimes = sheet[i][columnTriggersAt] ? sheet[i][columnTriggersAt].split(',') : [];
                for (let j = 0; j < triggerTimes.length; j++)
                    triggerTimes[j] = moment(triggerTimes[j].trim(), ["LT", "LTS", "HH:mm", "hh:mm a"]);
                const commands = sheet[i][columnCommands] ? sheet[i][columnCommands].split('/') : ["", ""];
                var triggeredCommands = commands[0] ? commands[0].split(',') : [];
                for (let j = 0; j < triggeredCommands.length; j++)
                    triggeredCommands[j] = triggeredCommands[j].trim();
                var endedCommands = commands[1] ? commands[1].split(',') : [];
                for (let j = 0; j < endedCommands.length; j++)
                    endedCommands[j] = endedCommands[j].trim();
                var effects = sheet[i][columnStatusEffects] ? sheet[i][columnStatusEffects].split(',') : [];
                for (let j = 0; j < effects.length; j++)
                    effects[j] = effects[j].trim();
                game.events.push(
                    new Event(
                        sheet[i][columnName],
                        sheet[i][columnOngoing] === "TRUE",
                        duration,
                        timeRemaining,
                        triggerTimes,
                        sheet[i][columnRoomTag] ? sheet[i][columnRoomTag] : "",
                        triggeredCommands,
                        endedCommands,
                        effects,
                        sheet[i][columnTriggeredNarration] ? sheet[i][columnTriggeredNarration] : "",
                        sheet[i][columnEndedNarration] ? sheet[i][columnEndedNarration] : "",
                        i + 1
                    )
                );
            }
            var errors = [];
            for (let i = 0; i < game.events.length; i++) {
                for (let j = 0; j < game.events[i].effects.length; j++) {
                    let status = game.statusEffects.find(statusEffect => statusEffect.name === game.events[i].effects[j]);
                    if (status) game.events[i].effects[j] = status;
                }
                if (doErrorChecking) {
                    let error = exports.checkEvent(game.events[i], game);
                    if (error instanceof Error) errors.push(error);
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkEvent = function (event, game) {
    if (event.name === "" || event.name === null || event.name === undefined)
        return new Error(`Couldn't load event on row ${event.row}. No event name was given.`);
    if (game.events.filter(other => other.name === event.name && other.row < event.row).length > 0)
        return new Error(`Couldn't load event on row ${event.row}. Another event with this name already exists.`);
    if (event.duration !== null && !event.duration.isValid())
        return new Error(`Couldn't load event on row ${event.row}. An invalid duration was given.`);
    if (event.remaining !== null && !event.remaining.isValid())
        return new Error(`Couldn't load event on row ${event.row}. An invalid time remaining was given.`);
    if (!event.ongoing && event.remaining !== null)
        return new Error(`Couldn't load event on row ${event.row}. The event is not ongoing, but an amount of time remaining was given.`);
    if (event.ongoing && event.duration !== null && event.remaining === null)
        return new Error(`Couldn't load event on row ${event.row}. The event is ongoing, but no amount of time remaining was given.`);
    for (let i = 0; i < event.triggerTimes.length; i++) {
        if (!event.triggerTimes[i].isValid()) {
            let timeString = event.triggerTimes[i].inspect().replace(/moment.invalid\(\/\* (.*)\*\/\)/g, '$1').trim();
            return new Error(`Couldn't load event on row ${event.row}. "${timeString}" is not a valid time to trigger at.`);
        }
    }
    for (let i = 0; i < event.effects.length; i++) {
        if (!(event.effects[i] instanceof Status))
            return new Error(`Couldn't load event on row ${event.row}. "${event.effects[i]}" in refreshing status effects is not a status effect.`);
    }
    return;
};

module.exports.loadStatusEffects = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.statusSheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnName = 0;
            const columnDuration = 1;
            const columnFatal = 2;
            const columnVisible = 3;
            const columnCures = 4;
            const columnNextStage = 5;
            const columnDuplicatedStatus = 6;
            const columnCuredCondition = 7;
            const columnStatModifier = 8;
            const columnAttributes = 9;
            const columnInflictedDescription = 11;
            const columnCuredDescription = 12;

            game.statusEffects.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                var cures = sheet[i][columnCures] ? sheet[i][columnCures].split(',') : [];
                for (let j = 0; j < cures.length; j++)
                    cures[j] = cures[j].trim();
                var modifierStrings = sheet[i][columnStatModifier] ? sheet[i][columnStatModifier].split(',') : [];
                var modifiers = [];
                for (let j = 0; j < modifierStrings.length; j++) {
                    modifierStrings[j] = modifierStrings[j].toLowerCase().trim();

                    var modifiesSelf = true;
                    if (modifierStrings[j].charAt(0) === '@') {
                        modifiesSelf = false;
                        modifierStrings[j] = modifierStrings[j].substring(1);
                    }

                    var stat = null;
                    var assignValue = false;
                    var value = null;
                    if (modifierStrings[j].includes('+')) {
                        stat = modifierStrings[j].substring(0, modifierStrings[j].indexOf('+'));
                        value = parseInt(modifierStrings[j].substring(stat.length));
                    }
                    else if (modifierStrings[j].includes('-')) {
                        stat = modifierStrings[j].substring(0, modifierStrings[j].indexOf('-'));
                        value = parseInt(modifierStrings[j].substring(stat.length));
                    }
                    else if (modifierStrings[j].includes('=')) {
                        stat = modifierStrings[j].substring(0, modifierStrings[j].indexOf('='));
                        assignValue = true;
                        value = parseInt(modifierStrings[j].substring(stat.length + 1));
                    }

                    if (stat === "strength") stat = "str";
                    else if (stat === "intelligence") stat = "int";
                    else if (stat === "dexterity") stat = "dex";
                    else if (stat === "speed") stat = "spd";
                    else if (stat === "stamina") stat = "sta";

                    modifiers.push({ modifiesSelf: modifiesSelf, stat: stat, assignValue: assignValue, value: value });
                }
                game.statusEffects.push(
                    new Status(
                        sheet[i][columnName],
                        sheet[i][columnDuration].toLowerCase(),
                        sheet[i][columnFatal] === "TRUE",
                        sheet[i][columnVisible] === "TRUE",
                        cures,
                        sheet[i][columnNextStage] ? sheet[i][columnNextStage] : null,
                        sheet[i][columnDuplicatedStatus] ? sheet[i][columnDuplicatedStatus] : null,
                        sheet[i][columnCuredCondition] ? sheet[i][columnCuredCondition] : null,
                        modifiers,
                        sheet[i][columnAttributes] ? sheet[i][columnAttributes] : "",
                        sheet[i][columnInflictedDescription] ? sheet[i][columnInflictedDescription] : "",
                        sheet[i][columnCuredDescription] ? sheet[i][columnCuredDescription] : "",
                        i + 1
                    )
                );
            }
            // Now go through and make the nextStage and curedCondition an actual Status object.
            var errors = [];
            for (let i = 0; i < game.statusEffects.length; i++) {
                for (let j = 0; j < game.statusEffects[i].cures.length; j++) {
                    let cure = game.statusEffects.find(statusEffect => statusEffect.name === game.statusEffects[i].cures[j]);
                    if (cure) game.statusEffects[i].cures[j] = cure;
                }
                if (game.statusEffects[i].nextStage) {
                    let nextStage = game.statusEffects.find(statusEffect => statusEffect.name === game.statusEffects[i].nextStage);
                    if (nextStage) game.statusEffects[i].nextStage = nextStage;
                }
                if (game.statusEffects[i].duplicatedStatus) {
                    let duplicatedStatus = game.statusEffects.find(statusEffect => statusEffect.name === game.statusEffects[i].duplicatedStatus);
                    if (duplicatedStatus) game.statusEffects[i].duplicatedStatus = duplicatedStatus;
                }
                if (game.statusEffects[i].curedCondition) {
                    let curedCondition = game.statusEffects.find(statusEffect => statusEffect.name === game.statusEffects[i].curedCondition);
                    if (curedCondition) game.statusEffects[i].curedCondition = curedCondition;
                }
                if (doErrorChecking) {
                    let error = exports.checkStatusEffect(game.statusEffects[i]);
                    if (error instanceof Error) errors.push(error);
                }
            }
            for (let i = 0; i < game.prefabs.length; i++) {
                for (let j = 0; j < game.prefabs[i].effectsStrings.length; j++) {
                    let status = game.statusEffects.find(statusEffect => statusEffect.name === game.prefabs[i].effectsStrings[j]);
                    if (status) game.prefabs[i].effects[j] = status;
                }
                for (let j = 0; j < game.prefabs[i].curesStrings.length; j++) {
                    let status = game.statusEffects.find(statusEffect => statusEffect.name === game.prefabs[i].curesStrings[j]);
                    if (status) game.prefabs[i].cures[j] = status;
                }
            }
            for (let i = 0; i < game.events.length; i++) {
                for (let j = 0; j < game.events[i].effectsStrings.length; j++) {
                    let status = game.statusEffects.find(statusEffect => statusEffect.name === game.events[i].effectsStrings[j]);
                    if (status) game.events[i].effects[j] = status;
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkStatusEffect = function (status) {
    if (status.name === "" || status.name === null || status.name === undefined)
        return new Error(`Couldn't load status effect on row ${status.row}. No status effect name was given.`);
    const timeInt = status.duration.substring(0, status.duration.length - 1);
    if (status.duration !== "" && (isNaN(timeInt) || !status.duration.endsWith('m') && !status.duration.endsWith('h')))
        return new Error(`Couldn't load status effect on row ${status.row}. Duration format is incorrect. Must be a number followed by 'm' or 'h'.`);
    for (let i = 0; i < status.statModifiers.length; i++) {
        if (status.statModifiers[i].stat === null)
            return new Error(`Couldn't load status effect on row ${status.row}. No stat in stat modifier ${i + 1} was given.`);
        if (status.statModifiers[i].stat !== "str" && status.statModifiers[i].stat !== "int" && status.statModifiers[i].stat !== "dex" && status.statModifiers[i].stat !== "spd" && status.statModifiers[i].stat !== "sta")
            return new Error(`Couldn't load status effect on row ${status.row}. "${status.statModifiers[i].stat}" in stat modifier ${i + 1} is not a valid stat.`);
        if (status.statModifiers[i].value === null)
            return new Error(`Couldn't load status effect on row ${status.row}. No number was given in stat modifier ${i + 1}.`);
        if (isNaN(status.statModifiers[i].value))
            return new Error(`Couldn't load status effect on row ${status.row}. The value given in stat modifier ${i + 1} is not an integer.`);
    }
    if (status.cures.length > 0) {
        for (let i = 0; i < status.cures.length; i++)
            if (!(status.cures[i] instanceof Status))
                return new Error(`Couldn't load status effect on row ${status.row}. "${status.cures[i]}" in cures is not a status effect.`);
    }
    if (status.nextStage !== null && !(status.nextStage instanceof Status))
        return new Error(`Couldn't load status effect on row ${status.row}. Next stage "${status.nextStage}" is not a status effect.`);
    if (status.duplicatedStatus !== null && !(status.duplicatedStatus instanceof Status))
        return new Error(`Couldn't load status effect on row ${status.row}. Duplicated status "${status.duplicatedStatus}" is not a status effect.`);
    if (status.curedCondition !== null && !(status.curedCondition instanceof Status))
        return new Error(`Couldn't load status effect on row ${status.row}. Cured condition "${status.curedCondition}" is not a status effect.`);
    return;
};

module.exports.loadPlayers = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        // Clear all player status effects and movement timers first.
        for (let i = 0; i < game.players.length; i++) {
            for (let j = 0; j < game.players[i].status.length; j++) {
                clearInterval(game.players[i].status[j].timer);
            }
            game.players[i].isMoving = false;
            clearInterval(game.players[i].moveTimer);
            game.players[i].remainingTime = 0;
            game.players[i].setOffline();
        }
        // Clear all rooms of their occupants.
        for (let i = 0; i < game.rooms.length; i++)
            game.rooms[i].occupants.length = 0;

        sheets.getData(settings.playerSheetAllCells, async function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnID = 0;
            const columnName = 1;
            const columnTalent = 2;
            const columnPronouns = 3;
            const columnStrength = 4;
            const columnIntelligence = 5;
            const columnDexterity = 6;
            const columnSpeed = 7;
            const columnStamina = 8;
            const columnAlive = 9;
            const columnLocation = 10;
            const columnHidingSpot = 11;
            const columnStatus = 12;
            const columnDescription = 13;

            game.players.length = 0;
            game.players_alive.length = 0;
            game.players_dead.length = 0;

            for (let i = 2; i < sheet.length; i++) {
                const stats = {
                    strength: parseInt(sheet[i][columnStrength]),
                    intelligence: parseInt(sheet[i][columnIntelligence]),
                    dexterity: parseInt(sheet[i][columnDexterity]),
                    speed: parseInt(sheet[i][columnSpeed]),
                    stamina: parseInt(sheet[i][columnStamina])
                };
                const player =
                    new Player(
                        sheet[i][columnID],
                        game.guild.members.find(member => member.id === sheet[i][columnID]),
                        sheet[i][columnName],
                        sheet[i][columnName],
                        sheet[i][columnTalent],
                        sheet[i][columnPronouns] ? sheet[i][columnPronouns].toLowerCase() : "",
                        stats,
                        sheet[i][columnAlive] === "TRUE",
                        game.rooms.find(room => room.name === sheet[i][columnLocation]),
                        sheet[i][columnHidingSpot],
                        new Array(),
                        sheet[i][columnDescription] ? sheet[i][columnDescription] : "",
                        new Array(),
                        i + 1
                    );
                player.setPronouns(player.originalPronouns, player.pronounString);
                player.setPronouns(player.pronouns, player.pronounString);
                game.players.push(player);

                if (player.alive) {
                    game.players_alive.push(player);

                    // Parse statuses and inflict the player with them.
                    const currentPlayer = game.players_alive[game.players_alive.length - 1];
                    const statuses = sheet[i][columnStatus] ? sheet[i][columnStatus].split(',') : "";
                    for (let j = 0; j < game.statusEffects.length; j++) {
                        for (let k = 0; k < statuses.length; k++) {
                            if (game.statusEffects[j].name === statuses[k].trim()) {
                                currentPlayer.inflict(game, game.statusEffects[j].name, false, false, false);
                                break;
                            }
                        }
                    }
                    game.queue.push(new QueueEntry(Date.now(), "updateCell", currentPlayer.statusCell(), `Players!${currentPlayer.name}|Status`, currentPlayer.statusString));

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

            await exports.loadInventories(game, false);

            var errors = [];
            for (let i = 0; i < game.players.length; i++) {
                if (doErrorChecking) {
                    let error = exports.checkPlayer(game.players[i]);
                    if (error instanceof Error) errors.push(error);

                    let playerInventory = game.inventoryItems.filter(item => item.player.id === game.players[i].id);
                    for (let j = 0; j < playerInventory.length; j++) {
                        error = exports.checkInventoryItem(playerInventory[j], game);
                        if (error instanceof Error) errors.push(error);
                    }
                }
            }
            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkPlayer = function (player) {
    if (player.id === "" || player.id === null || player.id === undefined)
        return new Error(`Couldn't load player on row ${player.row}. No Discord ID was given.`);
    if (player.member === null || player.member === undefined)
        return new Error(`Couldn't load player on row ${player.row}. There is no member on the server with the ID ${player.id}.`);
    if (player.name === "" || player.name === null || player.name === undefined)
        return new Error(`Couldn't load player on row ${player.row}. No player name was given.`);
    if (player.name.includes(" "))
        return new Error(`Couldn't load player on row ${player.row}. Player names must not have any spaces.`);
    if (player.originalPronouns.sbj === null || player.originalPronouns.sbj === "")
        return new Error(`Couldn't load player on row ${player.row}. No subject pronoun was given.`);
    if (player.originalPronouns.obj === null || player.originalPronouns.obj === "")
        return new Error(`Couldn't load player on row ${player.row}. No object pronoun was given.`);
    if (player.originalPronouns.dpos === null || player.originalPronouns.dpos === "")
        return new Error(`Couldn't load player on row ${player.row}. No dependent possessive pronoun was given.`);
    if (player.originalPronouns.ipos === null || player.originalPronouns.ipos === "")
        return new Error(`Couldn't load player on row ${player.row}. No independent possessive pronoun was given.`);
    if (player.originalPronouns.ref === null || player.originalPronouns.ref === "")
        return new Error(`Couldn't load player on row ${player.row}. No reflexive pronoun was given.`);
    if (player.originalPronouns.plural === null || player.originalPronouns.plural === "")
        return new Error(`Couldn't load player on row ${player.row}. Whether the player's pronouns pluralize verbs was not specified.`);
    if (isNaN(player.strength))
        return new Error(`Couldn't load player on row ${player.row}. The strength stat given is not an integer.`);
    if (isNaN(player.intelligence))
        return new Error(`Couldn't load player on row ${player.row}. The intelligence stat given is not an integer.`);
    if (isNaN(player.dexterity))
        return new Error(`Couldn't load player on row ${player.row}. The dexterity stat given is not an integer.`);
    if (isNaN(player.speed))
        return new Error(`Couldn't load player on row ${player.row}. The speed stat given is not an integer.`);
    if (isNaN(player.stamina))
        return new Error(`Couldn't load player on row ${player.row}. The stamina stat given is not an integer.`);
    if (player.alive && !(player.location instanceof Room))
        return new Error(`Couldn't load player on row ${player.row}. The location given is not a room.`);
    return;
};

module.exports.loadInventories = function (game, doErrorChecking) {
    return new Promise((resolve, reject) => {
        sheets.getData(settings.inventorySheetAllCells, function (response) {
            const sheet = response.data.values;
            // These constants are the column numbers corresponding to that data on the spreadsheet.
            const columnPlayer = 0;
            const columnPrefab = 1;
            const columnIdentifier = 2;
            const columnEquipmentSlot = 3;
            const columnContainer = 4;
            const columnQuantity = 5;
            const columnUses = 6;
            const columnDescription = 7;

            game.inventoryItems.length = 0;
            for (let i = 1; i < sheet.length; i++) {
                const player = game.players.find(player => player.name === sheet[i][columnPlayer] && player.name !== "");
                if (sheet[i][columnPrefab] !== "NULL") {
                    // Find the prefab first.
                    const prefab = game.prefabs.find(prefab => prefab.id === sheet[i][columnPrefab] && prefab.id !== "");

                    game.inventoryItems.push(
                        new InventoryItem(
                            player ? player : sheet[i][columnPlayer],
                            prefab ? prefab : sheet[i][columnPrefab],
                            sheet[i][columnIdentifier] ? sheet[i][columnIdentifier] : "",
                            sheet[i][columnEquipmentSlot],
                            sheet[i][columnContainer] ? sheet[i][columnContainer] : "",
                            parseInt(sheet[i][columnQuantity]),
                            parseInt(sheet[i][columnUses]),
                            sheet[i][columnDescription] ? sheet[i][columnDescription] : "",
                            i + 1
                        )
                    );
                }
                else {
                    game.inventoryItems.push(
                        new InventoryItem(
                            player ? player : sheet[i][columnPlayer],
                            null,
                            "",
                            sheet[i][columnEquipmentSlot],
                            "",
                            null,
                            null,
                            "",
                            i + 1
                        )
                    );
                }
            }
            // Create EquipmentSlots for each player.
            for (let i = 0; i < game.players.length; i++) {
                let inventory = [];
                game.players[i].carryWeight = 0;
                let equipmentItems = game.inventoryItems.filter(item => item.player instanceof Player && item.player.id === game.players[i].id && item.equipmentSlot !== "" && item.containerName === "");
                for (let j = 0; j < equipmentItems.length; j++)
                    inventory.push(new EquipmentSlot(equipmentItems[j].equipmentSlot, equipmentItems[j].row));
                game.players[i].inventory = inventory;
            }
            var errors = [];
            for (let i = 0; i < game.inventoryItems.length; i++) {
                const prefab = game.inventoryItems[i].prefab;
                if (prefab instanceof Prefab) {
                    for (let j = 0; j < prefab.inventory.length; j++)
                        game.inventoryItems[i].inventory.push({
                            name: prefab.inventory[j].name,
                            capacity: prefab.inventory[j].capacity,
                            takenSpace: prefab.inventory[j].takenSpace,
                            weight: prefab.inventory[j].weight,
                            item: []
                        });
                }
                if (game.inventoryItems[i].player) {
                    const player = game.inventoryItems[i].player;
                    for (let slot = 0; slot < player.inventory.length; slot++) {
                        if (player.inventory[slot].name === game.inventoryItems[i].equipmentSlot) {
                            game.inventoryItems[i].foundEquipmentSlot = true;
                            if (game.inventoryItems[i].quantity !== 0) player.inventory[slot].items.push(game.inventoryItems[i]);
                            if (game.inventoryItems[i].containerName === "") {
                                if (prefab === null) player.inventory[slot].equippedItem = null;
                                else player.inventory[slot].equippedItem = game.inventoryItems[i];
                            }
                            else {
                                const splitContainer = game.inventoryItems[i].containerName.split('/');
                                const containerItemIdentifier = splitContainer[0] ? splitContainer[0].trim() : "";
                                const containerItemSlot = splitContainer[1] ? splitContainer[1].trim() : "";
                                game.inventoryItems[i].slot = containerItemSlot;
                                for (let j = 0; j < player.inventory[slot].items.length; j++) {
                                    if (player.inventory[slot].items[j].prefab && player.inventory[slot].items[j].identifier === containerItemIdentifier) {
                                        game.inventoryItems[i].container = player.inventory[slot].items[j];
                                        for (let k = 0; k < game.inventoryItems[i].container.inventory.length; k++) {
                                            if (game.inventoryItems[i].container.inventory[k].name === containerItemSlot)
                                                game.inventoryItems[i].container.inventory[k].item.push(game.inventoryItems[i]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Create a recursive function for properly inserting item inventories.
            let insertInventory = function (item) {
                var createdItem = new InventoryItem(
                    item.player,
                    item.prefab,
                    item.identifier,
                    item.equipmentSlot,
                    item.containerName,
                    item.quantity,
                    item.uses,
                    item.description,
                    item.row
                );
                createdItem.foundEquipmentSlot = item.foundEquipmentSlot;
                if (item.container instanceof InventoryItem) createdItem.container = game.inventoryItems.find(gameItem => gameItem.row === item.container.row);
                else createdItem.container = item.container;
                createdItem.slot = item.slot;
                createdItem.weight = item.weight;

                // Initialize the item's inventory slots.
                for (let i = 0; i < item.prefab.inventory.length; i++)
                    createdItem.inventory.push({
                        name: item.prefab.inventory[i].name,
                        capacity: item.prefab.inventory[i].capacity,
                        takenSpace: item.prefab.inventory[i].takenSpace,
                        weight: item.prefab.inventory[i].weight,
                        item: []
                    });

                for (let i = 0; i < item.inventory.length; i++) {
                    for (let j = 0; j < item.inventory[i].item.length; j++) {
                        let inventoryItem = insertInventory(item.inventory[i].item[j]);
                        let foundItem = false;
                        for (var k = 0; k < game.inventoryItems.length; k++) {
                            if (game.inventoryItems[k].row === inventoryItem.row) {
                                foundItem = true;
                                game.inventoryItems[k] = inventoryItem;
                                break;
                            }
                        }
                        if (foundItem) {
                            game.inventoryItems[k].container = createdItem;
                            if (game.inventoryItems[k].containerName !== "")
                                createdItem.insertItem(game.inventoryItems[k], game.inventoryItems[k].slot);
                            else createdItem.inventory[i].item.push(game.inventoryItems[k]);
                        }
                    }
                }
                return createdItem;
            };
            // Run through inventoryItems one more time to properly insert their inventories and assign them to players.
            for (let i = 0; i < game.inventoryItems.length; i++) {
                if (game.inventoryItems[i].prefab instanceof Prefab) {
                    if (game.inventoryItems[i].quantity !== 0 && game.inventoryItems[i].containerName !== "" && game.inventoryItems[i].container === null) {
                        const splitContainer = game.inventoryItems[i].containerName.split('/');
                        const containerItemIdentifier = splitContainer[0] ? splitContainer[0].trim() : "";
                        const containerItemSlot = splitContainer[1] ? splitContainer[1].trim() : "";
                        let container = game.inventoryItems.find(item =>
                            item.player.id === game.inventoryItems[i].player.id &&
                            item.identifier === containerItemIdentifier &&
                            item.quantity !== 0
                        );
                        if (container) {
                            game.inventoryItems[i].container = container;
                            for (let j = 0; j < game.inventoryItems[i].container.inventory.length; j++) {
                                if (game.inventoryItems[i].container.inventory[j].name === containerItemSlot)
                                    game.inventoryItems[i].container.inventory[j].item.push(game.inventoryItems[i]);
                            }
                        }
                    }
                    let container = game.inventoryItems[i].container;
                    if (game.inventoryItems[i].container instanceof InventoryItem) {
                        for (let slot = 0; slot < container.inventory.length; slot++) {
                            for (let j = 0; j < container.inventory[slot].item.length; j++) {
                                if (container.inventory[slot].item[j].row === game.inventoryItems[i].row) {
                                    game.inventoryItems[i] = container.inventory[slot].item[j];
                                    break;
                                }
                            }
                        }
                    }
                    else game.inventoryItems[i] = insertInventory(game.inventoryItems[i]);
                }
                if (game.inventoryItems[i].player) {
                    const player = game.inventoryItems[i].player;
                    for (let slot = 0; slot < player.inventory.length; slot++) {
                        if (player.inventory[slot].name === game.inventoryItems[i].equipmentSlot && game.inventoryItems[i].containerName === "" && game.inventoryItems[i].prefab !== null) {
                            player.inventory[slot].equippedItem = game.inventoryItems[i];
                            player.carryWeight += game.inventoryItems[i].weight * game.inventoryItems[i].quantity;
                        }
                        let foundItem = false;
                        for (let j = 0; j < player.inventory[slot].items.length; j++) {
                            if (player.inventory[slot].items[j].row === game.inventoryItems[i].row) {
                                foundItem = true;
                                player.inventory[slot].items[j] = game.inventoryItems[i];
                                break;
                            }
                        }
                        if (foundItem) break;
                    }
                }

                if (doErrorChecking) {
                    let error = exports.checkInventoryItem(game.inventoryItems[i], game);
                    if (error instanceof Error) errors.push(error);
                }
            }

            if (errors.length > 0) {
                if (errors.length > 5) {
                    errors = errors.slice(0, 5);
                    errors.push(new Error("Too many errors."));
                }
                let errorMessage = errors.join('\n');
                reject(errorMessage);
            }
            resolve(game);
        });
    });
};

module.exports.checkInventoryItem = function (item, game) {
    if (!(item.player instanceof Player))
        return new Error(`Couldn't load inventory item on row ${item.row}. The player name given is not a player.`);
    if (item.prefab !== null) {
        if (!(item.prefab instanceof Prefab))
            return new Error(`Couldn't load inventory item on row ${item.row}. The prefab given is not a prefab.`);
        if (item.inventory.length > 0 && item.identifier === "")
            return new Error(`Couldn't load inventory item on row ${item.row}. This item is capable of containing items, but no container identifier was given.`);
        if (item.inventory.length > 0 && (item.quantity > 1 || isNaN(item.quantity)))
            return new Error(`Couldn't load inventory item on row ${item.row}. Items capable of containing items must have a quantity of 1.`);
        if (item.identifier !== "" && item.quantity !== 0 &&
            game.items.filter(other => other.identifier === item.identifier && other.quantity !== 0).length
            + game.inventoryItems.filter(other => other.identifier === item.identifier && other.row < item.row && other.quantity !== 0).length > 0)
            return new Error(`Couldn't load inventory item on row ${item.row}. Another item or inventory item with this container identifier already exists.`);
        if (item.prefab.pluralContainingPhrase === "" && (item.quantity > 1 || isNaN(item.quantity)))
            return new Error(`Couldn't load inventory item on row ${item.row}. Quantity is higher than 1, but its prefab on row ${item.prefab.row} has no plural containing phrase.`);
        if (!item.foundEquipmentSlot)
            return new Error(`Couldn't load inventory item on row ${item.row}. Couldn't find equipment slot "${item.equipmentSlot}".`);
        //if (item.equipmentSlot !== "RIGHT HAND" && item.equipmentSlot !== "LEFT HAND" && item.containerName !== "" && (item.container === null || item.container === undefined))
        //    return new Error(`Couldn't load inventory item on row ${item.row}. Couldn't find container "${item.containerName}".`);
        if (item.container instanceof InventoryItem && item.container.inventory.length === 0)
            return new Error(`Couldn't load inventory item on row ${item.row}. The item's container is an inventory item, but the item container's prefab on row ${item.container.prefab.row} has no inventory slots.`);
        if (item.container instanceof InventoryItem) {
            if (item.slot === "") return new Error(`Couldn't load inventory item on row ${item.row}. The item's container is an inventory item, but a prefab inventory slot name was not given.`);
            let foundSlot = false;
            for (let i = 0; i < item.container.inventory.length; i++) {
                if (item.container.inventory[i].name === item.slot) {
                    foundSlot = true;
                    if (item.container.inventory[i].takenSpace > item.container.inventory[i].capacity)
                        return new Error(`Couldn't load inventory item on row ${item.row}. The item's container is over capacity.`);
                }
            }
            if (!foundSlot) return new Error(`Couldn't load inventory item on row ${item.row}. The item's container prefab on row ${item.container.prefab.row} has no inventory slot "${item.slot}".`);
        }
    }
    return;
};
