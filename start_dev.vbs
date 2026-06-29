Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

basePath = FSO.GetParentFolderName(WScript.ScriptFullName)

' เปิด VS Code ที่โปรเจกต์นี้
WshShell.Run "code """ & basePath & """", 0, False

' เปิด backend
WshShell.Run "wt.exe new-tab cmd /k ""cd /d """ & basePath & "\backend"" && bun dev""", 1, False

' เปิด frontend
WshShell.Run "wt.exe new-tab cmd /k ""cd /d """ & basePath & "\frontend"" && bun dev""", 1, False

' เปิด root
WshShell.Run "wt.exe new-tab cmd /k ""cd /d """ & basePath & """", 1, False

Set FSO = Nothing
Set WshShell = Nothing