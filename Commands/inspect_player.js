﻿const settings = include('Configs/settings.json');
const constants = include('Configs/constants.json');

const Narration = include(`${constants.dataDir}/Narration.js`);

module.exports.config = {
    name: "inspect_player",
    description: "Learn more about an object, item, or player.",
    details: 'Tells you about an object, item, or player in the room you\'re in. '
        + 'An object is something in the room that you can interact with but not take with you. '
        + 'An item is something that you can both interact with and take with you. If you inspect an object, '
        + 'everyone in the room will see you inspect it. The same goes for very large items. '
        + 'If there are multiple items with the same name in the room, you can specify which one you want to inspect using the name of the container it\'s in. '
        + 'You can also inspect items in your inventory. If you have an item with the same name as an item in the room you\'re currently in, '
        + 'you can specify that you want to inspect your item by adding "my" before the item name. '
        + 'You can even inspect visible items in another player\'s inventory by adding "[player name]\'s" before the item name. No one will '
        + 'see you do this, however you will receive slightly less info when inspecting another player\'s items. '
        + `You can use "${settings.commandPrefix}inspect room" to get the description of the room you're currently in.`,
    usage: `${settings.commandPrefix}inspect desk\n`
        + `${settings.commandPrefix}examine knife\n`
        + `${settings.commandPrefix}look knife on desk\n`
        + `${settings.commandPrefix}x knife in main pouch of red backpack\n`
        + `${settings.commandPrefix}investigate my knife\n`
        + `${settings.commandPrefix}look akari\n`
        + `${settings.commandPrefix}examine an individual wearing a mask\n`
        + `${settings.commandPrefix}look marielle's glasses\n`
        + `${settings.commandPrefix}x an individual wearing a bucket's shirt\n`
        + `${settings.commandPrefix}inspect room`,
    usableBy: "Player",
    aliases: ["inspect", "investigate", "examine", "look", "x"]
};

