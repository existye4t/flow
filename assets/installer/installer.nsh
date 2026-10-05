; Exist Flow - NSIS Custom Dark Theme Script
; Palette derived from src/renderer/styles/global.css
;
; Background: #08090A (0x08090A)
; Surface:    #111214 (0x111214)
; Text:       #FAFAFA (0xFAFAFA)
; Muted:      #8A8D93 (0x8A8D93)
; Accent:     #E8E8E8 (0xE8E8E8)

!define MUI_BGCOLOR "08090A"
!define MUI_TEXTCOLOR "FAFAFA"

!macro customHeader
  ; Sets the default UI font to Segoe UI (standard Windows sans font)
  SetFont "Segoe UI" 9
!macroend

!macro customGUIInit
  ; Note on standard Win32 dialog controls:
  ; Standard Windows NSIS dialog controls (buttons, checkboxes, edit fields)
  ; retain the native Windows UxTheme renderer; background color and fonts
  ; are applied across the welcome header and branding areas.
!macroend
