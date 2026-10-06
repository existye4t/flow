; Exist Flow - NSIS Custom Dark Theme & Installation Lifecycle Script
; Palette derived from src/renderer/styles/global.css
;
; Background: #08090A (0x08090A)
; Surface:    #111214 (0x111214)
; Text:       #FAFAFA (0xFAFAFA)
; Muted:      #8A8D93 (0x8A8D93)
; Accent:     #E8E8E8 (0xE8E8E8)

!include LogicLib.nsh

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

!macro customInit
  ; ---------------------------------------------------------------------------
  ; Tour 19: Previous installation detection and clean upgrade / reinstall
  ; ---------------------------------------------------------------------------
  ; Registers used:
  ; $R0 = UninstallString from registry
  ; $R1 = DisplayVersion from registry
  ; $R2 = InstallLocation from registry
  ; $R3 = Extracted uninstaller executable path
  ; $R4 = Extracted / resolved install directory
  ; $R5, $R6, $R9 = parsing temporaries
  ; $R7 = temp uninstaller executable copy
  ; $R8 = ExecWait exit code

  StrCpy $R0 ""
  StrCpy $R1 ""
  StrCpy $R2 ""

  ; 1. Check HKCU with UNINSTALL_APP_KEY (UUID v5 derived from build.appId)
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ReadRegStr $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ReadRegStr $R2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"

  ; 2. Check HKLM with UNINSTALL_APP_KEY
  ${If} $R0 == ""
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
    ReadRegStr $R1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
    ReadRegStr $R2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ${EndIf}

  ; 3. Check HKCU with APP_ID (com.exist.flow)
  ${If} $R0 == ""
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString"
    ReadRegStr $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion"
    ReadRegStr $R2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation"
  ${EndIf}

  ; 4. Check HKLM with APP_ID
  ${If} $R0 == ""
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString"
    ReadRegStr $R1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion"
    ReadRegStr $R2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation"
  ${EndIf}

  ; 5. Check HKCU with PRODUCT_NAME (Exist Flow)
  ${If} $R0 == ""
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString"
    ReadRegStr $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion"
    ReadRegStr $R2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallLocation"
  ${EndIf}

  ; 6. Check HKLM with PRODUCT_NAME
  ${If} $R0 == ""
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString"
    ReadRegStr $R1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion"
    ReadRegStr $R2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallLocation"
  ${EndIf}

  ${If} $R0 != ""
    ; Existing installation detected
    ${If} $R1 == "${VERSION}"
      MessageBox MB_YESNO|MB_ICONQUESTION "Zaten yüklü, yeniden yüklemek ister misiniz?" /SD IDYES IDYES _efDoUninstall IDNO _efCancel
    ${Else}
      ${If} $R1 != ""
        MessageBox MB_YESNO|MB_ICONQUESTION "Exist Flow zaten yüklü (sürüm $R1). Mevcut sürüm kaldırılıp Exist Flow ${VERSION} yüklensin mi?" /SD IDYES IDYES _efDoUninstall IDNO _efCancel
      ${Else}
        MessageBox MB_YESNO|MB_ICONQUESTION "Exist Flow zaten yüklü. Mevcut sürüm kaldırılıp Exist Flow ${VERSION} yüklensin mi?" /SD IDYES IDYES _efDoUninstall IDNO _efCancel
      ${EndIf}
    ${EndIf}

    _efCancel:
      Quit

    _efDoUninstall:
      ; Extract uninstaller executable path ($R3) from $R0
      StrCpy $R3 ""
      StrCpy $R5 $R0 1 0
      ${If} $R5 == '"'
        ; Quoted string: find matching closing quote
        StrCpy $R5 1
        _efQuoteLoop:
          StrCpy $R6 $R0 1 $R5
          ${If} $R6 == '"'
            IntOp $R9 $R5 - 1
            StrCpy $R3 $R0 $R9 1
            Goto _efExeDone
          ${EndIf}
          ${If} $R6 == ""
            StrCpy $R3 $R0
            Goto _efExeDone
          ${EndIf}
          IntOp $R5 $R5 + 1
          Goto _efQuoteLoop
      ${Else}
        ; Not quoted: find first space
        StrCpy $R5 0
        _efSpaceLoop:
          StrCpy $R6 $R0 1 $R5
          ${If} $R6 == " "
            StrCpy $R3 $R0 $R5 0
            Goto _efExeDone
          ${EndIf}
          ${If} $R6 == ""
            StrCpy $R3 $R0
            Goto _efExeDone
          ${EndIf}
          IntOp $R5 $R5 + 1
          Goto _efSpaceLoop
      ${EndIf}
      _efExeDone:

      ; Determine install directory ($R4)
      StrCpy $R4 $R2
      ${If} $R4 == ""
        StrLen $R5 $R3
        _efDirLoop:
          IntOp $R5 $R5 - 1
          ${If} $R5 <= 0
            StrCpy $R4 ""
            Goto _efDirDone
          ${EndIf}
          StrCpy $R6 $R3 1 $R5
          ${If} $R6 == "\"
            StrCpy $R4 $R3 $R5 0
            Goto _efDirDone
          ${EndIf}
          Goto _efDirLoop
        _efDirDone:
      ${EndIf}

      ; Ensure any running instances of the app are closed so files aren't locked
      nsExec::Exec 'taskkill /im "${APP_EXECUTABLE_FILENAME}" /f'
      Sleep 500

      ; Execute old uninstaller silently and synchronously from TEMP
      ; Passing _?=$R4 prevents forking into background so ExecWait blocks until finish.
      ; Leaving out --delete-app-data ensures user data (%APPDATA%\exist-flow) is preserved.
      ${If} ${FileExists} "$R3"
        StrCpy $R7 "$TEMP\exist-flow-old-uninstaller.exe"
        CopyFiles /SILENT "$R3" "$R7"
        ${If} $R4 != ""
          ExecWait '"$R7" /S _?=$R4' $R8
        ${Else}
          ExecWait '"$R7" /S' $R8
        ${EndIf}
        Delete "$R7"
        Sleep 1000
      ${EndIf}
  ${EndIf}
!macroend
