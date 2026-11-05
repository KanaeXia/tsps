#Requires AutoHotkey v2.0

; RAlt to switch between modes
; RCtrl to start script
; Numpad1-3 for switching between magic, missiles and melee protections
; Numpad4-6 for switching between piety, rigour and augury

CoordMode "mouse", "screen"
CoordMode "Pixel", "screen" 
InstallMouseHook

Setup := 0
SetupStep := 0
Running := 0
BlockInp := 0

Qx := 0
Qy := 0

PrayerMode := -1
PrayerModeStr := "Qck 1-Tick"
PrayerCount := 4
PrayerCountC := 0
PrayerCountSwitch := 0

Cycle := -1
ExtraMode := -1
SwapMode := -1

MeterX := -1
MeterY := -1
ProtX := -1
ProtY := -1
AttkX := -1
AttkY := -1
QuickX := -1
QuickY := -1
TickX := -1
TickY := -1
							
MyGui0 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui0.Show()
GuiCtrl0 := MyGui0.Add("Text", "W180","NumDot:BotLeft PrayMeter" )
MyGui0.Move(20, 20, 180, 25)
			
MyGui1 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui1.Show()
GuiCtrl1 := MyGui1.Add("Text", "W180", "Mode::" PrayerModeStr)
MyGui1.Move(220, 20, 180, 25)
			
MyGui2 := Gui("+LastFound -Caption +AlwaysOnTop +ToolWindow -Border")
MyGui2.Show()
GuiCtrl2 := MyGui2.Add("Text", "W180", "-")
MyGui2.Move(420, 20, 180, 25)

#HotIf BlockInp == 1
	LButton::return
#HotIf

