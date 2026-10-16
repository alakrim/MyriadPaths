-- Cultivation Tibia Mobile: server-authoritative prototype rules for The Forgotten Server 1.6.
-- Install as: data/scripts/cultivation_system.lua
-- No Tibia item IDs, client sprites, or map-specific item IDs are required by this script.
-- All progress is stored server-side using player storage values.

local Cultivation = {
    storage = {
        root = 68100,
        qi = 68101,
        realm = 68102,
        spiritStones = 68103,
        sect = 68104,
        questState = 68105,
        questKills = 68106,
        lastMeditate = 68107,
        lastBreakthroughFailure = 68108,
    },
    roots = {
        wood = { id = 1, name = "Wood Spirit Root", qi = 14, breakthrough = 5, bolt = 0, heal = 0 },
        flame = { id = 2, name = "Flame Spirit Root", qi = 8, breakthrough = -4, bolt = 8, heal = 0 },
        water = { id = 3, name = "Water Spirit Root", qi = 11, breakthrough = 3, bolt = 0, heal = 12 },
    },
    sects = {
        jade = { id = 1, name = "Jade Meridian Hall", qi = 2, breakthrough = 4, bolt = 0, heal = 0 },
        ember = { id = 2, name = "Ember Crane Lodge", qi = 0, breakthrough = -2, bolt = 6, heal = 0 },
        stillwater = { id = 3, name = "Stillwater Pavilion", qi = 1, breakthrough = 2, bolt = 0, heal = 8 },
    },
    realms = {
        "Qi Condensation",
        "Foundation Establishment",
        "Core Formation",
        "Nascent Soul",
        "Spirit Transformation",
    },
    questRequiredKills = 5,
}

local function getValue(player, key)
    local value = player:getStorageValue(Cultivation.storage[key])
    if value < 0 then
        return 0
    end
    return value
end

local function setValue(player, key, value)
    player:setStorageValue(Cultivation.storage[key], math.max(0, math.floor(value)))
end

local function send(player, message)
    player:sendTextMessage(MESSAGE_STATUS_CONSOLE_BLUE, "[Cultivation] " .. message)
end

local function rootFor(player)
    local rootId = getValue(player, "root")
    for _, root in pairs(Cultivation.roots) do
        if root.id == rootId then
            return root
        end
    end
    return nil
end

local function sectFor(player)
    local sectId = getValue(player, "sect")
    for _, sect in pairs(Cultivation.sects) do
        if sect.id == sectId then
            return sect
        end
    end
    return nil
end

local function qiCapacity(player)
    return 100 + getValue(player, "realm") * 20
end

local function qiFor(player)
    return math.min(getValue(player, "qi"), qiCapacity(player))
end

local function realmName(player)
    local realm = getValue(player, "realm")
    return Cultivation.realms[realm + 1] or ("Ascendant Realm " .. tostring(realm + 1))
end

local function chooseRoot(player, words, param)
    if rootFor(player) then
        send(player, "Your spiritual root is already awakened as " .. rootFor(player).name .. ". It cannot be rerolled.")
        return false
    end

    local requested = string.lower((param or ""):match("^%s*(.-)%s*$"))
    local root = Cultivation.roots[requested]
    if not root then
        send(player, "Choose once with !root wood, !root flame, or !root water.")
        return false
    end

    setValue(player, "root", root.id)
    setValue(player, "qi", 20)
    setValue(player, "realm", 0)
    setValue(player, "spiritStones", 5)
    player:getPosition():sendMagicEffect(CONST_ME_MAGIC_BLUE)
    send(player, "Your " .. root.name .. " awakens. You begin with 20 qi and 5 spirit stones.")
    return false
end

local function meditate(player, words, param)
    local root = rootFor(player)
    if not root then
        send(player, "Awaken a spiritual root first: !root wood, !root flame, or !root water.")
        return false
    end

    local now = os.time()
    local remaining = 15 - (now - getValue(player, "lastMeditate"))
    if remaining > 0 then
        send(player, "Your breath has not settled. Meditate again in " .. remaining .. " seconds.")
        return false
    end

    local currentQi = qiFor(player)
    local gain = root.qi
    local sect = sectFor(player)
    if sect then gain = gain + sect.qi end
    local newQi = math.min(qiCapacity(player), currentQi + gain)
    setValue(player, "qi", newQi)
    setValue(player, "lastMeditate", now)
    player:getPosition():sendMagicEffect(CONST_ME_MAGIC_BLUE)
    send(player, "Meditation restores " .. (newQi - currentQi) .. " qi (" .. newQi .. "/" .. qiCapacity(player) .. ").")
    return false
end

