#Requires AutoHotkey v2.0

CoordMode "mouse", "screen" 					;tells ahk that any mouse positions will be treated as relative to screen and not the active window
												;If you want the mouse to be relative to the window delete this line or change screen to window
CoordMode "Pixel", "screen" 

Running := 0
BlockInp := 0

x := 0
y := 0

Qx := 0
Qy := 0

PrayerMode := 0
PrayerModeStr := "Qck Prot"
Change := 0

ItemMode := 0
ItemModeStr := "None"

ExtraMode := 0
ExtraModeStr := "None"

PrayerTick := 4
PowerActive := 0
PrayerOffColor := 0xf4fef9

Cycle := -1

PT2Wait := 0
Step := -1

MyGui0 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui0.Add("Picture", "x1 y1 w1 h-1", "centerdotb.png")
MyGui0.Show()
MyGui0.Move(771, 625, 3, 3)

MyGui1 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui1.Add("Picture", "x1 y1 w1 h-1", "centerdotb.png")
MyGui1.Show()
MyGui1.Move(1992, 1387, 3, 3)
							
MyGui2 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui2.Show()
GuiCtrl2 := MyGui2.Add("Text", ,"Prayer Tick Amt :: " String(PrayerTick))
MyGui2.Move(769, 570, 120, 25)
							
MyGui3 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui3.Show()
GuiCtrl3 := MyGui3.Add("Text", "W130", "Mode :: " PrayerModeStr)
MyGui3.Move(899, 570, 130, 25)
							
MyGui7 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui7.Show()
GuiCtrl7 := MyGui7.Add("Text", "W130", "Items :: " ItemModeStr)
MyGui7.Move(1039, 570, 130, 25)

MyGui5 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui5.Show()
MyBtn5 := MyGui5.Add("Button", "x2 y2 w116 h21", "STOP")
MyBtn5.OnEvent("Click", MyBtn5_Click)
MyGui5.Move(769, 535, 120, 25)
							
MyGui6 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui6.Show()
GuiCtrl6 := MyGui6.Add("Text", ,"Running :: " Running)
MyGui6.Move(899, 535, 130, 25)
							
MyGui8 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui8.Show()
MyBtn8 := MyGui8.Add("Button", "x2 y2 w116 h21", "Extra:" ExtraModeStr)
MyBtn8.OnEvent("Click", MyBtn8_Click)
MyGui8.Move(769, 500, 120, 25)

MyBtn5_Click(*) 
{
	global Running
	global PrayerMode
	global PrayerTick
	global BlockInp
	global PT2Wait
	global Cycle
	
	Running := 0
	Cycle := -1
	
	GuiCtrl6.Text := "Running :: " Running
	MyGui6.Show()
	
	SetTimer Starter, 0
	SetTimer PT1, 0
	SetTimer PT2, 0
	
	PT2Wait := 0
	
	SetTimer PrayerCheck, -200
}
MyBtn8_Click(*)
{
	global Running
	global PrayerMode
	global ExtraMode
	global ExtraModeStr
	
	if (PrayerMode == -1) {
		ExtraMode := Mod(ExtraMode + 1, 2)
		
		if (ExtraMode == 1) {
			ExtraModeStr := "Ending Off"
			MyBtn8.Text := "Extra :: " ExtraModeStr
			MyGui8.Show()
		} else {
			ExtraModeStr := "None"
			MyBtn8.Text := "Extra :: " ExtraModeStr
			MyGui8.Show()
		}
	}
}
PrayerCheck()
{
	global Running
	
	SetTimer , 0
	
	Running := 0
	PrayerOffCheck()
}
PrayerOffCheck() 
{
	global Running
	global BlockInp
	global Step
	
	; Magic, Missiles, Melee, Magic, Missiles, Melee
	PosX := [1853, 1889, 1925, 1926, 1889, 1852]
	PosY := [1220, 1220, 1220, 1297, 1293, 1293]
	
	if (PrayerMode == 0 && (Step == 1 || Step == -1)) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove 1816, 727
		Sleep 40
		MouseClick "Left", 1816, 727, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1816, 727, 1, 0, "U"
		Sleep 15
		MouseMove x, y
	} else if (PrayerMode == 1 && Step == 0) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove 1816, 727
		Sleep 40
		MouseClick "Left", 1816, 727, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1816, 727, 1, 0, "U"
		Sleep 15
		MouseMove x, y
	} else if (PrayerMode >= 2 && PrayerMode <= 4 && (Step == 2 || Step == 4)) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove PosX[PrayerMode - 1], PosY[PrayerMode - 1]
		Sleep 30
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "D"
		Sleep 50
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "U"
		Sleep 10
		MouseMove 1678, 1368
		Sleep 30
		MouseClick "Left", 1678, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1678, 1368, 1, 0, "U"
		Sleep 15
		MouseMove x, y
	} else if (PrayerMode >= 2 && PrayerMode <= 4 && (Step == -1 || Step == 5)) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove 1745, 1368
		Sleep 30
		MouseClick "Left", 1745, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1745, 1368, 1, 0, "U"
		Sleep 10
		MouseMove PosX[PrayerMode - 1], PosY[PrayerMode - 1]
		Sleep 30
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "D"
		Sleep 50
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "U"
		Sleep 10
		MouseMove 1678, 1368
		Sleep 30
		MouseClick "Left", 1678, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1678, 1368, 1, 0, "U"
		Sleep 15
		MouseMove x, y
	} else if (PrayerMode >= 5 && (Step == 2 || Step == 4)) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove 1678, 1368
		Sleep 30
		MouseClick "Left", 1678, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1678, 1368, 1, 0, "U"
		Sleep 15
		MouseMove x, y 
	} else if (PrayerMode >= 5 && Step == 3) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove PosX[PrayerMode - 1], PosY[PrayerMode - 1]
		Sleep 30
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "D"
		Sleep 50
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "U"
		Sleep 10
		MouseMove 1678, 1368
		Sleep 30
		MouseClick "Left", 1678, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1678, 1368, 1, 0, "U"
		Sleep 15
		MouseMove x, y
	}
	Step := -1
	BlockInp := 0
	BlockInput "MouseMoveOff"
}
ConstantCheck()
{
	global BlockInp
	if (Running == 1) 
		return
		
	BlockInp := 0
	BlockInput "MouseMoveOff"
}
SetTimer ConstantCheck, 1000

