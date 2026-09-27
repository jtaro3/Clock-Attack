Option Explicit

' LibreOffice Calc: export to a temporary folder, validate, then publish CSV and JSON.
Sub ExportAllSheetsToCSV
    ExportSheetsToCSV False
End Sub

Sub ExportCurrentSheetToCSV
    ExportSheetsToCSV True
End Sub

Sub ExportSheetsToCSV(currentOnly As Boolean)
    Dim doc As Object, files As Object
    Dim sourcePath As String, parentPath As String, pendingPath As String
    Dim separator As String, projectPath As String, scriptPath As String
    Dim arguments As String, i As Long, resultPath As String, resultText As String
    Dim sheetName As String, outputPath As String
    Dim sheetNumber As Long
    Dim powerShellPath As String, inputStream As Object, textStream As Object
    Dim executor As Object
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
    resultPath = parentPath & "CSV_EXPORT_RESULT.txt"
    If currentOnly Then
        sheetName = doc.CurrentController.ActiveSheet.Name
        For i = 0 To doc.Sheets.Count - 1
            If doc.Sheets.getByIndex(i).Name = sheetName Then
                sheetNumber = i + 1
                Exit For
            End If
        Next i
        If sheetName = "" Then
            MsgBox "出力するシートを選択してください。", 48, "CSV・JSON出力"
            Exit Sub
        End If
        outputPath = pendingPath & separator & "sheet.csv"
    Else
        outputPath = pendingPath & separator & "sheet.csv"
    End If
    files = CreateUnoService("com.sun.star.ucb.SimpleFileAccess")
    If files.exists(ConvertToURL(resultPath)) Then files.kill(ConvertToURL(resultPath))
    ResetFolder files, pendingPath

    options(0).Name = "FilterName"
    options(0).Value = "Text - txt - csv (StarCalc)"
    options(1).Name = "FilterOptions"
    ' Comma, double quote, UTF-8, displayed values, all sheets, BOM.
    If currentOnly Then
        options(1).Value = "44,34,76,1,,0,false,true,true,false,false," & CStr(sheetNumber) & ",false,true"
    Else
        options(1).Value = "44,34,76,1,,0,false,true,true,false,false,-1,false,true"
    End If
    options(2).Name = "Overwrite"
    options(2).Value = True
    doc.storeToURL(ConvertToURL(outputPath), options())

    powerShellPath = Environ("SystemRoot") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
    arguments = "-NoProfile -ExecutionPolicy Bypass -File " & Q(scriptPath) & _
        " -SourceCsvFolder " & Q(pendingPath) & " -ProjectFolder " & Q(projectPath) & _
        " -ResultFile " & Q(resultPath) & " -Silent"
    If currentOnly Then arguments = arguments & " -SheetName " & Q(sheetName)
    If Not files.exists(ConvertToURL(powerShellPath)) Then
        MsgBox "PowerShellが見つかりません。" & Chr(10) & powerShellPath, 16, "CSV・JSON出力エラー"
        Exit Sub
    End If
    executor = CreateUnoService("com.sun.star.system.SystemShellExecute")
    executor.execute(powerShellPath, arguments, 0)
    For i = 1 To 300
        If files.exists(ConvertToURL(resultPath)) Then Exit For
        Wait 100
    Next i
    If Not files.exists(ConvertToURL(resultPath)) Then
        MsgBox "CSVは一時フォルダーへ出力しましたが、30秒以内に検証結果を受け取れませんでした。" & Chr(10) & scriptPath, 16, "CSV・JSON出力エラー"
        Exit Sub
    End If
    inputStream = files.openFileRead(ConvertToURL(resultPath))
    textStream = CreateUnoService("com.sun.star.io.TextInputStream")
    textStream.setInputStream(inputStream)
    textStream.setEncoding("UTF-8")
    resultText = textStream.readLine()
    textStream.closeInput()
    If Left(resultText, 3) = "OK:" Then
        MsgBox resultText, 64, "CSV・JSON出力完了"
    Else
        MsgBox resultText, 16, "CSV・JSON出力エラー"
    End If
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
