const path = require('path')
const Bot = require("./Bot");
const {throwIfBadNumber} = require("../primitives/Misc");
const fs = require('fs')
const botNames = fs.readFileSync(path.resolve('./datafiles/botNames.txt'), 'utf8').split(/\r?\n/);
const skins = fs.readFileSync(path.resolve('./datafiles/skins.txt'), 'utf8').split(/\r?\n/);

class PlayerBot extends Bot {
    /**
     * @param {World} world
     */
    constructor(world) {
        super(world);

        this.splitCooldownTicks = 0;
        /** @type {Cell} */
        this.target = null;

        this.player.roamSpeed = world.settings.bot.roamSpeed;
        this.player.moveMult = world.settings.bot.moveMult;
    }

    static get separateInTeams() {
        return true;
    }

    get shouldClose() {
        return this.player === null
            || !this.player.exists
            || this.player.world === null;
    }

    update() {
        if (this.splitCooldownTicks > 0) this.splitCooldownTicks--;
        else this.target = null;

        this.player.updateVisibleCells();
        const player = this.player;
        if (player.state === -1) {
            // this.spawningName = "Player bot";
            // generate random bot name
            this.spawningName = botNames[Math.floor(Math.random() * Math.floor(botNames.length))];
            this.spawningSkin = skins[Math.floor(Math.random() * Math.floor(skins.length))];
            this.onSpawnRequest();
            this.spawningName = null;
        }

        /** @type {PlayerCell} */
        let cell = null;
        for (let i = 0, l = player.ownedCells.length; i < l; i++)
            if (cell === null || player.ownedCells[i].size > cell.size)
                cell = player.ownedCells[i];
        if (cell === null) return; // ???

        if (this.target != null) {
            if (!this.target.exists || !this.canEat(cell.size, this.target.size))
                this.target = null;
            else {
                this.mouseX = this.target.x;
                this.mouseY = this.target.y;
                return;
            }
        }

        const atMaxCells = player.ownedCells.length >= this.listener.settings.playerMaxCells;
        const willingToSplit = player.ownedCells.length <= 2;
        const cellCount = Object.keys(player.visibleCells).length;

        let mouseX = 0;
        let mouseY = 0;
        let bestPrey = null;
        let splitkillObstacleNearby = false;

        for (let id in player.visibleCells) {
            const check = player.visibleCells[id];
            const truncatedInfluence = Math.log10(cell.squareSize);
            let dx = check.x - cell.x;
            let dy = check.y - cell.y;
            let dSplit = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            let d = Math.max(1, dSplit - cell.size - check.size);
            let influence = 0;
            switch (check.type) {
                case 0:
                    if (player.id === check.owner.id) break;
                    if (player.team !== null && player.team === check.owner.team) break;
                    if (this.canEat(cell.size, check.size)) {
                        influence = truncatedInfluence;
                        if (!this.canSplitkill(cell.size, check.size, dSplit)) break;
                        if (bestPrey === null || check.size > bestPrey.size)
                            bestPrey = check;
                    } else {
                        influence = this.canEat(check.size, cell.size) ? -truncatedInfluence * cellCount : -1;
                        splitkillObstacleNearby = true;
                    }
                    break;
                case 1:
                    influence = 1;
                    break;
                case 2:
                    if (atMaxCells) influence = truncatedInfluence;
                    else if (this.canEat(cell.size, check.size)) {
                        influence = -1 * cellCount;
                        if (this.canSplitkill(cell.size, check.size, dSplit))
                            splitkillObstacleNearby = true;
                    }
                    break;
                case 3:
                    if (this.canEat(cell.size, check.size)) influence = truncatedInfluence * cellCount;
                    break;
                case 4:
                    if (this.canEat(check.size, cell.size)) influence = -1;
                    else if (this.canEat(cell.size, check.size)) {
                        if (atMaxCells) influence = truncatedInfluence * cellCount;
                        else influence = -1;
                    }
                    break;
            }

            if (influence === 0) continue;
            if (d === 0) d = 1;
            dx /= d;
            dy /= d;
            mouseX += dx * influence / d;
            mouseY += dy * influence / d;
        }

        if (
            willingToSplit && !splitkillObstacleNearby && this.splitCooldownTicks <= 0 &&
            bestPrey !== null && bestPrey.size * 2 > cell.size
        ) {
            this.target = bestPrey;
            this.mouseX = bestPrey.x;
            this.mouseY = bestPrey.y;
            this.splitAttempts++;
            this.splitCooldownTicks = 25;
        } else {
            const d = Math.max(1, Math.sqrt(mouseX * mouseX + mouseY * mouseY));
            this.mouseX = cell.x + mouseX / d * player.viewArea.w;
            this.mouseY = cell.y + mouseY / d * player.viewArea.h;
        }
    }

    /**
     * @param {Number} aSize
     * @param {Number} bSize
     */
    canEat(aSize, bSize) {
        return aSize > bSize * 1.140175425099138;
    }

    /**
     * @param {Number} a
     * @param {Number} b
     * @param {Number} d
     */
    canSplitkill(aSize, bSize, d) {
        const splitD = Math.max(2 * aSize, this.listener.settings.playerSplitBoost);
        return aSize / 1.4142135623730951 > bSize * 1.140175425099138 && d - splitD <= aSize - bSize / 3;
    }
}

module.exports = PlayerBot;

const World = require("../worlds/World");
const Cell = require("../cells/Cell");
const PlayerCell = require("../cells/PlayerCell");