Unchange()
{
	global Change
	Change := 0
}

NumpadDot::
{
	global Running
	global ItemMode
	global ItemModeStr
	
	MouseClick "Left", 1795, 1083
	
	ItemMode := Mod(ItemMode + 1, 2)
	
	if (ItemMode == 0)
		ItemModeStr := "None"
	else if (ItemMode == 1)
		ItemModeStr := "NMZ"
	
	GuiCtrl7.Text := "Items :: " ItemModeStr
}
Numpad0::
{
	global Running
	global PrayerTick
	global MyGui2
	global GuiCtrl
	
	if (Running == 1) {
		return
	}
	MouseClick "Left", 1795, 1083
	
	PrayerTick := PrayerTick + 1
	if (PrayerTick > 7)
		PrayerTick := 3
		
	GuiCtrl2.Text := "Prayer Tick Amt :: " String(PrayerTick)
	MyGui2.Show()
}
Numpad1::
{
	global Change
	
	if (Change > 0)
		return
	Change := 1
	Sleep 30
	
	if (PrayerMode == -1 && Running == 1)
		return
	
	MouseGetPos &Qx, &Qy
	Sleep 15
	if (!ImageSearch(&Px, &Py, 1722, 1344, 1722+44, 1344+46, "*Trans0x00FF00 PrayerTicking-Tab.png")) {
		MouseMove 1744, 1368
		Sleep 15
		MouseClick "Left", 1744, 1368, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1744, 1368, 1, 0, "U"
		Sleep 30
	}
	MouseMove 1854, 1219
	Sleep 15
	MouseClick "Left", 1854, 1219, 1, 0, "D"
	Sleep 30
	MouseClick "Left", 1854, 1219, 1, 0, "U"
	Sleep 30
	
	MouseMove 1677, 1368
	Sleep 15
	MouseClick "Left", 1677, 1368, 1, 0, "D"
	Sleep 30
	MouseClick "Left", 1677, 1368, 1, 0, "U"
	
	Sleep 15
	MouseMove Qx, Qy
	CurrPray := 0
	SetTimer Unchange, -10
}
Numpad2::
{
	global Change
	
	if (Change > 0)
		return
	Change := 2
	Sleep 30
	
	if (PrayerMode == -1 && Running == 1)
		return
	
	MouseGetPos &Qx, &Qy
	Sleep 15
	if (!ImageSearch(&Px, &Py, 1722, 1344, 1722+44, 1344+46, "*Trans0x00FF00 PrayerTicking-Tab.png")) {
		MouseMove 1744, 1368
		Sleep 15
		MouseClick "Left", 1744, 1368, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1744, 1368, 1, 0, "U"
		Sleep 30
	}
	MouseMove 1891, 1219
	Sleep 15
	MouseClick "Left", 1891, 1219, 1, 0, "D"
	Sleep 30
	MouseClick "Left", 1891, 1219, 1, 0, "U"
	Sleep 30
	
	MouseMove 1677, 1368
	Sleep 15
	MouseClick "Left", 1677, 1368, 1, 0, "D"
	Sleep 30
	MouseClick "Left", 1677, 1368, 1, 0, "U"
	
	Sleep 15
	MouseMove Qx, Qy
	CurrPray := 1
	SetTimer Unchange, -10
}
Numpad3::
{
	global Change
	
	if (Change > 0)
		return
	Change := 3
	Sleep 30
	
	if (PrayerMode == -1 && Running == 1)
		return
	
	MouseGetPos &Qx, &Qy
	Sleep 15
	if (!ImageSearch(&Px, &Py, 1722, 1344, 1722+44, 1344+46, "*Trans0x00FF00 PrayerTicking-Tab.png")) {
		MouseMove 1744, 1368
		Sleep 15
		MouseClick "Left", 1744, 1368, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1744, 1368, 1, 0, "U"
		Sleep 30
	}
	MouseMove 1928, 1219
	Sleep 15
	MouseClick "Left", 1928, 1219, 1, 0, "D"
	Sleep 30
	MouseClick "Left", 1928, 1219, 1, 0, "U"
	Sleep 30
	
	MouseMove 1677, 1368
	Sleep 15
	MouseClick "Left", 1677, 1368, 1, 0, "D"
	Sleep 30
	MouseClick "Left", 1677, 1368, 1, 0, "U"
	
	Sleep 15
	MouseMove Qx, Qy
	CurrPray := 2
	SetTimer Unchange, -10
}
RControl::
{
	global Running
	global PrayerMode
	global ExtraMode
	global ExtraModeStr
	
	if (Running == 1) {
		return
	}
	MouseClick "Left", 1795, 1083
	
	PrayerMode := Mod( (PrayerMode+1) + 1, 6 ) - 1
	
	if (PrayerMode == 0) {
		PrayerModeStr := "Qck Prot"
	} else if (PrayerMode == 1) {
		PrayerModeStr := "Qck Atk"
	} else if (PrayerMode == 2) {
		PrayerModeStr := "Mnl Mag Prot"
	} else if (PrayerMode == 3) {
		PrayerModeStr := "Mnl Msl Prot"
	} else if (PrayerMode == 4) {
		PrayerModeStr := "Mnl Mle Prot"
	} else if (PrayerMode == -1) {
		PrayerModeStr := "Qck Spam Tick"
	}
	
	ExtraMode := 0
	ExtraModeStr := "None"
	MyBtn8.Text := "Extra :: " ExtraModeStr
	MyGui8.Show()
		
	GuiCtrl3.Text := "Mode :: " PrayerModeStr
	MyGui3.Show()
}
RAlt::
{
	global Running
	global PrayerMode
	global PrayerTick
	global BlockInp
	global PT2Wait
	global Cycle
	global Step
	global x
	global y
	
	; Magic, Missiles, Melee, Magic, Missiles, Melee
	PosX := [1853, 1889, 1925, 1926, 1889, 1852]
	PosY := [1220, 1220, 1220, 1297, 1293, 1293]
	
	if (Running == 0) {
		Running := 1
		Cycle := -1
		
		GuiCtrl6.Text := "Running :: " Running
		MyGui6.Show()
		
		SetTimer PrayerCheck, 0
		
		if (PrayerMode == -1) {
			Inactive := PixelSearch(&Px, &Py, 1813, 721, 1819, 727, 0xf4fef9, 3)
			if (Inactive) {
				MouseMove 1816, 727
				Sleep 40
				MouseClick "Left", 1816, 727, 1, 0, "D"
				Sleep 50
				MouseClick "Left", 1816, 727, 1, 0, "U"
				Sleep 40
			}
			SetTimer Spam, -1
			return
		}
		Starter()
		SetTimer Starter, (PrayerTick * 600)
		
		Inactive := PixelSearch(&Px, &Py, 1813, 721, 1819, 727, 0xf4fef9, 3)
		if (!Inactive && PrayerMode < 2) {
			BlockInput "MouseMove"
			BlockInp := 1
			MouseGetPos &x, &y
			
			MouseMove 1816, 727
			Sleep 40
			MouseClick "Left", 1816, 727, 1, 0, "D"
			Sleep 50
			MouseClick "Left", 1816, 727, 1, 0, "U"
			
			Sleep 15
			MouseMove x, y
			BlockInp := 0
			BlockInput "MouseMoveOff"
		}
	} else {
		Running := 0
		
		GuiCtrl6.Text := "Running :: " Running
		MyGui6.Show()
		
		SetTimer Spam, 0
		SetTimer Starter, 0
		SetTimer PT1, 0
		SetTimer PT2, 0
		
		PT2Wait := 0
		
		SetTimer PrayerCheck, -200
	}
}

