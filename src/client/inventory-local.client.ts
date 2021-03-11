import { GuiService, Players, RunService, StarterGui, UserInputService } from '@rbxts/services';

interface ToolData {
    tool: Tool;
    button: TextButton;
}

const UNEQUIPPED_COLOR = Color3.fromRGB(60, 60, 60);
const EQUIPPED_COLOR = Color3.fromRGB(115, 115, 115);
const MAX_TOOLS = 10;

const localPlayer = Players.LocalPlayer;
const playerGUI = localPlayer.WaitForChild('PlayerGui') as PlayerGui;

const heartbeat = RunService.Heartbeat;

let backpack: Backpack;

let char: Model;
let humanoid: Humanoid;

const [topGUIInset] = GuiService.GetGuiInset();
const GUI_INSET_Y = topGUIInset.Y;

const inventoryGUI = playerGUI.WaitForChild('InventoryGUI') as ScreenGui;
const mainFrame = inventoryGUI.WaitForChild('MainFrame') as Frame;
const extraFrame = inventoryGUI.WaitForChild('ExtraFrame') as Frame;
const extraScrollingFrame = extraFrame.WaitForChild('ScrollingFrame') as ScrollingFrame;

const components = inventoryGUI.WaitForChild('Components') as Configuration;
const toolBtnPrefab = components.WaitForChild('ToolBtn') as TextButton;

const tools: ToolData[] = [];
const extraTools: ToolData[] = [];

let equippedTool: Tool | undefined;

const numberKeys = new Map<string, number>([
    ['One', 1],
    ['Two', 2],
    ['Three', 3],
    ['Four', 4],
    ['Five', 5],
    ['Six', 6],
    ['Seven', 7],
    ['Eight', 8],
    ['Nine', 9],
    ['Zero', 10]
]);

function isToolEquipped(tool: Tool) {
    return tool.Parent === char;
}

function getToolDataFromInstance(instance: Tool | TextButton): [ToolData[], number] {
    const searchIndex = instance.IsA('Tool') ? 'tool' : 'button';
    let searchedArray = tools;
    let toolArrayIndex = searchedArray.findIndex((toolData) => toolData[searchIndex] === instance);
    if (toolArrayIndex === -1) {
        searchedArray = extraTools;
        toolArrayIndex = searchedArray.findIndex((toolData) => toolData[searchIndex] === instance);
    };
    return [searchedArray, toolArrayIndex];
}

function getPositionForPositionLabel(position: number): string {
    return tostring((position === 10) ? 0 : position);
}

function onInput(input: InputObject, gameProcessedEvent: boolean) {
    if (gameProcessedEvent) return;

    const toolArrayIndex = numberKeys.get(input.KeyCode.Name);

    if (toolArrayIndex) {
        const tool = tools[toolArrayIndex - 1]?.tool;
        if (!tool) return;
        if (!isToolEquipped(tool)) {
            humanoid.EquipTool(tool);
        } else {
            humanoid.UnequipTools();
        }
    } else if (input.KeyCode === Enum.KeyCode.Backquote) {
        extraFrame.Visible = !extraFrame.Visible;
    }
}

function isMouseInBounds(mousePosition: Vector2, target: TextButton | Frame | ScrollingFrame): boolean {
    for (const object of playerGUI.GetGuiObjectsAtPosition(mousePosition.X, mousePosition.Y)) {
        if (object === target) {
            return true;
        }
    }

    return false;
}

function getObjectUnderMouse(mousePosition: Vector2): TextButton | Frame | ScrollingFrame | undefined {
    for (const child of mainFrame.GetChildren()) {
        if (!child.IsA('TextButton')) continue;
        if (isMouseInBounds(mousePosition, child)) {
            return child;
        }
    }

    for (const child of extraScrollingFrame.GetChildren()) {
        if (!child.IsA('TextButton')) continue;
        if (isMouseInBounds(mousePosition, child)) {
            return child;
        }
    }

    if (isMouseInBounds(mousePosition, mainFrame)) {
        return mainFrame;
    }

    if (extraFrame.Visible && isMouseInBounds(mousePosition, extraFrame)) {
        return extraScrollingFrame;
    }
}

function updateToolBtns(startIndex: number) {
    for (let i = startIndex; i < tools.size(); i++) {
        const btn = tools[i].button;
        const positionLabel = (btn.FindFirstChild('PositionLabel') as TextLabel);
        const newPosition = i + 1;
        btn.LayoutOrder = newPosition;
        positionLabel.Text = getPositionForPositionLabel(newPosition);
    }
}

function updateExtraScrollingFrame() {
    extraScrollingFrame.CanvasSize = UDim2.fromOffset(0, (math.floor(extraTools.size() / 10) + 1) * 65);
}

