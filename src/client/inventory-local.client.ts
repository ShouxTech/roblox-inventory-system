import { GuiService, Players, ReplicatedStorage, RunService, StarterGui, TweenService, UserInputService } from '@rbxts/services';

interface ToolData {
    tool: Tool;
    button: TextButton;
};

const UNEQUIPPED_COLOR = Color3.fromRGB(60, 60, 60);
const EQUIPPED_COLOR = Color3.fromRGB(115, 115, 115);
const FULL_MAIN_FRAME_SIZE = new UDim2(0, 655, 0, 70);
const OPENED_EXTRA_FRAME_SIZE = new UDim2(0, 655, 0, 225);
const CLOSED_EXTRA_FRAME_SIZE = new UDim2(0, 655, 0, 0);
const TWEEN_INFO = new TweenInfo(0.23);
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
const uiScaleInstance = inventoryGUI.WaitForChild('UIScale') as UIScale;
const mainFrame = inventoryGUI.WaitForChild('MainFrame') as Frame;
const extraFrame = inventoryGUI.WaitForChild('ExtraFrame') as Frame;
const extraScrollingFrame = extraFrame.WaitForChild('ScrollingFrame') as ScrollingFrame;

const components = inventoryGUI.WaitForChild('Components') as Configuration;
const toolBtnPrefab = components.WaitForChild('ToolBtn') as TextButton;

const mainFrameFullTween = TweenService.Create(mainFrame, TWEEN_INFO, {Size: FULL_MAIN_FRAME_SIZE});

const extraFrameOpenTween = TweenService.Create(extraFrame, TWEEN_INFO, {Size: OPENED_EXTRA_FRAME_SIZE});
const extraFrameCloseTween = TweenService.Create(extraFrame, TWEEN_INFO, {Size: CLOSED_EXTRA_FRAME_SIZE});

const setInventoryEnabled = ReplicatedStorage.WaitForChild('SetInventoryEnabled') as BindableEvent;

let enabled = true;

let uiScale = 1;

let isExtraFrameOpen = false;

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

function updateMainAndExtraFrame() {
    if (isExtraFrameOpen) {
        if (mainFrame.Size !== FULL_MAIN_FRAME_SIZE) {
            mainFrame.Visible = true;
            mainFrameFullTween.Play();
        }
        if (extraFrame.Size !== OPENED_EXTRA_FRAME_SIZE) {
            extraFrame.Visible = true;
            extraFrameOpenTween.Play();
        }
    } else {
        const amountOfTools = tools.size();
        if (amountOfTools === 0) {
            coroutine.wrap(() => {
                const tween = TweenService.Create(mainFrame, TWEEN_INFO, {Size: UDim2.fromOffset(0, 70)});
                tween.Play();
                tween.Completed.Wait();
                mainFrame.Visible = false;
            })();
        } else {
            mainFrame.Visible = true;
            TweenService.Create(mainFrame, TWEEN_INFO, {Size: UDim2.fromOffset((amountOfTools * 65) + 5, 70)}).Play();
        }
        if (extraFrame.Size !== CLOSED_EXTRA_FRAME_SIZE) {
            extraFrameCloseTween.Play();
            extraFrameCloseTween.Completed.Wait();
            extraFrame.Visible = false;
        }
    }
}

