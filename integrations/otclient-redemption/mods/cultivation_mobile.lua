-- Optional OTClient Redemption mod. It only sends normal movement/attack inputs and
-- server talk-action commands; cultivation state and combat outcomes remain server-owned.
CultivationMobile = {}
CultivationMobile.panel = nil

local function mobilePlatform()
    local name = string.lower(g_platform.getOSName() or "")
    return string.find(name, "android", 1, true) ~= nil or string.find(name, "ios", 1, true) ~= nil
end

local function createPanel()
    if CultivationMobile.panel or not g_game.isOnline() or not mobilePlatform() then
        return
    end
    CultivationMobile.panel = g_ui.displayUI("cultivation_mobile.otui")
    if CultivationMobile.panel then
        CultivationMobile.panel:raise()
    end
end

local function destroyPanel()
    if CultivationMobile.panel then
        CultivationMobile.panel:destroy()
        CultivationMobile.panel = nil
    end
end

function CultivationMobile.move(direction)
    if g_game.isOnline() then
        g_game.walk(direction)
    end
end

function CultivationMobile.attackNearestMonster()
    if not g_game.isOnline() then return end
    local player = g_game.getLocalPlayer()
    if not player then return end

    local origin = player:getPosition()
    local spectators = g_map.getSpectators(origin, false)
    local nearest = nil
    local nearestDistance = 999
    for _, creature in ipairs(spectators) do
        if creature:isMonster() then
            local distance = origin:getDistance(creature:getPosition())
            if distance < nearestDistance then
                nearest = creature
                nearestDistance = distance
            end
        end
    end

    if nearest then
        g_game.attack(nearest)
    else
        displayInfoBox(tr("Cultivation Mobile"), tr("No visible monster to target."))
    end
end

function CultivationMobile.say(command)
    if g_game.isOnline() then
        g_game.talk(command)
    end
end

function init()
    connect(g_game, {
        onGameStart = createPanel,
        onGameEnd = destroyPanel
    })
    createPanel()
end

function terminate()
    disconnect(g_game, {
        onGameStart = createPanel,
        onGameEnd = destroyPanel
    })
    destroyPanel()
end