module.exports.run = async (bot, game, message, command, args, player) => {
    if (args.length === 0)
        return game.messageHandler.addReply(message, `You need to specify an object/item/player. Usage:\n${exports.config.usage}`);

    const status = player.getAttributeStatusEffects("disable inspect");
    if (status.length > 0) return game.messageHandler.addReply(message, `You cannot do that because you are **${status[0].name}**.`);

    // This will be checked multiple times, so get it now.
    const hiddenStatus = player.getAttributeStatusEffects("hidden");

    var input = args.join(" ");
    var parsedInput = input.toUpperCase().replace(/\'/g, "");

    // Before anything else, check if the player is trying to inspect the room.
    if (parsedInput === "ROOM") {
        new Narration(game, player, player.location, `${player.displayName} begins looking around the room.`).send();
        player.sendDescription(game, player.location.description, player.location);

        // Post log message.
        const time = new Date().toLocaleTimeString();
        game.messageHandler.addLogMessage(game.logChannel, `${time} - ${player.name} inspected the room in ${player.location.channel}`);

        return;
    }

    // Check if the input is an object, or an item on an object.
    const objects = game.objects.filter(object => object.location.name === player.location.name && object.accessible);
    const items = game.items.filter(item => item.location.name === player.location.name && item.accessible && (item.quantity > 0 || isNaN(item.quantity)));
    var object = null;
    var item = null;
    var container = null;
    var slotName = "";
    for (let i = 0; i < objects.length; i++) {
        if (objects[i].name === parsedInput) {
            object = objects[i];
            break;
        }

        if ((parsedInput.endsWith(` ${objects[i].preposition.toUpperCase()} ${objects[i].name}`) || parsedInput.endsWith(` IN ${objects[i].name}`)) && objects[i].preposition !== "") {
            const objectItems = items.filter(item => item.containerName === `Object: ${objects[i].name}` || objects[i].childPuzzle !== null && item.containerName === `Puzzle: ${objects[i].childPuzzle.name}`);
            for (let j = 0; j < objectItems.length; j++) {
                if (
                    parsedInput === `${objectItems[j].name} ${objects[i].preposition.toUpperCase()} ${objects[i].name}` ||
                    parsedInput === `${objectItems[j].pluralName} ${objects[i].preposition.toUpperCase()} ${objects[i].name}` ||
                    parsedInput === `${objectItems[j].name} IN ${objects[i].name}` ||
                    parsedInput === `${objectItems[j].pluralName} IN ${objects[i].name}`
                ) {
                    item = objectItems[j];
                    container = item.container;
                    slotName = item.slot;
                    break;
                }
            }
            if (item !== null) break;
        }
    }

    if (object !== null) {
        // Make sure the player can only inspect the object they're hiding in, if they're hidden.
        if (hiddenStatus.length > 0 && player.hidingSpot !== object.name) return game.messageHandler.addReply(message, `You cannot do that because you are **${hiddenStatus[0].name}**.`);
        new Narration(game, player, player.location, `${player.displayName} begins inspecting the ${object.name}.`).send();
        player.sendDescription(game, object.description, object);

        // Don't notify anyone if the player is inspecting the object that they're hiding in.
        if (hiddenStatus.length === 0 || player.hidingSpot !== object.name) {
            // Make sure the object isn't locked.
            if (object.childPuzzle === null || !object.childPuzzle.type.endsWith("lock") || object.childPuzzle.solved) {
                let hiddenPlayers = [];
                for (let i = 0; i < game.players_alive.length; i++) {
                    if (game.players_alive[i].location.name === player.location.name && game.players_alive[i].hidingSpot === object.name) {
                        hiddenPlayers.push(game.players_alive[i]);
                        game.players_alive[i].notify(game, `You've been found by ${player.displayName}!`);
                    }
                }

                // Create a list string of players currently hiding in that hiding spot.
                hiddenPlayers.sort(function (a, b) {
                    let nameA = a.displayName.toLowerCase();
                    let nameB = b.displayName.toLowerCase();
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return 0;
                });
                let hiddenPlayersString = "";
                if (hiddenPlayers.length === 1) hiddenPlayersString = hiddenPlayers[0].displayName;
                else if (hiddenPlayers.length === 2)
                    hiddenPlayersString += `${hiddenPlayers[0].displayName} and ${hiddenPlayers[1].displayName}`;
                else if (hiddenPlayers.length >= 3) {
                    for (let i = 0; i < hiddenPlayers.length - 1; i++)
                        hiddenPlayersString += `${hiddenPlayers[i].displayName}, `;
                    hiddenPlayersString += `and ${hiddenPlayers[hiddenPlayers.length - 1].displayName}`;
                }

                if (hiddenPlayersString) player.notify(game, `You find ${hiddenPlayersString} hiding in the ${object.name}!`);
            }
        }

        // Post log message.
        const time = new Date().toLocaleTimeString();
        game.messageHandler.addLogMessage(game.logChannel, `${time} - ${player.name} inspected ${object.name} in ${player.location.channel}`);

        return;
    }

    var onlySearchInventory = false;
    if (parsedInput.startsWith("MY ")) onlySearchInventory = true;

    if (!onlySearchInventory) {
        // Now check if the input is an item.
        for (let i = 0; i < items.length; i++) {
            if (items[i].name === parsedInput || items[i].pluralName === parsedInput) {
                item = items[i];
                container = item.container;
                slotName = item.slot;
                break;
            }

            if (items[i].container !== null && items[i].container.hasOwnProperty("prefab")) {
                const preposition = items[i].container.prefab.preposition.toUpperCase();
                let containerString = "";
                if (parsedInput.startsWith(`${items[i].name} ${preposition} `))
                    containerString = parsedInput.substring(`${items[i].name} ${preposition} `.length).trim();
                else if (parsedInput.startsWith(`${items[i].pluralName} ${preposition} `))
                    containerString = parsedInput.substring(`${items[i].pluralName} ${preposition} `.length).trim();
                else if (parsedInput.startsWith(`${items[i].name} IN `))
                    containerString = parsedInput.substring(`${items[i].name} IN `.length).trim();
                else if (parsedInput.startsWith(`${items[i].pluralName} IN `))
                    containerString = parsedInput.substring(`${items[i].pluralName} IN `.length).trim();
                
                if (containerString !== "") {
                    // Slot name was specified.
                    if (parsedInput.endsWith(` OF ${items[i].container.name}`)) {
                        let tempSlotName = containerString.substring(0, containerString.lastIndexOf(` OF ${items[i].container.name}`)).trim();
                        for (let slot = 0; slot < items[i].container.inventory.length; slot++) {
                            if (items[i].container.inventory[slot].name === tempSlotName && items[i].slot === tempSlotName) {
                                item = items[i];
                                container = item.container;
                                slotName = item.slot;
                                break;
                            }
                        }
                        if (item !== null) break;
                    }
                    // Only a container was specified.
                    else if (items[i].container.name === containerString) {
                        item = items[i];
                        container = item.container;
                        slotName = item.slot;
                        break;
                    }
                }
            }
        }
    }

    if (item !== null) {
        // Make sure the player can only inspect items contained in the object they're hiding in, if they're hidden.
        if (hiddenStatus.length > 0) {
            let topContainer = item.container;
            while (topContainer !== null && topContainer.hasOwnProperty("inventory"))
                topContainer = topContainer.container;
            if (topContainer !== null && topContainer.hasOwnProperty("parentObject"))
                topContainer = topContainer.parentObject;

            if (topContainer === null || topContainer.hasOwnProperty("hidingSpotCapacity") && topContainer.name !== player.hidingSpot)
                return game.messageHandler.addReply(message, `You cannot do that because you are **${hiddenStatus[0].name}**.`);
        }

        let preposition = "in";
        let containerName = "";
        let containerIdentifier = "";
        if (container.hasOwnProperty("prefab")) {
            preposition = container.prefab.preposition;
            containerName = container.singleContainingPhrase;
            containerIdentifier = `${slotName} of ${container.identifier}`;
        }
        else if (container.hasOwnProperty("hidingSpotCapacity")) {
            preposition = container.preposition;
            containerName = `the ${container.name}`;
            containerIdentifier = container.name;
        }
        else if (container.hasOwnProperty("solved")) {
            preposition = container.parentObject.preposition;
            containerName = `the ${container.parentObject.name}`;
            containerIdentifier = container.name;
        }
        if (!item.prefab.discreet)
            new Narration(game, player, player.location, `${player.displayName} begins inspecting ${item.singleContainingPhrase}` + (containerName ? ` ${preposition} ${containerName}` : '') + `.`).send();
        player.sendDescription(game, item.description, item);

        const time = new Date().toLocaleTimeString();
        const identifier = item.identifier !== "" ? item.identifier : item.prefab.id;
        game.messageHandler.addLogMessage(game.logChannel, `${time} - ${player.name} inspected ${identifier} ${preposition} ${containerIdentifier} in ${player.location.channel}`);

        return;
    }

    // Check if the input is an item in the player's inventory.
    const inventory = game.inventoryItems.filter(item => item.player.name === player.name && item.prefab !== null);
    for (let i = 0; i < inventory.length; i++) {
        parsedInput = parsedInput.replace("MY ", "");
        if (inventory[i].prefab.name === parsedInput && inventory[i].quantity > 0) {
            const item = inventory[i];
            if (!item.prefab.discreet) new Narration(game, player, player.location, `${player.displayName} takes out ${item.prefab.singleContainingPhrase} and begins inspecting it.`).send();
            player.sendDescription(game, item.description, item);

            const time = new Date().toLocaleTimeString();
            game.messageHandler.addLogMessage(game.logChannel, `${time} - ${player.name} inspected ` + (item.identifier !== "" ? item.identifier : item.prefab.id) + ` from ${player.originalPronouns.dpos} inventory in ${player.location.channel}`);

            return;
        }
    }

    // Check if the input is a player in the room.
    for (let i = 0; i < player.location.occupants.length; i++) {
        let occupant = player.location.occupants[i];
        const possessive = occupant.displayName.toUpperCase() + "S ";
        if (parsedInput.startsWith(occupant.displayName.toUpperCase()) && occupant.hasAttribute("hidden") && occupant.hidingSpot !== player.hidingSpot)
            return game.messageHandler.addReply(message, `Couldn't find "${input}".`);
        else if (parsedInput.startsWith(occupant.displayName.toUpperCase()) && hiddenStatus.length > 0 && !occupant.hasAttribute("hidden"))
            return game.messageHandler.addReply(message, `You cannot do that because you are **${hiddenStatus[0].name}**.`);
        if (occupant.displayName.toUpperCase() === parsedInput) {
            // Don't let player inspect themselves.
            if (occupant.name === player.name) return game.messageHandler.addReply(message, `You can't inspect yourself.`);
            player.sendDescription(game, occupant.description, occupant);

            const time = new Date().toLocaleTimeString();
            game.messageHandler.addLogMessage(game.logChannel, `${time} - ${player.name} inspected ${occupant.name} in ${player.location.channel}`);

            return;
        }
        else if (parsedInput.startsWith(possessive)) {
            // Don't let the player inspect their own items this way.
            if (occupant.name === player.name) return game.messageHandler.addReply(message, `You can't inspect your own items this way. Use "my" instead of your name.`);
            parsedInput = parsedInput.replace(possessive, "");
            // Only equipped items should be an option.
            const inventory = game.inventoryItems.filter(item => item.player.name === occupant.name && item.prefab !== null && item.containerName === "" && item.container === null);
            for (let j = 0; j < inventory.length; j++) {
                if (inventory[j].prefab.name === parsedInput && (inventory[j].equipmentSlot !== "LEFT HAND" && inventory[j].equipmentSlot !== "RIGHT HAND" || !inventory[j].prefab.discreet)) {
                    // Make sure the item isn't covered by anything first.
                    const coveringItems = inventory.filter(item =>
                        item.equipmentSlot !== "RIGHT HAND" &&
                        item.equipmentSlot !== "LEFT HAND" &&
                        item.prefab.coveredEquipmentSlots.includes(inventory[j].equipmentSlot)
                    );
                    if (coveringItems.length === 0) {
                        // Clear out any il tags in the description.
                        let description = inventory[j].description.replace(/(<(il)(\s[^>]+?)*>)[\s\S]+?(<\/\2>)/g, "$1$4");
                        player.sendDescription(game, description, inventory[j]);

                        const time = new Date().toLocaleTimeString();
                        game.messageHandler.addLogMessage(game.logChannel, `${time} - ${player.name} inspected ` + (inventory[j].identifier !== "" ? inventory[j].identifier : inventory[j].prefab.id) + ` from ${occupant.name}'s inventory in ${player.location.channel}`);

                        return;
                    }
                }
            }
        }
    }

    return game.messageHandler.addReply(message, `Couldn't find "${input}".`);
};
