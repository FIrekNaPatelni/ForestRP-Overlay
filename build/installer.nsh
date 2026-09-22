!ifndef BUILD_UNINSTALLER
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var OverlayDesktopCheckbox
Var OverlayStartCheckbox
Var OverlayDesktopState
Var OverlayStartState

!macro customInit
  StrCpy $OverlayDesktopState ${BST_CHECKED}
  StrCpy $OverlayStartState ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom OverlayOptionsPage OverlayOptionsLeave
!macroend

Function OverlayOptionsPage
  !insertmacro MUI_HEADER_TEXT "Skróty aplikacji" "Wybierz, gdzie utworzyć skróty ForestRP Overlay."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateCheckbox} 0 16u 100% 14u "Utwórz skrót na pulpicie"
  Pop $OverlayDesktopCheckbox
  ${NSD_SetState} $OverlayDesktopCheckbox $OverlayDesktopState
  ${NSD_CreateCheckbox} 0 42u 100% 14u "Utwórz skrót w menu Start"
  Pop $OverlayStartCheckbox
  ${NSD_SetState} $OverlayStartCheckbox $OverlayStartState
  nsDialogs::Show
FunctionEnd

Function OverlayOptionsLeave
  ${NSD_GetState} $OverlayDesktopCheckbox $OverlayDesktopState
  ${NSD_GetState} $OverlayStartCheckbox $OverlayStartState
FunctionEnd

!macro customInstall
  ${If} $OverlayDesktopState == ${BST_UNCHECKED}
    Delete "$newDesktopLink"
  ${EndIf}
  ${If} $OverlayStartState == ${BST_UNCHECKED}
    Delete "$newStartMenuLink"
    StrCpy $launchLink "$appExe"
  ${EndIf}
!macroend

!endif