#HotIf BlockInp == 1
	LButton::return
#HotIf
	
return

Spam()
{
	global Running
	global ItemMode
	global Cycle
	global ExtraMode
	global BlockInp
	global Change
	global Qx
	global Qy
	
	x := 0
	y := 0
	
	if (Cycle == -1) {
		if (ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-1.png"))
			Cycle := 0
		if (ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-2.png"))
			Cycle := 1
		if (ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-3.png"))
			Cycle := 2
		if (ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-4.png"))
			Cycle := 3
	}
	
	if (Cycle == 0) {
		while(!ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-2.png")) {
			Sleep 5
		}
		Cycle := 1
	} else if (Cycle == 1) {
		while(!ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-3.png")) {
			Sleep 5
		}
		Cycle := 2
	} else if (Cycle == 2) {
		while(!ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-4.png")) {
			Sleep 5
		}
		Cycle := 3
	} else if (Cycle == 3) {
		while(!ImageSearch(&x, &y, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-1.png")) {
			Sleep 5
		}
		Cycle := 0
	}
	
	if (Change == 1) {
		if (!ImageSearch(&Px, &Py, 1722, 1344, 1722+44, 1344+46, "*Trans0x00FF00 PrayerTicking-Tab.png")) {
			MouseMove 1744, 1368
			Sleep 15
			MouseClick "Left", 1744, 1368, 1, 0, "D"
			Sleep 30
			MouseClick "Left", 1744, 1368, 1, 0, "U"
			Sleep 30
		}
		MouseMove 1854, 1219
		Sleep 15
		MouseClick "Left", 1854, 1219, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1854, 1219, 1, 0, "U"
		Sleep 30
		
		MouseMove 1677, 1368
		Sleep 15
		MouseClick "Left", 1677, 1368, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1677, 1368, 1, 0, "U"
		Change := 0
	} else if (Change == 2) {
		if (!ImageSearch(&Px, &Py, 1722, 1344, 1722+44, 1344+46, "*Trans0x00FF00 PrayerTicking-Tab.png")) {
			MouseMove 1744, 1368
			Sleep 15
			MouseClick "Left", 1744, 1368, 1, 0, "D"
			Sleep 30
			MouseClick "Left", 1744, 1368, 1, 0, "U"
			Sleep 30
		}
		MouseMove 1891, 1219
		Sleep 15
		MouseClick "Left", 1891, 1219, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1891, 1219, 1, 0, "U"
		Sleep 30
		
		MouseMove 1677, 1368
		Sleep 15
		MouseClick "Left", 1677, 1368, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1677, 1368, 1, 0, "U"
		Change := 0
	} else if (Change == 3) {
		if (!ImageSearch(&Px, &Py, 1722, 1344, 1722+44, 1344+46, "*Trans0x00FF00 PrayerTicking-Tab.png")) {
			MouseMove 1744, 1368
			Sleep 15
			MouseClick "Left", 1744, 1368, 1, 0, "D"
			Sleep 30
			MouseClick "Left", 1744, 1368, 1, 0, "U"
			Sleep 30
		}
		MouseMove 1928, 1219
		Sleep 15
		MouseClick "Left", 1928, 1219, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1928, 1219, 1, 0, "U"
		Sleep 30
		
		MouseMove 1677, 1368
		Sleep 15
		MouseClick "Left", 1677, 1368, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1677, 1368, 1, 0, "U"
		Change := 0
	} else if (Change == 4) {
		Change := 0
	} else {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 30
		MouseMove 1816, 727
		Sleep 30
		MouseClick "Left", 1816, 727, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1816, 727, 1, 0, "U"
		Sleep 30
		MouseMove 1816, 727
		Sleep 30
		MouseClick "Left", 1816, 727, 1, 0, "D"
		Sleep 30
		MouseClick "Left", 1816, 727, 1, 0, "U"
		Sleep 30
	}
	
	
	; NMZ
	if (ItemMode == 1) {
		; Overloads
		if (!ImageSearch(&Px, &Py, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-5.png") && ImageSearch(&x, &y, 1795, 1083, 1795+190, 1083+261, "*8 *Trans0x00FF00 PrayerTicking-7.png")) {
			Sleep 25
			MouseMove x+10, y+15
			Sleep 40
			MouseClick "Left", x+10, y+15, 1, 0, "D"
			Sleep 50
			MouseClick "Left", x+10, y+15, 1, 0, "U"
		; Absorptions
		} else if (!ImageSearch(&Px, &Py, 774, 628, 774+231, 628+335, "*Trans0x00FF00 PrayerTicking-6.png") && ImageSearch(&x, &y, 1795, 1083, 1795+190, 1083+261, "*8 *Trans0x00FF00 PrayerTicking-8.png")) {
			Sleep 25
			MouseMove x+10, y+15
			Sleep 40
			MouseClick "Left", x+10, y+15, 1, 0, "D"
			Sleep 50
			MouseClick "Left", x+10, y+15, 1, 0, "U"
		}
	}
	
	if (Running == 0) {
		BlockInp := 0
		BlockInput "MouseMoveOff"
		
		if (ExtraMode == 1) {
			Sleep 25
			MouseMove 1816, 727
			Sleep 40
			MouseClick "Left", 1816, 727, 1, 0, "D"
			Sleep 50
			MouseClick "Left", 1816, 727, 1, 0, "U"
			Sleep 15
		}
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
		
		return
	} else {
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
		
		SetTimer Spam, -1
	}
}
Starter()
{
	global PrayerTick
	global Step
	
	Step := -1
	SetTimer PT1, -1 * ((PrayerTick - 2) * 600 + 75)
}
PT1() 
{
	global PrayerMode
	global BlockInp
	global PT2Wait
	global Step
	global x
	global y
	
	; Magic, Missiles, Melee, Magic, Missiles, Melee
	PosX := [1853, 1889, 1925, 1926, 1889, 1852]
	PosY := [1220, 1220, 1220, 1297, 1293, 1293]
	
	if (PrayerMode < 2)
		SetTimer PT2, -575
	else {
		PT2Wait := 1
		SetTimer PT2, -700
	}
	
	if (PrayerMode < 2) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove 1816, 727
		Sleep 40
		MouseClick "Left", 1816, 727, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1816, 727, 1, 0, "U"
		
		Step := 0
	} else if (PrayerMode >= 2) {
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &x, &y
		MouseMove 1745, 1368
		Sleep 30
		MouseClick "Left", 1745, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1745, 1368, 1, 0, "U"
		Sleep 10
		
		Step := 2
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
		
		MouseMove PosX[PrayerMode - 1], PosY[PrayerMode - 1]
		Sleep 30
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "D"
		Sleep 50
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "U"
		
		Step := 3
	}
	
	if (Running == 0) {
		BlockInp := 0
		BlockInput "MouseMoveOff"
		return
	}
}
PT2() 
{
	global Running
	global PowerActive
	global BlockInp
	global PT2Wait
	global Step
	global x
	global y
	
	PT2Wait := 0
	
	; Magic, Missiles, Melee, Magic, Missiles, Melee
	PosX := [1853, 1889, 1925, 1926, 1889, 1852]
	PosY := [1220, 1220, 1220, 1297, 1293, 1293]

	if (Running == 0) {
		BlockInp := 0
		BlockInput "MouseMoveOff"
		return
	}
	
	if (PrayerMode < 2) {
		Sleep 15
		MouseMove 1816, 727
		Sleep 40
		MouseClick "Left", 1816, 727, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1816, 727, 1, 0, "U"
		
		Step := 1
	} else if (PrayerMode >= 2) {
		Sleep 15
		MouseMove PosX[PrayerMode - 1], PosY[PrayerMode - 1]
		Sleep 30
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "D"
		Sleep 50
		MouseClick "Left", PosX[PrayerMode - 1], PosY[PrayerMode - 1], 1, 0, "U"
		Sleep 10
		
		Step := 4
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
		
		MouseMove 1678, 1368
		Sleep 30
		MouseClick "Left", 1678, 1368, 1, 0, "D"
		Sleep 50
		MouseClick "Left", 1678, 1368, 1, 0, "U"
		
		Step := 5
	}
	Sleep 15
	MouseMove x, y
	BlockInp := 0
	BlockInput "MouseMoveOff"
}