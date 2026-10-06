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

; Finish Page styling & readability tokens (Tour 18)
!define MUI_FINISHPAGE_BGCOLOR "08090A"
!define MUI_FINISHPAGE_TEXT_COLOR "FAFAFA"
!define MUI_FINISHPAGE_TEXT_LARGE "FAFAFA"
!define MUI_FINISHPAGE_RUN_TEXT "Exist Flow'u çalıştır"

; Force classic control theming so Win32 checkbox / radio controls honor SetCtlColors text/bg
!define MUI_FORCECLASSICCONTROLS

!macro customHeader
  ; Sets the default UI font to Segoe UI (standard Windows sans font)
  SetFont "Segoe UI" 9
!macroend

!macro customGUIInit
  ; Note on standard Win32 dialog controls:
  ; Background color and fonts are applied across all wizard dialogs.
!macroend
