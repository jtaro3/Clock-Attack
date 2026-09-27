Option Explicit

' LibreOffice Calc用。マイマクロの標準モジュールに貼り付けてください。
Sub ExportAllSheetsToCSV
    Dim doc As Object, files As Object
    Dim sourcePath As String, parentPath As String, folderPath As String
    Dim folderURL As String, separator As String
    Dim i As Long
    Dim options(2) As New com.sun.star.beans.PropertyValue
    On Error GoTo Failed

    doc = ThisComponent
    If Not doc.supportsService("com.sun.star.sheet.SpreadsheetDocument") Then
        MsgBox "CSVに出力したいCalcのブックを開いてください。", 48, "CSV出力"
        Exit Sub
    End If
    If doc.URL = "" Then
        MsgBox "先にブックを保存してください。", 48, "CSV出力"
        Exit Sub
    End If
    If LCase(Left(doc.URL, 5)) <> "file:" Then
        MsgBox "ブックをPC上のフォルダーに保存してから実行してください。", 48, "CSV出力"
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
    files = CreateUnoService("com.sun.star.ucb.SimpleFileAccess")
    folderPath = parentPath & "CSV"
    folderURL = ConvertToURL(folderPath)
    If Not files.exists(folderURL) Then
        files.createFolder(folderURL)
    ElseIf Not files.isFolder(folderURL) Then
        MsgBox "CSVという名前のファイルがあるため、出力フォルダーを作成できません。", 48, "CSV出力"
        Exit Sub
    End If

    options(0).Name = "FilterName"
    options(0).Value = "Text - txt - csv (StarCalc)"
    options(1).Name = "FilterOptions"
    ' Comma, double quote, UTF-8, displayed values, no formula text, all sheets, BOM.
    options(1).Value = "44,34,76,1,,0,false,true,true,false,false,-1,false,true"
    options(2).Name = "Overwrite"
    options(2).Value = True

    ' storeToURL exports a copy; it does not change the workbook's format or location.
    doc.storeToURL(ConvertToURL(folderPath & separator & "sheet.csv"), options())
    MsgBox "全シートのCSV出力が完了しました。" & Chr(10) & folderPath, 64, "CSV出力"
    Exit Sub
Failed:
    MsgBox "CSV出力に失敗しました。" & Chr(10) & Error$ & Chr(10) & _
        "出力先: " & folderPath & Chr(10) & "途中まで出力されている場合があります。", 16, "CSV出力"
End Sub