; Changing modes
NumpadAdd::
{
	global Setup
	global Running
	global PrayerMode
	global PrayerCount
	
	if (Setup == 0) {
		return
	}
	if (Running == 1) {
		return
	}
	PrayerMode := Mod( (PrayerMode+1) + 1, 5 ) - 1
	
	; -1 - 1-tick prayer flicking
	; 0 - max-tick-based switch to magic protection
	; 1 - max-tick-based switch to missile protection
	; 2 - max-tick-based switch to melee protection
	if (PrayerMode == 0) {
		PrayerModeStr := "Qck MagProt"
		GuiCtrl2.Text := "Tick Max::" PrayerCount
	} else if (PrayerMode == 1) {
		PrayerModeStr := "Qck MisProt"
		GuiCtrl2.Text := "Tick Max::" PrayerCount
	} else if (PrayerMode == 2) {
		PrayerModeStr := "Qck MleProt"
		GuiCtrl2.Text := "Tick Max::" PrayerCount
	} else if (PrayerMode == 3) {
		PrayerModeStr := "Manual"
		GuiCtrl2.Text := "-"
	} else if (PrayerMode == -1) {
		PrayerModeStr := "Qck 1-Tick"
		GuiCtrl2.Text := "-"
	}
		
	GuiCtrl1.Text := "Mode::" PrayerModeStr
}
; Starting script
NumpadDot::
{
	global Setup
	global SetupStep
	global Running
	global PrayerMode
	global Cycle
	
	global PrayerCountC
	global PrayerCountSwitch
	
	global MeterX
	global MeterY
	global ProtX
	global ProtY
	global AttkX
	global AttkY
	global QuickX
	global QuickY
	global TickX
	global TickY
	
	if (Setup == 0) {
		; Bottom Left of Prayer Meter, need for detecting prayers being on
		if (SetupStep == 0) {
			SetupStep := 1
			MouseGetPos &MeterX, &MeterY
			GuiCtrl0.Text := "NumDot:MagicProt Button"
			
		; Magic Prayer position; Missiles and Melee will be right next to it anyhow
		; originally menu button, but we'll use F2 to switch to it instead
		} else if (SetupStep == 1) {
			SetupStep := 2
			MouseGetPos &ProtX, &ProtY
			GuiCtrl0.Text := "NumDot:Piety Button"
		
		; Piety position; Rigour and Augury will be right next to it anyhow
		; originally menu button, but we'll use F2 to switch to it instead
		} else if (SetupStep == 2) {
			SetupStep := 3
			MouseGetPos &AttkX, &AttkY
			GuiCtrl0.Text := "NumDot:QuickPray Button"
			
		; Top left of where the tick counter is
		} else if (SetupStep == 3) {
			SetupStep := 4
			MouseGetPos &QuickX, &QuickY
			GuiCtrl0.Text := "NumDot:TopLeft TickCount"
			
		; Quick-Pray button; for 1-ticking
		} else if (SetupStep == 4) {
			SetupStep := 5
			MouseGetPos &TickX, &TickY
			GuiCtrl0.Text := "Running::" Running
			
			Setup := 1
		}
		return
	}
	
	if (Running == 0) {
		; 1-tick prayer flicking
		if (PrayerMode == -1) {
			Running := 1
			GuiCtrl0.Text := "Running::" Running
			; Is the prayer currently off?  Search for active color
			Inactive := !PixelSearch(&Px, &Py, MeterX, MeterY-18, MeterX+18, MeterY, 0x36e4a7, 3)
			; Make sure to turn it on
			if (Inactive) {
				BlockInput "MouseMove"
				BlockInp := 1
				MouseGetPos &Qx, &Qy
				MouseMove QuickX, QuickY
				Sleep 10
				MouseClick "Left", QuickX, QuickY, 1, 0, "D"
				Sleep 10
				MouseClick "Left", QuickX, QuickY, 1, 0, "U"
				Sleep 15
				MouseMove Qx, Qy
				BlockInp := 0
				BlockInput "MouseMoveOff"
			}
			; Set variables before starting
			Cycle := -1
			; Start the 1-ticking
			SetTimer Spam, -1
			return
		; Tick-based prayer flicking
		} else if (PrayerMode >= 0 && PrayerMode <= 2) {
			Running := 1
			GuiCtrl0.Text := "Running::" Running
			; Is the prayer currently off?  Search for active color
			Inactive := !PixelSearch(&Px, &Py, MeterX, MeterY-18, MeterX+18, MeterY, 0x36e4a7, 3)
			; Make sure to turn it off - double clicking quick pray turns off prayer
			if (!Inactive) {
				BlockInput "MouseMove"
				BlockInp := 1
				MouseGetPos &Qx, &Qy
				Sleep 15
				MouseMove QuickX, QuickY
				Sleep 10
				MouseClick "Left", QuickX, QuickY, 1, 0, "D"
				Sleep 10
				MouseClick "Left", QuickX, QuickY, 1, 0, "U"
				Sleep 15
				MouseMove QuickX, QuickY
				Sleep 10
				MouseClick "Left", QuickX, QuickY, 1, 0, "D"
				Sleep 10
				MouseClick "Left", QuickX, QuickY, 1, 0, "U"
				Sleep 15
				MouseMove Qx, Qy
				BlockInp := 0
				BlockInput "MouseMoveOff"
			}
			; Set variables before starting
			PrayerCountC := 0
			PrayerCountSwitch := 0
			Cycle := -1
			SetTimer Count, -1
			return
		}
	} else {
		Running := 0
		
		GuiCtrl0.Text := "Running::" Running
		
		SetTimer Spam, 0
		SetTimer Count, 0
	}
}
; 1-Tick Prayer repeating function
Spam()
{
	global Running
	global BlockInp
	
	global Cycle
	global ExtraMode
	global SwapMode
	
	global Qx
	global Qy
	global ProtX
	global ProtY
	global QuickX
	global QuickY
	
	; Determine which part of the tick cycle we're on - then swap between them when we detect a change
	x := 0
	y := 0
	if (Cycle == -1) {
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-1.png"))
			Cycle := 0
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-2.png"))
			Cycle := 1
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-3.png"))
			Cycle := 2
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-4.png"))
			Cycle := 3
	}
	if (Cycle == 0) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-2.png")) {
			Sleep 5
		}
		Cycle := 1
		if (Running == 0) {
			MouseMove Qx, Qy
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	} else if (Cycle == 1) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-3.png")) {
			Sleep 5
		}
		Cycle := 2
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	} else if (Cycle == 2) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-4.png")) {
			Sleep 5
		}
		Cycle := 3
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	} else if (Cycle == 3) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-1.png")) {
			Sleep 5
		}
		Cycle := 0
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	}
	
	; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're 1-ticking
	BlockInput "MouseMove"
	BlockInp := 1
	MouseGetPos &Qx, &Qy
	Sleep 15
	
	; We quickly turn off the prayer if the prayer is on
	Active := PixelSearch(&Px, &Py, MeterX, MeterY-18, MeterX+18, MeterY, 0x36e4a7, 3)
	if (Active) {
		MouseMove QuickX, QuickY
		Sleep 10
		MouseClick "Left", QuickX, QuickY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", QuickX, QuickY, 1, 0, "U"
		Sleep 15
	}
	
	; ..and turn the prayer back on
	MouseMove QuickX, QuickY
	Sleep 10
	MouseClick "Left", QuickX, QuickY, 1, 0, "D"
	Sleep 10
	MouseClick "Left", QuickX, QuickY, 1, 0, "U"
	Sleep 15
	
	; If set to 0-2, instead of the flicking we'll swap to the desired protection for two ticks/cycles
	; Be mindful you don't swap to what is already quick-selected
	if (SwapMode >= 0) {
	
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Regular 1-tick should resume after two ticks
		Cycle := Mod( Cycle + 2, 4 )
		
		MouseMove ProtX + 37*SwapMode, ProtY
		Sleep 10
		MouseClick "Left", ProtX + 37*SwapMode, ProtY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", ProtX + 37*SwapMode, ProtY, 1, 0, "U"
		Sleep 15
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
		
		SwapMode := -1
		SetTimer Spam, -1 
		return
	}
	
	; If the script is off
	if (Running == 0) {
		; Prayer is turned off after ending the 1-ticking if ExtraMode is 1
		if (ExtraMode == 1) {
			MouseMove QuickX, QuickY
			Sleep 10
			MouseClick "Left", QuickX, QuickY, 1, 0, "D"
			Sleep 10
			MouseClick "Left", QuickX, QuickY, 1, 0, "U"
			Sleep 15
		}
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
		
		return
	}
	
	MouseMove Qx, Qy
	BlockInp := 0
	BlockInput "MouseMoveOff"
	
	;Re-run 1-ticking until the script is turned off
	SetTimer Spam, -1 
}
; For protect flicking every few ticks
Count()
{
	global Running
	
	global BlockInp
	global Cycle
	
	global Qx
	global Qy
	global PrayerMode
	global PrayerCount
	global PrayerCountC
	global PrayerCountSwitch
	
	
	; Determine which part of the tick cycle we're on - Then begin counting
	x := 0
	y := 0
	if (Cycle == -1) {
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-1.png"))
			Cycle := 0
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-2.png"))
			Cycle := 1
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-3.png"))
			Cycle := 2
		if (ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-4.png"))
			Cycle := 3
	}
	if (Cycle == 0) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-2.png")) {
			Sleep 5
		}
		Cycle := 1
		PrayerCountC := PrayerCountC + 1
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	} else if (Cycle == 1) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-3.png")) {
			Sleep 5
		}
		Cycle := 2
		PrayerCountC := PrayerCountC + 1
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	} else if (Cycle == 2) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-4.png")) {
			Sleep 5
		}
		Cycle := 3
		PrayerCountC := PrayerCountC + 1
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	} else if (Cycle == 3) {
		while(!ImageSearch(&x, &y, TickX, TickY, TickX+40, TickY+40, "*Trans0x00FF00 praytick-1.png")) {
			Sleep 5
		}
		Cycle := 0
		PrayerCountC := PrayerCountC + 1
		if (Running == 0) {
			BlockInp := 0
			BlockInput "MouseMoveOff"
			return
		}
	}
	; Do nothing if we haven't reached the max count
	if (PrayerCountC < PrayerCount - 1) {
		SetTimer Count, -1
		return
	; First time around we activate, next we deactivate
	} else {
		if (PrayerCountSwitch == 1) {
			PrayerCountC := 0
			PrayerCountSwitch := 0
		} else {
			PrayerCountSwitch := 1
		}
	}
	
	; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
	BlockInput "MouseMove"
	BlockInp := 1
	MouseGetPos &Qx, &Qy
	Sleep 15
	
	; Swap to prayer window
	Send "{F2}"
	Sleep 10
	Send "{F2 up}"
	Sleep 15
	
	; Press designated protection button
	; We can use PrayerMode since the modes are 0-2 anyway
	MouseMove ProtX + 37*PrayerMode, ProtY
	Sleep 10
	MouseClick "Left", ProtX + 37*PrayerMode, ProtY, 1, 0, "D"
	Sleep 10
	MouseClick "Left", ProtX + 37*PrayerMode, ProtY, 1, 0, "U"
	
	; Swap back to inv window
	Send "{F1}"
	Sleep 10
	Send "{F1 up}"
	Sleep 15
	
	; If the script is off
	if (Running == 0) {
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
		
		return
	}
	
	MouseMove Qx, Qy
	BlockInp := 0
	BlockInput "MouseMoveOff"
	
	SetTimer Count, -1
}
; ---------------------------------------------------------------          --------------------------------------------------------------
; --------------------------------------------------------------- CONTROLS --------------------------------------------------------------
; ---------------------------------------------------------------          --------------------------------------------------------------
; Numpads 1, 2 and 3 should quickly swap between the protection prayers
; If we're on quick protect mode it should swap modes entirely
Numpad1::
{
	global Running
	global BlockInp
	
	global PrayerMode
	global PrayerModeStr
	global SwapMode
	
	global Qx
	global Qy
	global ProtX
	global ProtY
	
	;For 1-ticking
	if (PrayerMode == -1 && Running == 1) {
		SwapMode := 0
	} else if (PrayerMode == 1 || PrayerMode == 2) {
		PrayerMode := 0
		PrayerModeStr := "Qck MagProt"
		GuiCtrl1.Text := "Mode::" PrayerModeStr
	; Manual just clicks the prayer
	} else if (PrayerMode == 3 || PrayerMode == -1) {
		; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 15
		
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Press designated protection button
		; We can use PrayerMode since the modes are 0-2 anyway
		MouseMove ProtX, ProtY
		Sleep 10
		MouseClick "Left", ProtX, ProtY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", ProtX, ProtY, 1, 0, "U"
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
	}
}
Numpad2::
{
	global Running
	global BlockInp
	global PrayerMode
	global PrayerModeStr
	global SwapMode
	
	global Qx
	global Qy
	global ProtX
	global ProtY
	
	;For 1-ticking
	if (PrayerMode == -1 && Running == 1) {
		SwapMode := 1
	} else if (PrayerMode == 0 || PrayerMode == 2) {
		PrayerMode := 1
		PrayerModeStr := "Qck MisProt"
		GuiCtrl1.Text := "Mode::" PrayerModeStr
	; Manual just clicks the prayer
	} else if (PrayerMode == 3 || PrayerMode == -1) {
		; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 15
		
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Press designated protection button
		; We can use PrayerMode since the modes are 0-2 anyway
		MouseMove ProtX + 37, ProtY
		Sleep 10
		MouseClick "Left", ProtX + 37, ProtY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", ProtX + 37, ProtY, 1, 0, "U"
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
	}
}
Numpad3::
{
	global Running
	global BlockInp
	global PrayerMode
	global PrayerModeStr
	global SwapMode
	
	global Qx
	global Qy
	global ProtX
	global ProtY
	
	;For 1-ticking
	if (PrayerMode == -1 && Running == 1) {
		SwapMode := 2
	} else if (PrayerMode == 0 || PrayerMode == 1) {
		PrayerMode := 2
		PrayerModeStr := "Qck MleProt"
		GuiCtrl1.Text := "Mode::" PrayerModeStr
	; Manual just clicks the prayer
	} else if (PrayerMode == 3 || PrayerMode == -1) {
		; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 15
		
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Press designated protection button
		; We can use PrayerMode since the modes are 0-2 anyway
		MouseMove ProtX + 74, ProtY
		Sleep 10
		MouseClick "Left", ProtX + 74, ProtY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", ProtX + 74, ProtY, 1, 0, "U"
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
	}
}
; Numpad 0 should change how many ticks modes 0-2 switch through before ticking the prayer
Numpad0::
{
	global Running
	global PrayerMode
	global PrayerCount
	
	; Only should be available during the relevant prayer modes
	if (PrayerMode < 0 || PrayerMode > 2) {
		return
	}
	
	PrayerCount := Mod( PrayerCount + 1, 8 )
	; The count has a minimum or else it's no different than flicking
	if (PrayerCount == 0) {
		PrayerCount := 2
		GuiCtrl2.Text := "Tick Max::" PrayerCount
	}
}
; Numpads 4-6 are only available during manual mode
Numpad4::
{
	global Running
	global BlockInp
	
	global PrayerMode
	global PrayerModeStr
	global SwapMode
	
	global Qx
	global Qy
	global AttkX
	global AttkY
	
	; PrayerMode 3 is manual
	if (PrayerMode == 3 || (PrayerMode == -1 && Running == 0)) {
		; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 15
		
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Press designated Attack Pray button
		; We can use PrayerMode since the modes are 0-2 anyway
		MouseMove AttkX + 74, AttkY
		Sleep 10
		MouseClick "Left", AttkX + 74, AttkY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", AttkX + 74, AttkY, 1, 0, "U"
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
	}
}
Numpad5::
{
	global Running
	global BlockInp
	
	global PrayerMode
	global PrayerModeStr
	global SwapMode
	
	global Qx
	global Qy
	global AttkX
	global AttkY
	
	; PrayerMode 3 is manual
	if (PrayerMode == 3 || (PrayerMode == -1 && Running == 0)) {
		; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 15
		
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Press designated Attack Pray button
		; We can use PrayerMode since the modes are 0-2 anyway
		MouseMove AttkX + 37, AttkY
		Sleep 10
		MouseClick "Left", AttkX + 37, AttkY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", AttkX + 37, AttkY, 1, 0, "U"
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
	}
}
Numpad6::
{
	global Running
	global BlockInp
	
	global PrayerMode
	global PrayerModeStr
	global SwapMode
	
	global Qx
	global Qy
	global AttkX
	global AttkY
	
	; PrayerMode 3 is manual
	if (PrayerMode == 3 || (PrayerMode == -1 && Running == 0)) {
		; The previous position of the mouse is saved so we can just barely interact with our interfaces as we're switching
		BlockInput "MouseMove"
		BlockInp := 1
		MouseGetPos &Qx, &Qy
		Sleep 15
		
		; Swap to prayer window
		Send "{F2}"
		Sleep 10
		Send "{F2 up}"
		Sleep 15
		
		; Press designated Attack Pray button
		; We can use PrayerMode since the modes are 0-2 anyway
		MouseMove AttkX, AttkY
		Sleep 10
		MouseClick "Left", AttkX, AttkY, 1, 0, "D"
		Sleep 10
		MouseClick "Left", AttkX, AttkY, 1, 0, "U"
		
		; Swap back to inv window
		Send "{F1}"
		Sleep 10
		Send "{F1 up}"
		Sleep 15
		
		MouseMove Qx, Qy
		BlockInp := 0
		BlockInput "MouseMoveOff"
	}
}