function startBtnDragging(toolBtn: TextButton) {
    let finalPosition: Vector2 = new Vector2();
    const toolBtnClone = toolBtn.Clone();
    toolBtnClone.Parent = inventoryGUI;

    while (UserInputService.IsMouseButtonPressed(Enum.UserInputType.MouseButton1)) {
        let mouseLocation = UserInputService.GetMouseLocation();
        mouseLocation = new Vector2(mouseLocation.X, mouseLocation.Y - GUI_INSET_Y);
        finalPosition = mouseLocation;
        toolBtnClone.Position = UDim2.fromOffset(mouseLocation.X, mouseLocation.Y);
        heartbeat.Wait();
    }

    toolBtnClone.Destroy();

    const objectUnderMouse = getObjectUnderMouse(finalPosition);
    if ((!objectUnderMouse) || (objectUnderMouse === toolBtn)) return;

    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(toolBtn);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];

    if (objectUnderMouse.IsA('TextButton')) {
        const toolBtnParent = toolBtn.Parent;
        const [targetSearchedArray, targetToolArrayIndex] = getToolDataFromInstance(objectUnderMouse);
        if ((targetToolArrayIndex === -1)) return;
        const targetToolData = targetSearchedArray[targetToolArrayIndex];

        searchedArray[toolArrayIndex] = targetToolData;
        targetSearchedArray[targetToolArrayIndex] = toolData;

        const toolBtnLayoutOrder = toolBtn.LayoutOrder;
        toolBtn.LayoutOrder = objectUnderMouse.LayoutOrder;
        objectUnderMouse.LayoutOrder = toolBtnLayoutOrder;

        toolBtn.Parent = objectUnderMouse.Parent;
        objectUnderMouse.Parent = toolBtnParent;

        if (toolBtn.Parent === extraScrollingFrame) {
            (toolBtn.FindFirstChild('PositionLabel') as TextLabel).Text = '';
        }
        if (objectUnderMouse.Parent === extraScrollingFrame) {
            (objectUnderMouse.FindFirstChild('PositionLabel') as TextLabel).Text = '';
        }

        if ((searchedArray === tools) || (targetSearchedArray === tools)) {
            updateToolBtns(math.min(toolArrayIndex, targetToolArrayIndex));
        }
        if ((searchedArray === extraTools) || (targetSearchedArray === extraTools)) {
            updateExtraScrollingFrame();
        }
    } else if (objectUnderMouse === mainFrame) {
        if (tools.size() === MAX_TOOLS) return;

        searchedArray.remove(toolArrayIndex);
        const newArrayIndex = tools.push(toolData);

        toolBtn.LayoutOrder = newArrayIndex;
        toolBtn.Parent = objectUnderMouse;

        if (searchedArray === tools) {
            updateToolBtns(toolArrayIndex);
        } else {
            (toolBtn.FindFirstChild('PositionLabel') as TextLabel).Text = getPositionForPositionLabel(newArrayIndex);
            updateExtraScrollingFrame();
        }
    } else if (objectUnderMouse === extraScrollingFrame) {
        searchedArray.remove(toolArrayIndex);
        const newArrayIndex = extraTools.push(toolData);

        (toolBtn.FindFirstChild('PositionLabel') as TextLabel).Text = '';

        toolBtn.LayoutOrder = newArrayIndex;
        toolBtn.Parent = objectUnderMouse;

        updateToolBtns(toolArrayIndex);
        updateExtraScrollingFrame();
    }
}

function toolAdded(tool: Tool) {
    const isInventoryFull = (tools.size() === MAX_TOOLS);
    const toolArrayIndex = tools.size() + 1;

    const toolBtn = toolBtnPrefab.Clone();
    const positionLabel = toolBtn.FindFirstChild('PositionLabel') as TextLabel;
    const nameLabel = toolBtn.FindFirstChild('NameLabel') as TextLabel;
    toolBtn.LayoutOrder = isInventoryFull ? extraTools.size() + 1 : toolArrayIndex;
    positionLabel.Text = tostring(isInventoryFull ? '' : getPositionForPositionLabel(toolArrayIndex));
    nameLabel.Text = tool.Name;
    toolBtn.Parent = isInventoryFull ? extraScrollingFrame : mainFrame;
    if (isInventoryFull) {
        updateExtraScrollingFrame();
    }

    toolBtn.MouseButton1Down.Connect(() => {
        if (!isToolEquipped(tool)) {
            humanoid.EquipTool(tool);
        } else {
            humanoid.UnequipTools();
        }
        startBtnDragging(toolBtn);
    });

    (isInventoryFull ? extraTools : tools).push({
        tool: tool,
        button: toolBtn
    });
}

function toolEquipped(tool: Tool) {
    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(tool);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];
    equippedTool = toolData.tool;
    toolData.button.BackgroundColor3 = EQUIPPED_COLOR;
}

function toolUnequipped(tool: Tool) {
    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(tool);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];
    equippedTool = undefined;
    toolData.button.BackgroundColor3 = UNEQUIPPED_COLOR;
}

function toolRemoved(tool: Tool) {
    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(tool);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];
    searchedArray.remove(toolArrayIndex);
    toolData.button.Destroy();
}

function characterAdded(char_?: Model) {
    if (!char_) return;
    char = char_;
    backpack = localPlayer.WaitForChild('Backpack') as Backpack;
    humanoid = char.WaitForChild('Humanoid') as Humanoid;

    for (const child of backpack.GetChildren()) {
        if (child.IsA('Tool')) {
            toolAdded(child);
        }
    }

    char.ChildAdded.Connect((child) => {
        if (child.IsA('Tool')) {
            const [_, toolArrayIndex] = getToolDataFromInstance(child);
            if ((toolArrayIndex === -1)) toolAdded(child);
            toolEquipped(child);
        }
    });

    backpack.ChildAdded.Connect((child) => {
        if (child.IsA('Tool')) {
            if (equippedTool === child) {
                toolUnequipped(child);
            } else {
                toolAdded(child);
            }
        }
    });

    backpack.ChildRemoved.Connect((child) => {
        if (child.IsA('Tool')) {
            if (!isToolEquipped(child)) {
                toolRemoved(child);
            }
        }
    });
}

characterAdded(localPlayer.Character);
localPlayer.CharacterAdded.Connect(characterAdded);
UserInputService.InputBegan.Connect(onInput);

StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false);