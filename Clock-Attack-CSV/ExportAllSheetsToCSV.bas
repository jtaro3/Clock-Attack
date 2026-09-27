Attribute VB_Name = "CsvExport"
Option Explicit

' Export every worksheet, including hidden worksheets, as UTF-8 CSV.
Public Sub ExportAllSheetsToCSV()
    Dim ws As Worksheet, tempBook As Workbook
    Dim folder As String, baseFolder As String, fileName As String
    Dim fso As Object, lastRow As Range, lastCol As Range, source As Range
    Dim oldAlerts As Boolean, oldEvents As Boolean, oldScreen As Boolean
    Dim count As Long, suffix As Long, errorText As String
    Dim previousBook As Workbook, previousSheet As Object

    oldAlerts = Application.DisplayAlerts
    oldEvents = Application.EnableEvents
    oldScreen = Application.ScreenUpdating
    Set previousBook = Application.ActiveWorkbook
    Set previousSheet = Application.ActiveSheet
    On Error GoTo Failed

    If Len(ThisWorkbook.Path) = 0 Then
        MsgBox "Please save this workbook before exporting.", vbExclamation
        Exit Sub
    End If
    Set fso = CreateObject("Scripting.FileSystemObject")
    baseFolder = ThisWorkbook.Path & Application.PathSeparator & "csv_" & Format$(Now, "yyyymmdd_hhnnss")
    folder = baseFolder
    Do While fso.FolderExists(folder) Or fso.FileExists(folder)
        suffix = suffix + 1
        folder = baseFolder & "_" & CStr(suffix)
    Loop
    fso.CreateFolder folder
    Application.DisplayAlerts = False
    Application.EnableEvents = False
    Application.ScreenUpdating = False

    For Each ws In ThisWorkbook.Worksheets
        Set tempBook = Application.Workbooks.Add(xlWBATWorksheet)
        Set lastRow = ws.Cells.Find(What:="*", After:=ws.Cells(1, 1), LookIn:=xlFormulas, _
            LookAt:=xlPart, SearchOrder:=xlByRows, SearchDirection:=xlPrevious, MatchCase:=False, SearchFormat:=False)
        Set lastCol = ws.Cells.Find(What:="*", After:=ws.Cells(1, 1), LookIn:=xlFormulas, _
            LookAt:=xlPart, SearchOrder:=xlByColumns, SearchDirection:=xlPrevious, MatchCase:=False, SearchFormat:=False)
        If Not lastRow Is Nothing And Not lastCol Is Nothing Then
            Set source = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow.Row, lastCol.Column))
            source.Copy
            tempBook.Worksheets(1).Range("A1").PasteSpecial Paste:=xlPasteValuesAndNumberFormats
            Application.CutCopyMode = False
        End If
        fileName = SafeCsvName(ws.Name)
        tempBook.SaveAs Filename:=folder & Application.PathSeparator & fileName & ".csv", _
            FileFormat:=62, CreateBackup:=False, Local:=False
        tempBook.Close SaveChanges:=False
        Set tempBook = Nothing
        count = count + 1
    Next ws
    GoTo CleanUp

Failed:
    errorText = Err.Description
CleanUp:
    On Error Resume Next
    If Not tempBook Is Nothing Then tempBook.Close SaveChanges:=False
    Application.CutCopyMode = False
    If Not previousBook Is Nothing Then previousBook.Activate
    If Not previousSheet Is Nothing Then previousSheet.Activate
    Application.DisplayAlerts = oldAlerts
    Application.EnableEvents = oldEvents
    Application.ScreenUpdating = oldScreen
    On Error GoTo 0
    If Len(errorText) > 0 Then
        MsgBox "Export stopped after " & count & " sheet(s)." & vbCrLf & errorText & vbCrLf & folder, vbExclamation
    Else
        MsgBox count & " CSV file(s) exported." & vbCrLf & folder, vbInformation
    End If
End Sub

Private Function SafeCsvName(ByVal name As String) As String
    ' Encode unsafe characters without introducing filename collisions.
    Dim i As Long, ch As String, result As String, stem As String
    For i = 1 To Len(name)
        ch = Mid$(name, i, 1)
        If InStr(1, "%<>:""/\|?*", ch, vbBinaryCompare) > 0 Or AscW(ch) < 32 And AscW(ch) >= 0 Then
            result = result & "%" & Right$("0000" & Hex$(AscW(ch)), 4)
        Else
            result = result & ch
        End If
    Next i
    stem = UCase$(Split(result, ".")(0))
    Select Case stem
        Case "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", _
             "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
            result = "%" & Right$("0000" & Hex$(AscW(Left$(result, 1))), 4) & Mid$(result, 2)
    End Select
    SafeCsvName = result
End Function