local function showRealm(player, words, param)
    local root = rootFor(player)
    local sect = sectFor(player)
    send(player, "Realm: " .. realmName(player) .. " | Qi: " .. qiFor(player) .. "/" .. qiCapacity(player)
        .. " | Spirit stones: " .. getValue(player, "spiritStones"))
    send(player, "Spirit root: " .. (root and root.name or "Unawakened")
        .. " | Sect: " .. (sect and sect.name or "Unaffiliated"))
    return false
end

local function joinSect(player, words, param)
    if not rootFor(player) then
        send(player, "Awaken your spiritual root before joining a sect.")
        return false
    end
    if sectFor(player) then
        send(player, "You already belong to " .. sectFor(player).name .. ". Sect changes are not yet available.")
        return false
    end

    local requested = string.lower((param or ""):match("^%s*(.-)%s*$"))
    local sect = Cultivation.sects[requested]
    if not sect then
        send(player, "Choose one: !sect jade, !sect ember, or !sect stillwater.")
        return false
    end

    setValue(player, "sect", sect.id)
    send(player, "You have joined " .. sect.name .. ". Its bonuses now affect your cultivation.")
    return false
end

local function questCommand(player, words, param)
    local action = string.lower((param or ""):match("^%s*(.-)%s*$"))
    local state = getValue(player, "questState")
    local kills = getValue(player, "questKills")

    if action == "start" then
        if state == 1 then
            send(player, "The Hollow Vein threat is already active: " .. kills .. "/" .. Cultivation.questRequiredKills .. " creatures defeated.")
        elseif state == 2 then
            send(player, "You have already cleared this trial. More quests can be added by the world/NPC layer.")
        else
            setValue(player, "questState", 1)
            setValue(player, "questKills", 0)
            send(player, "Trial accepted: defeat 5 monsters, then use !quest claim for 15 spirit stones.")
        end
    elseif action == "claim" then
        if state ~= 2 then
            send(player, "The trial is not complete yet: " .. kills .. "/" .. Cultivation.questRequiredKills .. ". Use !quest start to begin.")
        else
            setValue(player, "questState", 3)
            setValue(player, "spiritStones", getValue(player, "spiritStones") + 15)
            send(player, "Trial reward claimed: 15 spirit stones. Your progress is stored by the server.")
        end
    else
        local status = ({ [0] = "not started", [1] = "in progress", [2] = "complete, reward unclaimed", [3] = "reward claimed" })[state] or "unknown"
        send(player, "Hollow Vein trial: " .. status .. " | defeated " .. kills .. "/" .. Cultivation.questRequiredKills .. ". Commands: !quest start, !quest claim.")
    end
    return false
end

local function breakthrough(player, words, param)
    local root = rootFor(player)
    if not root then
        send(player, "Awaken a spiritual root before attempting a breakthrough.")
        return false
    end

    local realm = getValue(player, "realm")
    local qiCost = 80 + realm * 35
    local stoneCost = 5 + realm * 3
    local qi = qiFor(player)
    local stones = getValue(player, "spiritStones")

    if realm >= #Cultivation.realms - 1 then
        send(player, "Your current path ends at " .. realmName(player) .. " in this prototype.")
        return false
    end
    if qi < qiCost or stones < stoneCost then
        send(player, "Bottleneck: requires " .. qiCost .. " qi and " .. stoneCost .. " spirit stones. You have " .. qi .. " qi and " .. stones .. " stones.")
        return false
    end

    local failureLock = getValue(player, "lastBreakthroughFailure")
    local remaining = 30 - (os.time() - failureLock)
    if failureLock > 0 and remaining > 0 then
        send(player, "Your meridians are unstable after the last failure. Wait " .. remaining .. " seconds.")
        return false
    end

    local sect = sectFor(player)
    local chance = 70 - realm * 10 + root.breakthrough + (sect and sect.breakthrough or 0)
    chance = math.max(15, math.min(90, chance))
    setValue(player, "qi", qi - qiCost)
    setValue(player, "spiritStones", stones - stoneCost)

    if math.random(1, 100) <= chance then
        setValue(player, "realm", realm + 1)
        setValue(player, "qi", math.min(qiCapacity(player), getValue(player, "qi") + 15))
        player:addHealth(math.max(1, math.floor(player:getMaxHealth() * 0.20)))
        player:getPosition():sendMagicEffect(CONST_ME_HOLYDAMAGE)
        send(player, "BREAKTHROUGH SUCCESS. You reached " .. realmName(player) .. ". New qi capacity: " .. qiCapacity(player) .. ".")
    else
        setValue(player, "qi", math.max(0, getValue(player, "qi") - 20))
        setValue(player, "lastBreakthroughFailure", os.time())
        player:addHealth(-math.max(1, math.floor(player:getMaxHealth() * 0.08)))
        player:getPosition():sendMagicEffect(CONST_ME_POFF)
        send(player, "BREAKTHROUGH FAILED. You lost 20 additional qi and suffered meridian backlash. Try again after recovery.")
    end
    return false