function onInput(input: InputObject, gameProcessedEvent: boolean) {
    if (gameProcessedEvent) return;
    if (!enabled) return;

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
        isExtraFrameOpen = !extraFrame.Visible;
        updateMainAndExtraFrame();
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

function updateExtraToolBtns(startIndex: number) {
    for (let i = startIndex; i < extraTools.size(); i++) {
        const btn = extraTools[i].button;
        const newPosition = i + 1;
        btn.LayoutOrder = newPosition;
    }
}

function updateExtraScrollingFrame() {
    extraScrollingFrame.CanvasSize = UDim2.fromOffset(0, (math.floor(extraTools.size() / 10) + 1) * 65);
}

function updateScale() {
    uiScale = uiScaleInstance.Scale;
}

function moveToolBtn(toolBtn: TextButton, objectUnderMouse: ScrollingFrame | TextButton | Frame) {
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
            updateExtraToolBtns(math.min(toolArrayIndex, targetToolArrayIndex));
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
            updateExtraToolBtns(math.min(toolArrayIndex));
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

function startBtnDragging(toolBtn: TextButton) {
    let finalPosition: Vector2 = new Vector2();
    const toolBtnClone = toolBtn.Clone();
    toolBtnClone.Parent = inventoryGUI;

    while (UserInputService.IsMouseButtonPressed(Enum.UserInputType.MouseButton1)) {
        let mouseLocation = UserInputService.GetMouseLocation();
        mouseLocation = new Vector2(mouseLocation.X / uiScale, (mouseLocation.Y / uiScale) - GUI_INSET_Y);
        finalPosition = mouseLocation;
        toolBtnClone.Position = UDim2.fromOffset(mouseLocation.X, mouseLocation.Y);
        heartbeat.Wait();
    }

    toolBtnClone.Destroy();

    const objectUnderMouse = getObjectUnderMouse(finalPosition);
    if ((!objectUnderMouse) || (objectUnderMouse === toolBtn)) return;

    moveToolBtn(toolBtn, objectUnderMouse);
}

function toolAdded(tool: Tool) {
    const isInventoryFull = (tools.size() === MAX_TOOLS);
    const toolArrayIndex = tools.size() + 1;

    let lastClickedTime = os.time();
    let heldTag = os.time();

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
        const thisTag = os.time();
        heldTag = thisTag;
        if (!isToolEquipped(tool)) {
            humanoid.EquipTool(tool);
        } else {
            humanoid.UnequipTools();
        }
        if (thisTag - lastClickedTime < 0.2) {
            if (toolBtn.Parent === extraScrollingFrame) {
                moveToolBtn(toolBtn, mainFrame);
            }
        }
        lastClickedTime = thisTag;
        wait(0.06);
        if (heldTag === thisTag) {
            startBtnDragging(toolBtn);
        }
    });

    toolBtn.MouseButton1Up.Connect(() => {
        heldTag = 0;
    });

    (isInventoryFull ? extraTools : tools).push({
        tool: tool,
        button: toolBtn
    });

    updateMainAndExtraFrame();
}

function toolEquipped(tool: Tool) {
    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(tool);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];
    equippedTool = toolData.tool;
    TweenService.Create(toolData.button, TWEEN_INFO, {BackgroundColor3: EQUIPPED_COLOR}).Play();
}

function toolUnequipped(tool: Tool) {
    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(tool);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];
    equippedTool = undefined;
    TweenService.Create(toolData.button, TWEEN_INFO, {BackgroundColor3: UNEQUIPPED_COLOR}).Play();
}

function toolRemoved(tool: Tool) {
    const [searchedArray, toolArrayIndex] = getToolDataFromInstance(tool);
    if ((toolArrayIndex === -1)) return;
    const toolData = searchedArray[toolArrayIndex];

    if (equippedTool === tool) {
        toolUnequipped(tool);
    }

    searchedArray.remove(toolArrayIndex);
    toolData.button.Destroy();

    if (searchedArray === tools) {
        updateToolBtns(toolArrayIndex);
    } else if (searchedArray === extraTools) {
        updateExtraToolBtns(toolArrayIndex);
    }

    updateExtraScrollingFrame();
    updateMainAndExtraFrame();
}

function characterAdded(char_?: Model) {
    if (!char_) return;

    tools.clear();
    extraTools.clear();

    for (const toolBtn of mainFrame.GetChildren()) {
        if (toolBtn.IsA('TextButton')) {
            toolBtn.Destroy();
        }
    }

    for (const toolBtn of extraScrollingFrame.GetChildren()) {
        if (toolBtn.IsA('TextButton')) {
            toolBtn.Destroy();
        }
    }

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
            if (toolArrayIndex === -1) {
                toolAdded(child);
            }
            toolEquipped(child);
        }
    });

    char.ChildRemoved.Connect((child) => {
        if (child.IsA('Tool')) {
            if (child.Parent === backpack) return;
            toolRemoved(child);
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

updateScale();
uiScaleInstance.GetPropertyChangedSignal('Scale').Connect(updateScale);

setInventoryEnabled.Event.Connect((isEnabled) => {
    enabled = isEnabled;
    inventoryGUI.Enabled = isEnabled;
});

UserInputService.InputBegan.Connect(onInput);

StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false);
