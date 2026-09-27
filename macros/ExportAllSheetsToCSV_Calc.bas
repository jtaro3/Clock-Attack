Option Explicit

' LibreOffice Calc: export to a temporary folder, validate, then publish CSV and JSON.
Sub ExportAllSheetsToCSV
    Dim doc As Object, files As Object
    Dim sourcePath As String, parentPath As String, pendingPath As String
    Dim separator As String, projectPath As String, scriptPath As String
    Dim arguments As String, i As Long
    Dim options(2) As New com.sun.star.beans.PropertyValue
    On Error GoTo Failed

    doc = ThisComponent
    If Not doc.supportsService("com.sun.star.sheet.SpreadsheetDocument") Then
        MsgBox "CSVに出力したいCalcのブックを開いてください。", 48, "CSV・JSON出力"
        Exit Sub
    End If
    If doc.URL = "" Or LCase(Left(doc.URL, 5)) <> "file:" Then
        MsgBox "先にブックをPC上のフォルダーへ保存してください。", 48, "CSV・JSON出力"
        Exit Sub
    End If

    sourcePath = ConvertFromURL(doc.URL)
    separator = GetPathSeparator()
    For i = Len(sourcePath) To 1 Step -1
        If Mid(sourcePath, i, 1) = separator Then
            parentPath = Left(sourcePath, i)
            Exit For
        End If
    Next i
    projectPath = Left(parentPath, Len(parentPath) - 1)
    pendingPath = parentPath & "CSV.__pending"
    scriptPath = parentPath & "publish-csv-folder.ps1"
    files = CreateUnoService("com.sun.star.ucb.SimpleFileAccess")
    ResetFolder files, pendingPath

    options(0).Name = "FilterName"
    options(0).Value = "Text - txt - csv (StarCalc)"
    options(1).Name = "FilterOptions"
    ' Comma, double quote, UTF-8, displayed values, all sheets, BOM.
    options(1).Value = "44,34,76,1,,0,false,true,true,false,false,-1,false,true"
    options(2).Name = "Overwrite"
    options(2).Value = True
    doc.storeToURL(ConvertToURL(pendingPath & separator & "sheet.csv"), options())

    arguments = "-NoProfile -ExecutionPolicy Bypass -File " & Q(scriptPath) & _
        " -SourceCsvFolder " & Q(pendingPath) & " -ProjectFolder " & Q(projectPath)
    Shell("powershell.exe", 0, arguments, True)
    Exit Sub
Failed:
    MsgBox "CSV出力を開始できませんでした。" & Chr(10) & Error$, 16, "CSV・JSON出力エラー"
End Sub

Sub ResetFolder(files As Object, folderPath As String)
    Dim folderURL As String, entries As Variant, entry As Variant
    folderURL = ConvertToURL(folderPath)
    If files.exists(folderURL) Then
        entries = files.getFolderContents(folderURL, True)
        For Each entry In entries
            files.kill(entry)
        Next entry
        files.kill(folderURL)
    End If
    files.createFolder(folderURL)
End Sub

Function Q(value As String) As String
    Q = Chr(34) & value & Chr(34)
End Function