end

local function healTechnique(player, words, param)
    local root = rootFor(player)
    if not root then
        send(player, "Awaken a spiritual root first.")
        return false
    end
    local qiCost = 12
    if qiFor(player) < qiCost then
        send(player, "Insufficient qi. The healing technique costs " .. qiCost .. " qi.")
        return false
    end
    local sect = sectFor(player)
    local amount = 25 + getValue(player, "realm") * 5 + root.heal + (sect and sect.heal or 0)
    setValue(player, "qi", qiFor(player) - qiCost)
    local before = player:getHealth()
    player:addHealth(amount)
    player:getPosition():sendMagicEffect(CONST_ME_MAGIC_BLUE)
    send(player, "You restored " .. math.min(amount, player:getMaxHealth() - before) .. " health for " .. qiCost .. " qi.")
    return false
end

local function spiritBoltFormula(player, level, magicLevel)
    local root = rootFor(player)
    local sect = sectFor(player)
    local realm = getValue(player, "realm")
    local extra = (root and root.bolt or 0) + (sect and sect.bolt or 0)
    local minimum = 20 + realm * 8 + extra
    local maximum = minimum + 12 + realm * 3
    return -minimum, -maximum
end

local spiritBoltCombat = Combat()
spiritBoltCombat:setParameter(COMBAT_PARAM_TYPE, COMBAT_ENERGYDAMAGE)
spiritBoltCombat:setParameter(COMBAT_PARAM_EFFECT, CONST_ME_ENERGYHIT)
spiritBoltCombat:setCallback(CALLBACK_PARAM_LEVELMAGICVALUE, spiritBoltFormula)

local function spiritBolt(player, words, param)
    if not rootFor(player) then
        send(player, "Awaken a spiritual root first.")
        return false
    end
    if qiFor(player) < 8 then
        send(player, "Spirit Bolt costs 8 qi.")
        return false
    end
    local target = player:getTarget()
    if not target or not target:isMonster() then
        send(player, "Select a monster target first, then use !spiritbolt.")
        return false
    end
    if player:getPosition():getDistance(target:getPosition()) > 7 then
        send(player, "Your target is too far away for Spirit Bolt.")
        return false
    end
    setValue(player, "qi", qiFor(player) - 8)
    spiritBoltCombat:execute(player, Variant(target:getId()))
    return false
end

local function showHelp(player, words, param)
    send(player, "!root wood|flame|water | !cultivate | !realm | !breakthrough")
    send(player, "!sect jade|ember|stillwater | !spiritbolt | !heal | !quest start|claim")
    send(player, "Root, qi, realm, sect, quest progress and spirit stones are saved server-side.")
    return false
end

-- Register login and kill hooks. Revscriptsys loads this file from data/scripts.
local loginEvent = CreatureEvent("CultivationLogin")
loginEvent.onLogin = function(player)
    for _, key in pairs({ "root", "qi", "realm", "spiritStones", "sect", "questState", "questKills", "lastMeditate", "lastBreakthroughFailure" }) do
        if player:getStorageValue(Cultivation.storage[key]) < 0 then
            setValue(player, key, 0)
        end
    end
    player:registerEvent("CultivationKill")
    return true
end
loginEvent:register()

local killEvent = CreatureEvent("CultivationKill")
killEvent.onKill = function(player, target)
    if not player or not player:isPlayer() or not target or not target:isMonster() then
        return true
    end

    local root = rootFor(player)
    if root then
        setValue(player, "qi", math.min(qiCapacity(player), qiFor(player) + 2))
        setValue(player, "spiritStones", getValue(player, "spiritStones") + 1)
    end

    if getValue(player, "questState") == 1 then
        local kills = getValue(player, "questKills") + 1
        setValue(player, "questKills", kills)
        if kills >= Cultivation.questRequiredKills then
            setValue(player, "questState", 2)
            send(player, "Trial complete. Use !quest claim to receive 15 spirit stones.")
        else
            send(player, "Hollow Vein trial progress: " .. kills .. "/" .. Cultivation.questRequiredKills .. ".")
        end
    end
    return true
end
killEvent:register()

local function registerTalkAction(words, callback)
    local action = TalkAction(words)
    action.onSay = callback
    action:separator(" ")
    action:register()
end

registerTalkAction("!root", chooseRoot)
registerTalkAction("!cultivate", meditate)
registerTalkAction("!realm", showRealm)
registerTalkAction("!qi", showRealm)
registerTalkAction("!sect", joinSect)
registerTalkAction("!quest", questCommand)
registerTalkAction("!breakthrough", breakthrough)
registerTalkAction("!heal", healTechnique)
registerTalkAction("!spiritbolt", spiritBolt)
registerTalkAction("!culthelp", showHelp)
